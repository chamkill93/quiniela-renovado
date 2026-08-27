import { randomUUID } from "node:crypto";
import { accountLimitsSchema, accountPauseSchema, accountProfileSchema, type AccountLimits, type AccountSettings } from "@/lib/account/contracts";

import { buildGamingCatalog, buildMockDraws, findTraditionalGame } from "./catalog";
import { DAILY_DRAW_SLOTS } from "./daily-draw-schedule";
import { drawDateKey, drawWallTime } from "./draw-calendar";
import { GamingDomainError } from "./errors";
import {
  idempotencyKeySchema,
  instantPlayRequestSchema,
  traditionalPlayRequestSchema,
  walletTopupRequestSchema,
  walletWithdrawalRequestSchema,
} from "./schemas";
import {
  evaluateInstantPlay,
  generateResultNumbers,
  ServerCryptoRandomSource,
  type RandomSource,
} from "./rules";
import {
  CURRENCY,
  DRAW_POSTURE_COUNT,
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
  type WithdrawalResponse,
} from "./types";

interface StoredIdempotency {
  fingerprint: string;
  response: unknown;
}

interface InternalSession extends MockSessionView {
  lastAccessedAtMs: number;
  startedAtMs: number;
  accountLimits: AccountLimits | null;
  pausedUntilMs: number | null;
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
      startedAtMs: accessedAtMs,
      accountLimits: null,
      pausedUntilMs: null,
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

  getAccountSettings(sessionId: string): AccountSettings {
    const session = this.requireSession(sessionId);
    const nowMs = this.now().getTime();
    const amountsSince = (windowMs: number) => session.plays.reduce((sum, play) => {
      const age = nowMs - Date.parse(play.createdAt);
      return age >= 0 && age < windowMs ? sum + play.amount : sum;
    }, 0);
    return {
      sessionId, scope: "session",
      sessionStartedAt: new Date(session.startedAtMs).toISOString(),
      limits: clone(session.accountLimits),
      pausedUntil: session.pausedUntilMs && session.pausedUntilMs > nowMs ? new Date(session.pausedUntilMs).toISOString() : null,
      usage: {
        daily: amountsSince(86_400_000), weekly: amountsSince(7 * 86_400_000),
        minutes: Math.max(0, Math.floor((nowMs - session.startedAtMs) / 60_000)),
      },
    };
  }

  updateAccountProfile(sessionId: string, rawInput: unknown, rawIdempotencyKey: unknown) {
    const input = accountProfileSchema.parse(rawInput);
    const key = idempotencyKeySchema.parse(rawIdempotencyKey);
    const session = this.requireSession(sessionId);
    return this.idempotent(session, "account-profile", key, input, () => {
      session.displayName = input.displayName;
      return { session: clone(publicSession(session)), replayed: false };
    });
  }

  saveAccountLimits(sessionId: string, rawInput: unknown, rawIdempotencyKey: unknown) {
    const input = accountLimitsSchema.parse(rawInput);
    const key = idempotencyKeySchema.parse(rawIdempotencyKey);
    const session = this.requireSession(sessionId);
    return this.idempotent(session, "account-limits", key, input, () => {
      const previous = session.accountLimits;
      if (previous && (input.daily > previous.daily || input.weekly > previous.weekly || input.minutes > previous.minutes)) {
        throw new GamingDomainError("ACCOUNT_LIMIT_INCREASE", "Los límites ya establecidos solo pueden reducirse durante esta sesión.");
      }
      session.accountLimits = { ...input };
      return { settings: this.getAccountSettings(sessionId), replayed: false };
    });
  }

  pauseAccount(sessionId: string, rawInput: unknown, rawIdempotencyKey: unknown) {
    const input = accountPauseSchema.parse(rawInput);
    const key = idempotencyKeySchema.parse(rawIdempotencyKey);
    const session = this.requireSession(sessionId);
    return this.idempotent(session, "account-pause", key, input, () => {
      const pausedUntilMs = this.now().getTime() + input.durationMinutes * 60_000;
      if (session.pausedUntilMs && session.pausedUntilMs > pausedUntilMs) {
        throw new GamingDomainError("ACCOUNT_PAUSE_SHORTENED", "No podés acortar una pausa que todavía está vigente.");
      }
      session.pausedUntilMs = pausedUntilMs;
      return { settings: this.getAccountSettings(sessionId), replayed: false };
    });
  }

  private assertAccountCanPlay(session: InternalSession, amount?: number) {
    const nowMs = this.now().getTime();
    if (session.pausedUntilMs && session.pausedUntilMs > nowMs) {
      throw new GamingDomainError("ACCOUNT_PAUSED", "Tu sesión está en pausa. Podés consultar tus jugadas y tu saldo, pero no jugar ni recargar hasta que finalice.");
    }
    const limits = session.accountLimits;
    if (!limits) return;
    if (nowMs - session.startedAtMs >= limits.minutes * 60_000) {
      throw new GamingDomainError("ACCOUNT_TIME_LIMIT", "Alcanzaste el tiempo máximo de esta sesión. No podés realizar nuevas jugadas ni recargas.");
    }
    if (amount === undefined) return;
    const { usage } = this.getAccountSettings(session.id);
    if (usage.daily + amount > limits.daily || usage.weekly + amount > limits.weekly) {
      throw new GamingDomainError("ACCOUNT_AMOUNT_LIMIT", "Esta jugada supera tus autolímites. Revisalos en Cuenta antes de continuar.");
    }
  }

  getCatalog(): GamingCatalog {
    return clone({ ...this.catalog, draws: buildMockDraws(this.now()) });
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
      this.assertAccountCanPlay(session, input.amount);
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
      this.assertAccountCanPlay(session, input.amount);
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
      this.assertAccountCanPlay(session);
      const createdAt = this.now().toISOString();
      const balanceAfter = session.balance + input.amount;
      const balanceEntry = this.walletMovement(
        "TOPUP",
        input.amount,
        balanceAfter,
        null,
        input.method,
        createdAt,
      );
      session.balance = balanceAfter;
      session.movements.unshift(balanceEntry);

      return {
        session: clone(publicSession(session)),
        balanceEntry: clone(balanceEntry),
        replayed: false,
      };
    });
  }

  withdraw(
    sessionId: string,
    rawInput: unknown,
    rawIdempotencyKey: unknown,
  ): WithdrawalResponse {
    const input = walletWithdrawalRequestSchema.parse(rawInput);
    const idempotencyKey = idempotencyKeySchema.parse(rawIdempotencyKey);
    const session = this.requireSession(sessionId);

    return this.idempotent(session, "wallet-withdrawal", idempotencyKey, input, () => {
      // Account pauses and play limits must never prevent access to an available balance.
      if (session.balance < input.amount) {
        throw new GamingDomainError(
          "INSUFFICIENT_BALANCE",
          "El monto a retirar supera tu saldo disponible.",
        );
      }

      const createdAt = this.now().toISOString();
      const balanceAfter = session.balance - input.amount;
      const balanceEntry = this.walletMovement(
        "WITHDRAWAL",
        -input.amount,
        balanceAfter,
        null,
        input.method,
        createdAt,
      );
      session.balance = balanceAfter;
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

    // Initialize controls for sessions preserved across a development hot update.
    session.startedAtMs ??= accessedAtMs;
    session.accountLimits ??= null;
    session.pausedUntilMs ??= null;
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
    operation: "instant" | "traditional" | "wallet-topup" | "wallet-withdrawal" | "account-profile" | "account-limits" | "account-pause",
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
    const id = this.idFactory();
    const walletReference = type === "TOPUP"
      ? `DEP-${id.toUpperCase()}`
      : type === "WITHDRAWAL" ? `RET-${id.toUpperCase()}` : null;
    return {
      id,
      type,
      amount,
      currency: CURRENCY,
      balanceAfter,
      referenceId: referenceId ?? walletReference,
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
    // Preview-only history: ten complete past days, four draws per day.
    // Home still limits the visible history to its latest six publications.
    const examples = [
      { gameId: "head", gameName: "A la Cabeza", numbers: ["497", "208", "731", "044", "912", "083", "006", "325"] },
      { gameId: "prizes", gameName: "A los Premios", numbers: ["325", "006", "718", "462", "150", "294", "519", "602"] },
      { gameId: "invert", gameName: "Invertida", numbers: ["749", "820", "137", "404", "291", "830", "600", "253"] },
      { gameId: "redoblona", gameName: "Redoblona", numbers: ["044", "012", "083", "025", "067", "091", "015", "026"] },
    ] as const;
    const slots = [...DAILY_DRAW_SLOTS].reverse();
    const today = drawDateKey(now.getTime())!;
    const schedule = Array.from({ length: 10 }, (_, index) => index + 1).flatMap((daysAgo) => {
      const day = new Date(Date.parse(`${today}T12:00:00Z`) - daysAgo * 86_400_000).toISOString().slice(0, 10);
      return slots.map((slot) => ({ id: slot.id, at: new Date(drawWallTime(day, slot.hour, slot.minute)).toISOString() }));
    });
    const sampleNumber = (numbers: readonly string[], index: number) => {
      const cycle = Math.floor(index / numbers.length);
      return cycle === 0 ? numbers[index]
        : String((Number(numbers[index % numbers.length]) + cycle * 137) % 999 + 1).padStart(3, "0");
    };
    // One canonical preview draw per date and slot; no real result is generated here.
    const drawNumbersByDraw = schedule.map((slot, index) => {
      const seed = Array.from(`${slot.at}:${slot.id}`).reduce(
        (value, character) => (value * 31 + character.charCodeAt(0)) % 1000,
        0,
      );
      return Array.from({ length: DRAW_POSTURE_COUNT }, (_, postureIndex) => ({
        position: postureIndex + 1,
        value: postureIndex === 0 ? sampleNumber(examples[0].numbers, index)
          : String((seed + postureIndex * 137) % 1000).padStart(3, "0"),
      }));
    });
    return examples.flatMap(({ gameId, gameName, numbers }) => schedule.map((slot, index) => {
      // Preserve legacy modality fields used by Home and other existing views.
      const result = sampleNumber(numbers, index);
      return {
      id: `draw-result-${gameId}-${index + 1}`,
      source: "DRAW" as const,
      gameId,
      gameName,
      drawId: slot.id,
      result,
      resultNumbers: [result],
      drawNumbers: drawNumbersByDraw[index],
      occurredAt: slot.at,
      };
    }));
  }
}
