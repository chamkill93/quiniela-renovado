import { describe, expect, it } from "vitest";

import { GamingDomainError } from "../../../src/lib/gaming/errors";
import {
  MockGamingProvider,
  MOCK_SESSION_TTL_SECONDS,
} from "../../../src/lib/gaming/mock-provider";
import type { RandomSource } from "../../../src/lib/gaming/rules";
import { DRAW_POSTURE_COUNT, type InstantGameId } from "../../../src/lib/gaming/types";

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

const traditionalSelections = [
  { gameId: "head", selection: { number: "007" } },
  { gameId: "prizes", selection: { number: "007", position: 14 } },
  { gameId: "invert", selection: { number: "017", position: 1 } },
  { gameId: "redoblona", selection: { initialNumber: "07", initialUntil: 1, redoblonaNumber: "00", redoblonaUntil: 7 } },
] as const;

describe("MockGamingProvider", () => {
  it("provides ten full days of four draws per modality in the sample history", () => {
    const provider = providerWithResults([]);
    const session = provider.createSession();
    const history = provider.listResults(session.id);
    expect(new Set(history.map((result) => result.id)).size).toBe(160);
    for (const id of ["head", "prizes", "invert", "redoblona"]) {
      const results = history.filter((result) => result.gameId === id);
      expect(results).toHaveLength(40);
      expect(results.map((result) => result.drawId)).toEqual(Array.from({ length: 10 }, () => ["night", "evening", "morning", "early"]).flat());
      expect(results[0].result).not.toBe(results[8].result);
      expect(results.every((result) => result.source === "DRAW")).toBe(true);
      expect(results.map((result) => result.occurredAt)).toEqual(results.map((result) => result.occurredAt).sort().reverse());
    }
  });

  it("shares one complete positioned draw across modalities with consistent legacy numbers and dated IDs", () => {
    const provider = providerWithResults([]);
    const history = provider.listResults(provider.createSession().id);
    const positions = Array.from({ length: DRAW_POSTURE_COUNT }, (_, index) => index + 1);
    const heads = history.filter((result) => result.gameId === "head");

    for (const head of heads) {
      const publications = history.filter((result) => result.drawId === head.drawId && result.occurredAt === head.occurredAt);
      expect(publications).toHaveLength(4);
      expect(head.drawNumbers?.map((number) => number.position)).toEqual(positions);
      expect(head.drawNumbers?.[0]).toEqual({ position: 1, value: head.result });
      expect(head.drawNumbers?.every((number) => /^\d{3}$/.test(number.value))).toBe(true);
      for (const publication of publications) {
        expect(publication.drawNumbers).toEqual(head.drawNumbers);
        expect(publication.result).toBe(head.result);
        expect(publication.resultNumbers).toEqual([publication.result]);
      }
    }

    for (const gameId of ["head", "prizes", "invert", "redoblona"]) {
      const publications = history.filter((result) => result.gameId === gameId);
      expect(publications[0]).toMatchObject({ id: `draw-result-2026-08-24-night-${gameId}` });
      expect(publications[8]).toMatchObject({ id: `draw-result-2026-08-22-night-${gameId}` });
    }
  });

  it("keeps preview draw positions deterministic and isolated from caller mutations", () => {
    const provider = providerWithResults([]);
    const session = provider.createSession();
    const history = provider.listResults(session.id);
    const anotherProvider = providerWithResults([]);
    const identicalHistory = anotherProvider.listResults(anotherProvider.createSession().id);
    expect(history).toEqual(identicalHistory);

    history[0].drawNumbers![0].value = "changed-by-consumer";
    expect(provider.listResults(session.id)).toEqual(identicalHistory);
  });

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

  it.each(traditionalSelections)("charges $gameId once and creates a recoverable pending ticket", ({ gameId, selection }) => {
    const provider = providerWithResults([]);
    const session = provider.createSession();
    const initialResults = provider.listResults(session.id);
    const input = { gameId, amount: 500, drawId: "early", selection };
    const response = provider.placeTraditionalBet(
      session.id,
      input,
      "traditional-key-001",
    );
    const replay = provider.placeTraditionalBet(session.id, input, "traditional-key-001");

    expect(response).toMatchObject({
      play: { gameId, amount: 500, selection, status: "PENDING", result: null },
      session: { balance: 249_500 },
    });
    expect(replay).toEqual({ ...response, replayed: true });
    expect(provider.getSession(session.id).balance).toBe(249_500);
    expect(provider.listPlays(session.id)).toEqual([response.play]);
    expect(provider.listResults(session.id)).toEqual(initialResults);
    expect(provider.listMovements(session.id)).toMatchObject([
      { type: "STAKE", amount: -500, balanceAfter: 249_500, referenceId: response.play.id },
    ]);
    expect(provider.getTicket(session.id, response.ticket.id)).toEqual(response.ticket);
  });

  it.each(traditionalSelections)("does not debit or register $gameId when the balance is insufficient", ({ gameId, selection }) => {
    const provider = providerWithResults([], 499);
    const session = provider.createSession();
    const initialResults = provider.listResults(session.id);
    const input = { gameId, amount: 500, drawId: "early", selection };

    expect(() => provider.placeTraditionalBet(session.id, input, "traditional-insufficient"))
      .toThrowError(expect.objectContaining({ code: "INSUFFICIENT_BALANCE" }));
    expect(provider.getSession(session.id).balance).toBe(499);
    expect(provider.listPlays(session.id)).toEqual([]);
    expect(provider.listMovements(session.id)).toEqual([]);
    expect(provider.listResults(session.id)).toEqual(initialResults);
  });

  it("does not debit for an invalid traditional selection, amount or draw", () => {
    const provider = providerWithResults([]);
    const session = provider.createSession();
    const input = { gameId: "head", amount: 500, drawId: "early", selection: { number: "007" } };

    expect(() => provider.placeTraditionalBet(session.id, { ...input, selection: { number: "000" } }, "traditional-bad-number")).toThrow();
    expect(() => provider.placeTraditionalBet(session.id, { ...input, amount: 499 }, "traditional-bad-amount")).toThrow();
    expect(() => provider.placeTraditionalBet(session.id, { ...input, drawId: "unavailable" }, "traditional-bad-draw"))
      .toThrowError(expect.objectContaining({ code: "DRAW_NOT_AVAILABLE" }));
    expect(provider.getSession(session.id).balance).toBe(250_000);
    expect(provider.listPlays(session.id)).toEqual([]);
    expect(provider.listMovements(session.id)).toEqual([]);
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
    expect(first.balanceEntry.referenceId).toMatch(/^DEP-/);
  });

  it("starts the wallet history empty without inventing deposits for the opening balance", () => {
    const provider = providerWithResults([]);
    const session = provider.createSession();
    expect(session.balance).toBe(250_000);
    expect(provider.listMovements(session.id)).toEqual([]);
  });

  it.each(["CARD", "QR", "CASH_POINT", "TIGO", "CLARO", "PERSONAL", "BANK_TRANSFER", "PUNTO_RECARGA"])(
    "records deposits and withdrawals through %s in reverse chronological order",
    (method) => {
      const provider = providerWithResults([]);
      const session = provider.createSession();
      const deposit = provider.topUp(session.id, { amount: 75_000, method }, "channel-deposit");
      const withdrawal = provider.withdraw(session.id, { amount: 25_000, method }, "channel-withdrawal");

      expect(deposit.balanceEntry).toMatchObject({
        type: "TOPUP", amount: 75_000, balanceAfter: 325_000, method,
        referenceId: expect.stringMatching(/^DEP-/),
      });
      expect(withdrawal).toMatchObject({
        session: { id: session.id, balance: 300_000, currency: "PYG" },
        balanceEntry: {
          type: "WITHDRAWAL", amount: -25_000, balanceAfter: 300_000, method,
          referenceId: expect.stringMatching(/^RET-/),
        },
        replayed: false,
      });
      expect(provider.listMovements(session.id)).toEqual([withdrawal.balanceEntry, deposit.balanceEntry]);
      expect(withdrawal.balanceEntry.referenceId).not.toBe(deposit.balanceEntry.referenceId);
      expect(provider.getSession(session.id).balance).toBe(300_000);
    },
  );

  it("withdraws the entire available balance once and replays without another debit", () => {
    const provider = providerWithResults([], 20_000);
    const session = provider.createSession();
    const input = { amount: 20_000, method: "QR" };
    const first = provider.withdraw(session.id, input, "withdraw-entire-balance");

    expect(first.balanceEntry).toMatchObject({ type: "WITHDRAWAL", amount: -20_000, balanceAfter: 0 });
    expect(provider.withdraw(session.id, input, "withdraw-entire-balance")).toEqual({ ...first, replayed: true });
    expect(() => provider.withdraw(session.id, input, "withdraw-another-time"))
      .toThrowError(expect.objectContaining({ code: "INSUFFICIENT_BALANCE" }));
    expect(provider.getSession(session.id).balance).toBe(0);
    expect(provider.listMovements(session.id)).toEqual([first.balanceEntry]);
  });

  it("does not mutate or reserve an idempotency key when a withdrawal is rejected", () => {
    const provider = providerWithResults([], 10_000);
    const session = provider.createSession();
    const input = { amount: 25_000, method: "TIGO" };

    expect(() => provider.withdraw(session.id, input, "withdraw-after-funding"))
      .toThrowError(expect.objectContaining({ code: "INSUFFICIENT_BALANCE" }));
    expect(provider.getSession(session.id)).toEqual(session);
    expect(provider.listMovements(session.id)).toEqual([]);
    provider.topUp(session.id, { amount: 20_000, method: "CARD" }, "fund-wallet-for-retry");
    expect(provider.withdraw(session.id, input, "withdraw-after-funding")).toMatchObject({
      session: { balance: 5_000 }, replayed: false,
    });
  });

  it.each(["topUp", "withdraw"] as const)(
    "rejects changes of amount or channel when replaying %s",
    (operation) => {
      const provider = providerWithResults([]);
      const session = provider.createSession();
      const input = { amount: 20_000, method: "QR" };
      const first = provider[operation](session.id, input, "wallet-request-identity");

      for (const changed of [{ ...input, amount: 30_000 }, { ...input, method: "CLARO" }]) {
        expect(() => provider[operation](session.id, changed, "wallet-request-identity"))
          .toThrowError(expect.objectContaining({ code: "IDEMPOTENCY_CONFLICT" }));
      }
      expect(provider.getSession(session.id)).toEqual(first.session);
      expect(provider.listMovements(session.id)).toEqual([first.balanceEntry]);
    },
  );

  it("scopes idempotency by operation and session and keeps replay snapshots isolated", () => {
    const provider = providerWithResults([]);
    const session = provider.createSession();
    const other = provider.createSession();
    const input = { amount: 20_000, method: "PERSONAL" };
    const deposit = provider.topUp(session.id, input, "shared-operation-key");
    const withdrawal = provider.withdraw(session.id, input, "shared-operation-key");
    const otherWithdrawal = provider.withdraw(other.id, input, "shared-operation-key");

    deposit.balanceEntry.amount = 999_999;
    const replay = provider.topUp(session.id, input, "shared-operation-key");
    expect(replay.balanceEntry.amount).toBe(20_000);
    expect(provider.withdraw(session.id, input, "shared-operation-key")).toEqual({ ...withdrawal, replayed: true });
    expect(provider.getSession(session.id).balance).toBe(250_000);
    expect(provider.getSession(other.id).balance).toBe(230_000);
    expect(provider.listMovements(other.id)).toEqual([otherWithdrawal.balanceEntry]);
    expect(new Set(provider.listMovements(session.id).map((movement) => movement.referenceId)).size).toBe(2);
  });

  it.each(["topUp", "withdraw"] as const)("requires a live session for %s", (operation) => {
    const provider = providerWithResults([]);
    expect(() => provider[operation]("missing-session", { amount: 20_000, method: "CARD" }, "unknown-session-key"))
      .toThrowError(expect.objectContaining({ code: "SESSION_NOT_FOUND" }));
  });
});
