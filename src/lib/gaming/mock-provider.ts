import { randomUUID } from "node:crypto";

import { buildGamingCatalog, findTraditionalGame } from "./catalog";
import { GamingDomainError } from "./errors";
import {
  idempotencyKeySchema,
  instantPlayRequestSchema,
  traditionalPlayRequestSchema,
  walletTopupRequestSchema,
} from "./schemas";
import {
  evaluateInstantPlay,
  generateResultNumbers,
  ServerCryptoRandomSource,
  type RandomSource,
} from "./rules";
import {
  CURRENCY,
  type GamingCatalog,
  type InstantGameId,
  type GamingPlay,
  type GamingResult,
  type GamingTicket,
  type MockRole,
  type MockSessionView,
  type PlacePlayResponse,
  type PyaeNeutralPolicy,
  type TopupResponse,
  type WalletMovement,
} from "./types";

interface StoredIdempotency {
  fingerprint: string;
  response: unknown;
}

interface InternalSession extends MockSessionView {
  lastAccessedAtMs: number;
  plays: GamingPlay[];
  tickets: Map<string, GamingTicket>;
  results: GamingResult[];
  movements: WalletMovement[];
  idempotency: Map<string, StoredIdempotency>;
}

export interface MockGamingProviderOptions {
  startingBalance?: number;
  neutral500Policy?: PyaeNeutralPolicy;
  randomSource?: RandomSource;
  now?: () => Date;
  idFactory?: () => string;
  enabledInstantGameIds?: readonly InstantGameId[];
  sessionTtlMs?: number;
  maxSessions?: number;
}

export interface CreateSessionInput {
  displayName?: string;
  role?: MockRole;
}

export interface MockBootstrap {
  session: MockSessionView;
  catalog: GamingCatalog;
  plays: readonly GamingPlay[];
  results: readonly GamingResult[];
}

export const MOCK_SESSION_TTL_SECONDS = 60 * 60 * 8;
export const DEFAULT_MAX_MOCK_SESSIONS = 500;

const MOCK_SESSION_TTL_MS = MOCK_SESSION_TTL_SECONDS * 1_000;

function positiveIntegerOption(
  value: number | undefined,
  fallback: number,
  name: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) {
    throw new RangeError(`${name} debe ser un entero positivo.`);
  }
  return resolved;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function publicSession(session: InternalSession): MockSessionView {
  return {
    id: session.id,
    displayName: session.displayName,
    role: session.role,
    balance: session.balance,
    currency: session.currency,
  };
}

export class MockGamingProvider {
  private readonly sessions = new Map<string, InternalSession>();
  private readonly startingBalance: number;
  private readonly neutral500Policy: PyaeNeutralPolicy;
  private readonly randomSource: RandomSource;
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly catalog: GamingCatalog;
  private readonly drawResults: readonly GamingResult[];
  private readonly sessionTtlMs: number;
  private readonly maxSessions: number;

  constructor(options: MockGamingProviderOptions = {}) {
    this.startingBalance = options.startingBalance ?? 250_000;
    this.neutral500Policy = options.neutral500Policy ?? "REFUND";
    this.randomSource = options.randomSource ?? new ServerCryptoRandomSource();
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? randomUUID;
    this.sessionTtlMs = positiveIntegerOption(
      options.sessionTtlMs,
      MOCK_SESSION_TTL_MS,
      "sessionTtlMs",
    );
    this.maxSessions = positiveIntegerOption(
      options.maxSessions,
      DEFAULT_MAX_MOCK_SESSIONS,
      "maxSessions",
    );
    const initialNow = this.now();
    this.catalog = buildGamingCatalog(
      this.neutral500Policy,
      initialNow,
      options.enabledInstantGameIds,
    );
    this.drawResults = this.buildDrawResults(initialNow);
  }

  createSession(input: CreateSessionInput = {}): MockSessionView {
    const accessedAtMs = this.now().getTime();
    this.deleteExpiredSessions(accessedAtMs);
    const id = this.idFactory();
    const session: InternalSession = {
      id,
      displayName: input.displayName?.trim() || "Jugador",
      role: input.role ?? "PLAYER",
      balance: this.startingBalance,
      currency: CURRENCY,
      lastAccessedAtMs: accessedAtMs,
      plays: [],
      tickets: new Map(),
      results: [],
      movements: [],
      idempotency: new Map(),
    };
    this.sessions.set(id, session);
    this.enforceSessionCapacity(id);
    return clone(publicSession(session));
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  hasSession(sessionId: string | undefined): boolean {
    if (!sessionId) return false;
    return Boolean(this.findLiveSession(sessionId));
  }

  getSession(sessionId: string): MockSessionView {
    return clone(publicSession(this.requireSession(sessionId)));
  }

  getCatalog(): GamingCatalog {
    return clone(this.catalog);
  }

  getBootstrap(sessionId: string): MockBootstrap {
    return {
      session: this.getSession(sessionId),
      catalog: this.getCatalog(),
      plays: this.listPlays(sessionId),
      results: this.listResults(sessionId),
    };
  }

  placeInstantBet(
    sessionId: string,
    rawInput: unknown,
    rawIdempotencyKey: unknown,
  ): PlacePlayResponse {
    const input = instantPlayRequestSchema.parse(rawInput);
    const idempotencyKey = idempotencyKeySchema.parse(rawIdempotencyKey);
    const session = this.requireSession(sessionId);

    return this.idempotent(session, "instant", idempotencyKey, input, () => {
      const game = this.catalog.instant.find(
        (definition) => definition.id === input.gameId,
      );
      if (!game) throw new GamingDomainError("GAME_NOT_FOUND", "Juego no disponible.");

      if (session.balance < input.amount) {
        throw new GamingDomainError(
          "INSUFFICIENT_BALANCE",
          "Saldo insuficiente para registrar la jugada.",
        );
      }

      // El resultado completo se genera y evalúa antes de crear la respuesta que animará la UI.
      const resultNumbers = generateResultNumbers(game, this.randomSource);
      const evaluation = evaluateInstantPlay(
        input,
        game,
        resultNumbers,
        this.neutral500Policy,
      );
      const createdAt = this.now().toISOString();
      const playId = this.idFactory();
      const ticketId = this.idFactory();
      const result = resultNumbers.length === 1 ? resultNumbers[0] : resultNumbers.join(" · ");

      const play: GamingPlay = {
        id: playId,
        ticketId,
        family: "INSTANT",
        gameId: game.id,
        gameName: game.name,
        selection: clone(input.selection),
        drawId: null,
        amount: input.amount,
        currency: CURRENCY,
        status: evaluation.status,
        result,
        resultNumbers,
        ruleResult: evaluation.ruleResult,
        matches: evaluation.matches,
        payoutMultiplier: evaluation.payoutMultiplier,
        prize: evaluation.prize,
        createdAt,
      };

      const ticket = this.ticketFromPlay(play, ticketId, createdAt);
      const gamingResult: GamingResult = {
        id: this.idFactory(),
        source: "INSTANT",
        gameId: game.id,
        gameName: game.name,
        drawId: null,
        result,
        resultNumbers,
        occurredAt: createdAt,
      };

      session.balance -= input.amount;
      session.movements.unshift(
        this.walletMovement("STAKE", -input.amount, session.balance, playId, null, createdAt),
      );
      if (evaluation.prize > 0) {
        session.balance += evaluation.prize;
        session.movements.unshift(
          this.walletMovement(
            evaluation.status === "REFUNDED" ? "REFUND" : "PRIZE",
            evaluation.prize,
            session.balance,
            playId,
            null,
            createdAt,
          ),
        );
      }
      session.plays.unshift(play);
      session.tickets.set(ticket.id, ticket);
      session.results.unshift(gamingResult);

      return {
        play: clone(play),
        ticket: clone(ticket),
        session: { balance: session.balance, currency: session.currency },
        replayed: false,
      };
    });
  }

  placeTraditionalBet(
    sessionId: string,
    rawInput: unknown,
    rawIdempotencyKey: unknown,
  ): PlacePlayResponse {
    const input = traditionalPlayRequestSchema.parse(rawInput);
    const idempotencyKey = idempotencyKeySchema.parse(rawIdempotencyKey);
    const session = this.requireSession(sessionId);

    return this.idempotent(session, "traditional", idempotencyKey, input, () => {
      if (session.balance < input.amount) {
        throw new GamingDomainError(
          "INSUFFICIENT_BALANCE",
          "Saldo insuficiente para registrar la jugada.",
        );
      }

      const game = findTraditionalGame(input.gameId);
      if (!game) throw new GamingDomainError("GAME_NOT_FOUND", "Juego no disponible.");
      if (!game.drawIds.includes(input.drawId)) {
        throw new GamingDomainError(
          "DRAW_NOT_AVAILABLE",
          "El sorteo no está habilitado para este juego.",
        );
      }

      const createdAt = this.now().toISOString();
      const playId = this.idFactory();
      const ticketId = this.idFactory();
      const play: GamingPlay = {
        id: playId,
        ticketId,
        family: "TRADITIONAL",
        gameId: game.id,
        gameName: game.name,
        selection: clone(input.selection),
        drawId: input.drawId,
        amount: input.amount,
        currency: CURRENCY,
        status: "PENDING",
        result: null,
        resultNumbers: null,
        ruleResult: null,
        matches: null,
        payoutMultiplier: 0,
        prize: 0,
        createdAt,
      };
      const ticket = this.ticketFromPlay(play, ticketId, createdAt);

      session.balance -= input.amount;
      session.movements.unshift(
        this.walletMovement("STAKE", -input.amount, session.balance, playId, null, createdAt),
      );
      session.plays.unshift(play);
      session.tickets.set(ticket.id, ticket);

      return {
        play: clone(play),
        ticket: clone(ticket),
        session: { balance: session.balance, currency: session.currency },
        replayed: false,
      };
    });
  }

  listPlays(sessionId: string): readonly GamingPlay[] {
    return clone(this.requireSession(sessionId).plays);
  }

  listResults(sessionId: string): readonly GamingResult[] {
    const session = this.requireSession(sessionId);
    return clone([...session.results, ...this.drawResults]);
  }

  topUp(
    sessionId: string,
    rawInput: unknown,
    rawIdempotencyKey: unknown,
  ): TopupResponse {
    const input = walletTopupRequestSchema.parse(rawInput);
    const idempotencyKey = idempotencyKeySchema.parse(rawIdempotencyKey);
    const session = this.requireSession(sessionId);

    return this.idempotent(session, "wallet-topup", idempotencyKey, input, () => {
      const createdAt = this.now().toISOString();
      session.balance += input.amount;
      const balanceEntry = this.walletMovement(
        "TOPUP",
        input.amount,
        session.balance,
        null,
        input.method,
        createdAt,
      );
      session.movements.unshift(balanceEntry);

      return {
        session: clone(publicSession(session)),
        balanceEntry: clone(balanceEntry),
        replayed: false,
      };
    });
  }

  listMovements(sessionId: string): readonly WalletMovement[] {
    return clone(this.requireSession(sessionId).movements);
  }

  getTicket(sessionId: string, ticketId: string): GamingTicket {
    const ticket = this.requireSession(sessionId).tickets.get(ticketId);
    if (!ticket) {
      throw new GamingDomainError("TICKET_NOT_FOUND", "Comprobante no encontrado.");
    }
    return clone(ticket);
  }

  private requireSession(sessionId: string): InternalSession {
    const session = this.findLiveSession(sessionId);
    if (!session) {
      throw new GamingDomainError(
        "SESSION_NOT_FOUND",
        "La sesión expiró. Volvé a ingresar.",
      );
    }
    return session;
  }

  private findLiveSession(sessionId: string): InternalSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const accessedAtMs = this.now().getTime();
    if (accessedAtMs - session.lastAccessedAtMs >= this.sessionTtlMs) {
      this.sessions.delete(sessionId);
      return undefined;
    }

    session.lastAccessedAtMs = accessedAtMs;
    // Refresh Map insertion order as a deterministic LRU tie-breaker when
    // several requests happen within the same millisecond.
    this.sessions.delete(sessionId);
    this.sessions.set(sessionId, session);
    return session;
  }

  private deleteExpiredSessions(accessedAtMs: number): void {
    for (const [sessionId, session] of this.sessions) {
      if (accessedAtMs - session.lastAccessedAtMs >= this.sessionTtlMs) {
        this.sessions.delete(sessionId);
      }
    }
  }

  private enforceSessionCapacity(preservedSessionId: string): void {
    while (this.sessions.size > this.maxSessions) {
      let leastRecentlyUsedId: string | undefined;
      let leastRecentAccess = Number.POSITIVE_INFINITY;

      for (const [sessionId, session] of this.sessions) {
        if (sessionId === preservedSessionId) continue;
        if (session.lastAccessedAtMs < leastRecentAccess) {
          leastRecentlyUsedId = sessionId;
          leastRecentAccess = session.lastAccessedAtMs;
        }
      }

      if (!leastRecentlyUsedId) return;
      this.sessions.delete(leastRecentlyUsedId);
    }
  }

  private idempotent<T extends { replayed: boolean }>(
    session: InternalSession,
    operation: "instant" | "traditional" | "wallet-topup",
    key: string,
    request: unknown,
    action: () => T,
  ): T {
    const scopedKey = `${operation}:${key}`;
    const requestFingerprint = fingerprint(request);
    const stored = session.idempotency.get(scopedKey);
    if (stored) {
      if (stored.fingerprint !== requestFingerprint) {
        throw new GamingDomainError(
          "IDEMPOTENCY_CONFLICT",
          "Idempotency-Key ya fue utilizado con otra solicitud.",
        );
      }
      return { ...(clone(stored.response) as T), replayed: true };
    }

    const response = action();
    session.idempotency.set(scopedKey, {
      fingerprint: requestFingerprint,
      response: clone(response),
    });
    return response;
  }

  private walletMovement(
    type: WalletMovement["type"],
    amount: number,
    balanceAfter: number,
    referenceId: string | null,
    method: WalletMovement["method"],
    createdAt: string,
  ): WalletMovement {
    return {
      id: this.idFactory(),
      type,
      amount,
      currency: CURRENCY,
      balanceAfter,
      referenceId,
      method,
      createdAt,
    };
  }

  private ticketFromPlay(
    play: GamingPlay,
    ticketId: string,
    issuedAt: string,
  ): GamingTicket {
    return {
      id: ticketId,
      code: `QL-${ticketId.replace(/-/g, "").slice(0, 10).toUpperCase()}`,
      playId: play.id,
      gameId: play.gameId,
      gameName: play.gameName,
      family: play.family,
      selection: clone(play.selection),
      drawId: play.drawId,
      amount: play.amount,
      currency: play.currency,
      status: play.status,
      result: play.result,
      resultNumbers: play.resultNumbers,
      ruleResult: play.ruleResult,
      prize: play.prize,
      issuedAt,
    };
  }

  private buildDrawResults(now: Date): readonly GamingResult[] {
    return ["497", "208", "731", "044", "912"].map((result, index) => ({
      id: `draw-result-${index + 1}`,
      source: "DRAW" as const,
      gameId: "head" as const,
      gameName: "A la Cabeza",
      drawId: `previous-quiniela-${index + 1}`,
      result,
      resultNumbers: [result],
      occurredAt: new Date(now.getTime() - (index + 1) * 3_600_000).toISOString(),
    }));
  }
}
