import { describe, expect, it } from "vitest";

import { GamingDomainError } from "../../../src/lib/gaming/errors";
import { MockGamingProvider } from "../../../src/lib/gaming/mock-provider";
import type { RandomSource } from "../../../src/lib/gaming/rules";

class SequenceRandomSource implements RandomSource {
  private index = 0;

  constructor(private readonly values: readonly number[]) {}

  intInclusive(min: number, max: number): number {
    const value = this.values[this.index++] ?? min;
    if (value < min || value > max) throw new Error("test value out of range");
    return value;
  }
}

function providerWithResults(values: readonly number[], startingBalance = 250_000) {
  let id = 0;
  return new MockGamingProvider({
    startingBalance,
    randomSource: new SequenceRandomSource(values),
    now: () => new Date("2026-08-25T12:00:00.000Z"),
    idFactory: () => `test-id-${++id}`,
  });
}

describe("MockGamingProvider", () => {
  it("keeps balance authoritative and replays an idempotent instant bet once", () => {
    const provider = providerWithResults([684]);
    const session = provider.createSession();
    const request = { gameId: "sapyaite", amount: 500, selection: "PAR" };

    const first = provider.placeInstantBet(session.id, request, "instant-key-001");
    const replay = provider.placeInstantBet(session.id, request, "instant-key-001");

    expect(first.play.result).toBe("684");
    expect(first.play.status).toBe("WON");
    expect(first.session.balance).toBe(250_500);
    expect(replay).toMatchObject({
      replayed: true,
      play: { id: first.play.id },
      session: { balance: 250_500 },
    });
    expect(provider.listPlays(session.id)).toHaveLength(1);
    expect(provider.listResults(session.id)[0]).toMatchObject({
      source: "INSTANT",
      result: "684",
    });
    expect(provider.listMovements(session.id)).toMatchObject([
      { type: "PRIZE", amount: 1_000, balanceAfter: 250_500 },
      { type: "STAKE", amount: -500, balanceAfter: 249_500 },
    ]);
  });

  it("rejects reuse of an idempotency key with a different request", () => {
    const provider = providerWithResults([684]);
    const session = provider.createSession();
    provider.placeInstantBet(
      session.id,
      { gameId: "sapyaite", amount: 500, selection: "PAR" },
      "instant-key-002",
    );

    expect(() =>
      provider.placeInstantBet(
        session.id,
        { gameId: "sapyaite", amount: 1_000, selection: "PAR" },
        "instant-key-002",
      ),
    ).toThrowError(GamingDomainError);
    expect(provider.listPlays(session.id)).toHaveLength(1);
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
