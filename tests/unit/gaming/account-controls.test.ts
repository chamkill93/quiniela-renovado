import { describe, expect, it, vi } from "vitest";
import { MockGamingProvider } from "@/lib/gaming/mock-provider";

const START = Date.parse("2026-08-25T12:00:00.000Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const instant = { gameId: "sapyaite", amount: 500, selection: "007" };
const traditional = { gameId: "head", amount: 500, drawId: "early", selection: { number: "007" } };
const topup = { amount: 50_000, method: "CARD" };

function setup() {
  let nowMs = START;
  let id = 0;
  const random = vi.fn(() => 7);
  const provider = new MockGamingProvider({
    now: () => new Date(nowMs),
    idFactory: () => `account-test-${++id}`,
    randomSource: { intInclusive: random },
    sessionTtlMs: 9 * DAY,
  });
  const session = provider.createSession({ displayName: "Ana" });
  return { provider, session, random, advance: (ms: number) => { nowMs += ms; } };
}

describe("server account controls", () => {
  it("starts with session-scoped settings and isolates mutable response values", () => {
    const { provider, session } = setup();
    expect(provider.getAccountSettings(session.id)).toEqual({
      sessionId: session.id,
      scope: "session",
      sessionStartedAt: new Date(START).toISOString(),
      limits: null,
      pausedUntil: null,
      usage: { daily: 0, weekly: 0, minutes: 0 },
    });
    const limits = { daily: 1_000, weekly: 2_000, minutes: 60 };
    const saved = provider.saveAccountLimits(session.id, limits, "limits-initial");
    saved.settings.limits!.daily = 999_999;
    saved.settings.usage.daily = 999_999;
    expect(provider.getAccountSettings(session.id)).toMatchObject({ limits, usage: { daily: 0 } });
  });

  it("updates only the visible name and replays without applying an old edit again", () => {
    const { provider, session } = setup();
    provider.topUp(session.id, topup, "profile-topup");
    const movements = provider.listMovements(session.id);
    const input = { displayName: "  Ana López  " };
    const first = provider.updateAccountProfile(session.id, input, "profile-first");
    expect(first).toEqual({ session: { ...session, displayName: "Ana López", balance: 300_000 }, replayed: false });
    provider.updateAccountProfile(session.id, { displayName: "Ana Pérez" }, "profile-second");
    expect(provider.updateAccountProfile(session.id, input, "profile-first")).toMatchObject({ replayed: true });
    expect(provider.getSession(session.id)).toEqual({ ...session, displayName: "Ana Pérez", balance: 300_000 });
    expect(provider.listMovements(session.id)).toEqual(movements);
    expect(provider.listPlays(session.id)).toEqual([]);
  });

  it.each(["", " ", "A", "x".repeat(81)])("rejects invalid profile names without modifying the session: %j", (displayName) => {
    const { provider, session } = setup();
    expect(() => provider.updateAccountProfile(session.id, { displayName }, "invalid-profile")).toThrow();
    expect(provider.getSession(session.id)).toEqual(session);
  });

  it("allows only equal or reduced limits, including on an idempotent replay", () => {
    const { provider, session } = setup();
    const original = { daily: 1_000, weekly: 2_000, minutes: 60 };
    provider.saveAccountLimits(session.id, original, "limits-original");
    for (const [field, value] of [["daily", 1_500], ["weekly", 3_000], ["minutes", 120]] as const) {
      expect(() => provider.saveAccountLimits(session.id, { ...original, [field]: value }, `increase-${field}`))
        .toThrowError(expect.objectContaining({ code: "ACCOUNT_LIMIT_INCREASE" }));
      expect(provider.getAccountSettings(session.id).limits).toEqual(original);
    }
    const reduced = { daily: 500, weekly: 1_000, minutes: 30 };
    provider.saveAccountLimits(session.id, reduced, "limits-reduced");
    expect(provider.saveAccountLimits(session.id, original, "limits-original").replayed).toBe(true);
    expect(provider.getAccountSettings(session.id).limits).toEqual(reduced);
    expect(() => provider.saveAccountLimits(session.id, reduced, "limits-original"))
      .toThrowError(expect.objectContaining({ code: "IDEMPOTENCY_CONFLICT" }));
  });

  it.each([
    { daily: 0, weekly: 1_000, minutes: 60 },
    { daily: 500.5, weekly: 1_000, minutes: 60 },
    { daily: 1_000, weekly: 500, minutes: 60 },
    { daily: 500, weekly: 1_000, minutes: 45 },
    { daily: 500, weekly: Number.MAX_SAFE_INTEGER + 1, minutes: 60 },
  ])("rejects invalid limits without activating any restriction: %j", (limits) => {
    const { provider, session } = setup();
    expect(() => provider.saveAccountLimits(session.id, limits, "limits-invalid")).toThrow();
    expect(provider.getAccountSettings(session.id).limits).toBeNull();
  });

  it("shares stake ceilings across instant and traditional plays without offsetting prizes", () => {
    const { provider, session, random } = setup();
    provider.saveAccountLimits(session.id, { daily: 1_000, weekly: 1_000, minutes: 60 }, "limits-stakes");
    provider.placeInstantBet(session.id, instant, "stake-instant");
    provider.placeTraditionalBet(session.id, traditional, "stake-traditional");
    expect(provider.getAccountSettings(session.id).usage).toEqual({ daily: 1_000, weekly: 1_000, minutes: 0 });
    const before = provider.getBootstrap(session.id);
    const movements = provider.listMovements(session.id);
    for (const attempt of [
      () => provider.placeInstantBet(session.id, instant, "excess-instant"),
      () => provider.placeTraditionalBet(session.id, traditional, "excess-traditional"),
    ]) {
      expect(attempt).toThrowError(expect.objectContaining({ code: "ACCOUNT_AMOUNT_LIMIT" }));
    }
    expect(provider.getBootstrap(session.id)).toEqual(before);
    expect(provider.listMovements(session.id)).toEqual(movements);
    expect(random).toHaveBeenCalledTimes(1);
    // Stake ceilings are not deposit ceilings; a top-up does not reset usage.
    provider.topUp(session.id, topup, "topup-after-ceiling");
    expect(provider.getAccountSettings(session.id).usage.daily).toBe(1_000);
  });

  it("counts accepted plays from before limits were saved and ignores rejected plays", () => {
    const { provider, session } = setup();
    expect(() => provider.placeInstantBet(session.id, { ...instant, amount: 1 }, "invalid-stake")).toThrow();
    expect(provider.getAccountSettings(session.id).usage.daily).toBe(0);
    provider.placeTraditionalBet(session.id, { ...traditional, amount: 1_000 }, "previous-stake");
    const saved = provider.saveAccountLimits(session.id, { daily: 500, weekly: 1_000, minutes: 60 }, "limits-after-play");
    expect(saved.settings.usage.daily).toBe(1_000);
    expect(() => provider.placeInstantBet(session.id, instant, "after-lower-limit"))
      .toThrowError(expect.objectContaining({ code: "ACCOUNT_AMOUNT_LIMIT" }));
    expect(provider.listPlays(session.id)).toHaveLength(1);
  });

  it("uses immutable session time and blocks new plays and deposits at the exact boundary", () => {
    const { provider, session, random, advance } = setup();
    provider.saveAccountLimits(session.id, { daily: 10_000, weekly: 20_000, minutes: 15 }, "limits-time");
    advance(15 * MINUTE - 1);
    provider.getSession(session.id);
    expect(provider.getAccountSettings(session.id)).toMatchObject({ sessionStartedAt: new Date(START).toISOString(), usage: { minutes: 14 } });
    advance(1);
    for (const attempt of [
      () => provider.placeInstantBet(session.id, instant, "time-instant"),
      () => provider.placeTraditionalBet(session.id, traditional, "time-traditional"),
      () => provider.topUp(session.id, topup, "time-topup"),
    ]) {
      expect(attempt).toThrowError(expect.objectContaining({ code: "ACCOUNT_TIME_LIMIT" }));
    }
    expect(provider.getSession(session.id)).toEqual(session);
    expect(provider.listMovements(session.id)).toEqual([]);
    expect(provider.listPlays(session.id)).toEqual([]);
    expect(random).not.toHaveBeenCalled();
  });

  it("blocks new plays and top-ups during a pause while keeping reads and profile access", () => {
    const { provider, session, random } = setup();
    const accepted = provider.placeTraditionalBet(session.id, traditional, "before-pause");
    provider.pauseAccount(session.id, { durationMinutes: 15 }, "pause-account");
    const before = provider.getBootstrap(session.id);
    const movements = provider.listMovements(session.id);
    for (const attempt of [
      () => provider.placeInstantBet(session.id, instant, "paused-instant"),
      () => provider.placeTraditionalBet(session.id, traditional, "paused-traditional"),
      () => provider.topUp(session.id, topup, "paused-topup"),
    ]) {
      expect(attempt).toThrowError(expect.objectContaining({ code: "ACCOUNT_PAUSED" }));
    }
    expect(provider.getBootstrap(session.id)).toEqual(before);
    expect(provider.getTicket(session.id, accepted.ticket.id)).toEqual(accepted.ticket);
    expect(provider.listMovements(session.id)).toEqual(movements);
    expect(random).not.toHaveBeenCalled();
    expect(provider.updateAccountProfile(session.id, { displayName: "Ana López" }, "paused-profile").session.displayName).toBe("Ana López");
    expect(provider.getAccountSettings(session.id).pausedUntil).not.toBeNull();
  });

  it("expires a pause at the exact boundary and then permits a fresh operation", () => {
    const { provider, session, advance } = setup();
    provider.pauseAccount(session.id, { durationMinutes: 15 }, "pause-expiry");
    advance(15 * MINUTE - 1);
    expect(() => provider.topUp(session.id, topup, "retry-after-pause"))
      .toThrowError(expect.objectContaining({ code: "ACCOUNT_PAUSED" }));
    advance(1);
    expect(provider.getAccountSettings(session.id).pausedUntil).toBeNull();
    expect(provider.topUp(session.id, topup, "retry-after-pause").replayed).toBe(false);
    expect(provider.placeInstantBet(session.id, instant, "play-after-pause").replayed).toBe(false);
  });

  it("permits withdrawals during a pause and after reaching play limits without resetting them", () => {
    const { provider, session, advance } = setup();
    provider.placeTraditionalBet(session.id, traditional, "withdrawal-before-limits");
    provider.saveAccountLimits(session.id, { daily: 500, weekly: 500, minutes: 15 }, "withdrawal-limits");
    provider.pauseAccount(session.id, { durationMinutes: 60 }, "withdrawal-pause");
    advance(15 * MINUTE);
    const settings = provider.getAccountSettings(session.id);

    const result = provider.withdraw(session.id, { amount: 20_000, method: "CASH_POINT" }, "withdrawal-during-pause");
    expect(result.session.balance).toBe(229_500);
    expect(result.balanceEntry.type).toBe("WITHDRAWAL");
    expect(provider.getAccountSettings(session.id)).toEqual(settings);
    expect(provider.listPlays(session.id)).toHaveLength(1);
    expect(() => provider.topUp(session.id, topup, "blocked-deposit-after-withdrawal"))
      .toThrowError(expect.objectContaining({ code: "ACCOUNT_PAUSED" }));
  });

  it("cannot shorten a pause or extend it accidentally retrying the same request", () => {
    const { provider, session, advance } = setup();
    const first = provider.pauseAccount(session.id, { durationMinutes: 30 }, "pause-thirty");
    advance(MINUTE);
    expect(provider.pauseAccount(session.id, { durationMinutes: 30 }, "pause-thirty")).toMatchObject({ ...first, replayed: true });
    expect(provider.getAccountSettings(session.id).pausedUntil).toBe(new Date(START + 30 * MINUTE).toISOString());
    expect(() => provider.pauseAccount(session.id, { durationMinutes: 15 }, "pause-shorter"))
      .toThrowError(expect.objectContaining({ code: "ACCOUNT_PAUSE_SHORTENED" }));
    expect(() => provider.pauseAccount(session.id, { durationMinutes: 0 }, "pause-invalid")).toThrow();
    expect(provider.pauseAccount(session.id, { durationMinutes: 60 }, "pause-longer").settings.pausedUntil)
      .toBe(new Date(START + 61 * MINUTE).toISOString());
  });

  it("replays accepted financial operations after restrictions without another debit or credit", () => {
    const { provider, session, random, advance } = setup();
    const play = provider.placeInstantBet(session.id, instant, "replay-instant");
    const drawPlay = provider.placeTraditionalBet(session.id, traditional, "replay-traditional");
    const deposit = provider.topUp(session.id, topup, "replay-deposit");
    provider.saveAccountLimits(session.id, { daily: 500, weekly: 500, minutes: 15 }, "replay-limits");
    provider.pauseAccount(session.id, { durationMinutes: 30 }, "replay-pause");
    advance(15 * MINUTE);
    const before = provider.getSession(session.id);
    const movements = provider.listMovements(session.id);
    expect(provider.placeInstantBet(session.id, instant, "replay-instant")).toEqual({ ...play, replayed: true });
    expect(provider.placeTraditionalBet(session.id, traditional, "replay-traditional")).toEqual({ ...drawPlay, replayed: true });
    expect(provider.topUp(session.id, topup, "replay-deposit")).toEqual({ ...deposit, replayed: true });
    expect(provider.getSession(session.id)).toEqual(before);
    expect(provider.listMovements(session.id)).toEqual(movements);
    expect(provider.getAccountSettings(session.id).usage).toEqual({ daily: 1_000, weekly: 1_000, minutes: 15 });
    expect(random).toHaveBeenCalledTimes(1);
  });

  it("calculates rolling 24-hour and seven-day stake windows at their exact boundaries", () => {
    const { provider, session, advance } = setup();
    provider.placeInstantBet(session.id, instant, "window-first");
    advance(DAY - 1);
    expect(provider.getAccountSettings(session.id).usage).toMatchObject({ daily: 500, weekly: 500 });
    advance(1);
    expect(provider.getAccountSettings(session.id).usage).toMatchObject({ daily: 0, weekly: 500 });
    provider.placeTraditionalBet(session.id, { ...traditional, amount: 1_000 }, "window-second");
    advance(6 * DAY);
    expect(provider.getAccountSettings(session.id).usage).toMatchObject({ daily: 0, weekly: 1_000 });
    advance(DAY);
    expect(provider.getAccountSettings(session.id).usage).toMatchObject({ daily: 0, weekly: 0 });
  });

  it("keeps account controls isolated between sessions and removes them on logout", () => {
    const { provider, session } = setup();
    provider.pauseAccount(session.id, { durationMinutes: 60 }, "isolated-pause");
    const other = provider.createSession({ displayName: "Luis" });
    expect(provider.getAccountSettings(other.id)).toMatchObject({ pausedUntil: null, limits: null });
    expect(provider.placeTraditionalBet(other.id, traditional, "other-session-play").replayed).toBe(false);
    provider.deleteSession(session.id);
    expect(() => provider.getAccountSettings(session.id)).toThrowError(expect.objectContaining({ code: "SESSION_NOT_FOUND" }));
    expect(provider.hasSession(other.id)).toBe(true);
  });
});
