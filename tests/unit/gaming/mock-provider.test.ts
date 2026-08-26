import { describe, expect, it } from "vitest";

import { GamingDomainError } from "../../../src/lib/gaming/errors";
import {
  MockGamingProvider,
  MOCK_SESSION_TTL_SECONDS,
} from "../../../src/lib/gaming/mock-provider";
import type { RandomSource } from "../../../src/lib/gaming/rules";
import type { InstantGameId } from "../../../src/lib/gaming/types";

class SequenceRandomSource implements RandomSource {
  private index = 0;

  constructor(private readonly values: readonly number[]) {}

  intInclusive(min: number, max: number): number {
    const value = this.values[this.index++] ?? min;
    if (value < min || value > max) throw new Error("test value out of range");
    return value;
  }
}

function providerWithResults(
  values: readonly number[],
  startingBalance = 250_000,
  enabledInstantGameIds?: readonly InstantGameId[],
) {
  let id = 0;
  return new MockGamingProvider({
    startingBalance,
    randomSource: new SequenceRandomSource(values),
    now: () => new Date("2026-08-25T12:00:00.000Z"),
    idFactory: () => `test-id-${++id}`,
    enabledInstantGameIds,
  });
}

describe("MockGamingProvider", () => {
  it("expires idle sessions with the same sliding eight-hour lifetime as the cookie", () => {
    let currentTimeMs = Date.parse("2026-08-25T12:00:00.000Z");
    let id = 0;
    const provider = new MockGamingProvider({
      now: () => new Date(currentTimeMs),
      idFactory: () => `session-${++id}`,
    });
    const idleSession = provider.createSession();
    const activeSession = provider.createSession();
    const ttlMs = MOCK_SESSION_TTL_SECONDS * 1_000;

    currentTimeMs += ttlMs - 1;
    expect(provider.hasSession(activeSession.id)).toBe(true);

    currentTimeMs += 1;
    expect(provider.hasSession(idleSession.id)).toBe(false);
    expect(() => provider.getSession(idleSession.id)).toThrowError(
      expect.objectContaining({ code: "SESSION_NOT_FOUND" }),
    );
    expect(provider.hasSession(activeSession.id)).toBe(true);

    currentTimeMs += ttlMs;
    expect(provider.hasSession(activeSession.id)).toBe(false);
  });

  it("evicts the least recently used session at capacity and preserves active state", () => {
    const currentTimeMs = Date.parse("2026-08-25T12:00:00.000Z");
    let id = 0;
    const provider = new MockGamingProvider({
      now: () => new Date(currentTimeMs),
      idFactory: () => `session-${++id}`,
      maxSessions: 2,
    });
    const firstSession = provider.createSession();
    const leastRecentlyUsedSession = provider.createSession();

    provider.topUp(
      firstSession.id,
      { amount: 50_000, method: "CARD" },
      "keep-active-session",
    );

    const newestSession = provider.createSession();

    expect(provider.hasSession(leastRecentlyUsedSession.id)).toBe(false);
    expect(provider.getSession(firstSession.id).balance).toBe(300_000);
    expect(provider.hasSession(newestSession.id)).toBe(true);
  });

  it("keeps balance authoritative and replays an idempotent instant bet once", () => {
    const provider = providerWithResults([0]);
    const session = provider.createSession();
    const request = { gameId: "sapyaite", amount: 500, selection: "000" };

    const first = provider.placeInstantBet(session.id, request, "instant-key-001");
    const replay = provider.placeInstantBet(session.id, request, "instant-key-001");

    expect(first.play.result).toBe("000");
    expect(first.play.status).toBe("WON");
    expect(first.play.payoutMultiplier).toBe(700);
    expect(first.play.prize).toBe(350_000);
    expect(first.session.balance).toBe(599_500);
    expect(replay).toMatchObject({
      replayed: true,
      play: { id: first.play.id },
      session: { balance: 599_500 },
    });
    expect(provider.listPlays(session.id)).toHaveLength(1);
    expect(provider.listResults(session.id)[0]).toMatchObject({
      source: "INSTANT",
      result: "000",
    });
    expect(provider.listMovements(session.id)).toMatchObject([
      { type: "PRIZE", amount: 350_000, balanceAfter: 599_500 },
      { type: "STAKE", amount: -500, balanceAfter: 249_500 },
    ]);
  });

  it("rejects reuse of an idempotency key with a different request", () => {
    const provider = providerWithResults([7]);
    const session = provider.createSession();
    provider.placeInstantBet(
      session.id,
      { gameId: "sapyaite", amount: 500, selection: "007" },
      "instant-key-002",
    );

    expect(() =>
      provider.placeInstantBet(
        session.id,
        { gameId: "sapyaite", amount: 1_000, selection: "007" },
        "instant-key-002",
      ),
    ).toThrowError(GamingDomainError);
    expect(provider.listPlays(session.id)).toHaveLength(1);
  });

  it("rechaza juegos instantáneos omitidos por el catálogo sin debitar saldo", () => {
    const provider = providerWithResults([684], 250_000, ["sapyaite"]);
    const session = provider.createSession();
    const initialResults = provider.listResults(session.id);

    expect(provider.getCatalog().instant.map((game) => game.id)).toEqual([
      "sapyaite",
    ]);
    expect(() =>
      provider.placeInstantBet(
        session.id,
        { gameId: "poa", amount: 500, selection: "001-099" },
        "instant-disabled-001",
      ),
    ).toThrowError(expect.objectContaining({ code: "GAME_NOT_FOUND" }));
    expect(provider.getSession(session.id).balance).toBe(250_000);
    expect(provider.listPlays(session.id)).toHaveLength(0);
    expect(provider.listResults(session.id)).toEqual(initialResults);
  });

  it("registers a traditional bet as pending and creates a recoverable ticket", () => {
    const provider = providerWithResults([]);
    const session = provider.createSession();
    const response = provider.placeTraditionalBet(
      session.id,
      {
        gameId: "head",
        amount: 500,
        drawId: "early",
        selection: { number: "007" },
      },
      "traditional-key-001",
    );

    expect(response).toMatchObject({
      play: { status: "PENDING", result: null },
      session: { balance: 249_500 },
    });
    expect(provider.getTicket(session.id, response.ticket.id)).toEqual(response.ticket);
  });

  it("does not debit or create a play when balance is insufficient", () => {
    const provider = providerWithResults([497], 0);
    const session = provider.createSession();

    expect(() =>
      provider.placeInstantBet(
        session.id,
        { gameId: "mbohapy", amount: 500, selection: "497" },
        "instant-key-003",
      ),
    ).toThrowError(GamingDomainError);
    expect(provider.getSession(session.id).balance).toBe(0);
    expect(provider.listPlays(session.id)).toHaveLength(0);
  });

  it("creates PLAYER by default and permits an explicit ADMIN showcase session", () => {
    const provider = providerWithResults([]);

    expect(provider.createSession().role).toBe("PLAYER");
    expect(provider.createSession({ role: "ADMIN" }).role).toBe("ADMIN");
  });

  it("credits a top-up once and records an authoritative wallet movement", () => {
    const provider = providerWithResults([]);
    const session = provider.createSession();
    const request = { amount: 50_000, method: "CARD" };

    const first = provider.topUp(session.id, request, "wallet-topup-001");
    const replay = provider.topUp(session.id, request, "wallet-topup-001");

    expect(first).toMatchObject({
      session: { balance: 300_000, currency: "PYG" },
      balanceEntry: {
        type: "TOPUP",
        amount: 50_000,
        balanceAfter: 300_000,
        method: "CARD",
      },
      replayed: false,
    });
    expect(replay).toMatchObject({
      session: { balance: 300_000 },
      balanceEntry: { id: first.balanceEntry.id },
      replayed: true,
    });
    expect(provider.getSession(session.id).balance).toBe(300_000);
    expect(provider.listMovements(session.id)).toEqual([first.balanceEntry]);
  });
});
