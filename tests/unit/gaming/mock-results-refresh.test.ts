import { describe, expect, it, vi } from "vitest";

import { drawDateKey } from "@/lib/gaming/draw-calendar";
import { MockGamingProvider } from "@/lib/gaming/mock-provider";
import { DRAW_POSTURE_COUNT, type GamingResult } from "@/lib/gaming/types";

const DAY_MS = 86_400_000;

function clockProvider(start: string) {
  let nowMs = Date.parse(start);
  let nextId = 0;
  const randomSource = { intInclusive: vi.fn(() => 7) };
  const provider = new MockGamingProvider({
    now: () => new Date(nowMs),
    idFactory: () => `refresh-test-${++nextId}`,
    randomSource,
    sessionTtlMs: 31 * DAY_MS,
  });
  const session = provider.createSession();

  return {
    provider,
    session,
    randomSource,
    setNow(value: string) { nowMs = Date.parse(value); },
    results: () => provider.listResults(session.id),
  };
}

function heads(results: readonly GamingResult[]) {
  return results.filter((result) => result.source === "DRAW" && result.gameId === "head");
}

function dateCounts(results: readonly GamingResult[]) {
  const counts = new Map<string, number>();
  for (const result of heads(results)) {
    const date = drawDateKey(Date.parse(result.occurredAt))!;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return counts;
}

function expectCommonDrawsUnchanged(before: readonly GamingResult[], after: readonly GamingResult[]) {
  const previous = new Map(before.map((result) => [result.id, result]));
  const common = after.filter((result) => previous.has(result.id));
  expect(common.length).toBeGreaterThan(0);
  for (const result of common) expect(result).toEqual(previous.get(result.id));
}

describe("recent generic preview draw results", () => {
  it("keeps ten complete past dates before the first local draw", () => {
    const clock = clockProvider("2026-08-28T12:00:00.000Z");
    const results = clock.results();
    const counts = dateCounts(results);

    expect(results).toHaveLength(160);
    expect(new Set(results.map((result) => result.id)).size).toBe(160);
    expect([...counts.keys()]).toEqual([
      "2026-08-27", "2026-08-26", "2026-08-25", "2026-08-24", "2026-08-23",
      "2026-08-22", "2026-08-21", "2026-08-20", "2026-08-19", "2026-08-18",
    ]);
    expect([...counts.values()]).toEqual(Array<number>(10).fill(4));
    expect(heads(results)[0]).toMatchObject({
      id: "draw-result-2026-08-27-night-head",
      drawId: "night",
      occurredAt: "2026-08-27T23:30:00.000Z",
    });
    expect(clock.randomSource.intInclusive).not.toHaveBeenCalled();
  });

  it.each([
    { at: "2026-08-28T13:29:59.999Z", slots: [] },
    { at: "2026-08-28T13:30:00.000Z", slots: ["early"] },
    { at: "2026-08-28T15:59:59.999Z", slots: ["early"] },
    { at: "2026-08-28T16:00:00.000Z", slots: ["morning", "early"] },
    { at: "2026-08-28T19:29:59.999Z", slots: ["morning", "early"] },
    { at: "2026-08-28T19:30:00.000Z", slots: ["evening", "morning", "early"] },
    { at: "2026-08-28T23:29:59.999Z", slots: ["evening", "morning", "early"] },
    { at: "2026-08-28T23:30:00.000Z", slots: ["night", "evening", "morning", "early"] },
    { at: "2026-08-29T02:59:59.999Z", slots: ["night", "evening", "morning", "early"] },
  ])("publishes only elapsed slots at $at, retaining ten whole dates", ({ at, slots }) => {
    const results = clockProvider(at).results();
    const counts = dateCounts(results);
    const today = heads(results).filter((result) => drawDateKey(Date.parse(result.occurredAt)) === "2026-08-28");

    expect(today.map((result) => result.drawId)).toEqual(slots);
    expect(counts.size).toBe(10);
    expect([...counts.entries()].filter(([date]) => date !== "2026-08-28").every(([, count]) => count === 4)).toBe(true);
    expect(results).toHaveLength(slots.length ? (36 + slots.length) * 4 : 160);
    expect(results.every((result) => Date.parse(result.occurredAt) <= Date.parse(at))).toBe(true);
    expect(heads(results).map((result) => result.occurredAt))
      .toEqual(heads(results).map((result) => result.occurredAt).sort().reverse());
  });

  it("refreshes a running provider at draw time without changing its retained history", () => {
    const clock = clockProvider("2026-08-28T13:29:59.999Z");
    const before = clock.results();

    clock.setNow("2026-08-28T13:30:00.000Z");
    const after = clock.results();

    expect(after).toHaveLength(148);
    expect(heads(after)[0]).toMatchObject({
      id: "draw-result-2026-08-28-early-head",
      occurredAt: "2026-08-28T13:30:00.000Z",
    });
    expect(dateCounts(after).has("2026-08-18")).toBe(false);
    expectCommonDrawsUnchanged(before, after);
    expect(after).toEqual(clockProvider("2026-08-28T13:30:00.000Z").results());

    clock.setNow("2026-08-28T16:00:00.000Z");
    const next = clock.results();
    expect(next).toHaveLength(152);
    expect(heads(next).slice(0, 2).map((result) => result.drawId)).toEqual(["morning", "early"]);
    expectCommonDrawsUnchanged(after, next);
  });

  it("uses Paraguay midnight, preserving yesterday's final draw until a new slot has elapsed", () => {
    const clock = clockProvider("2026-08-28T23:59:59.999Z");
    const before = clock.results();

    for (const at of [
      "2026-08-29T00:00:00.000Z",
      "2026-08-29T02:59:59.999Z",
      "2026-08-29T03:00:00.000Z",
      "2026-08-29T13:29:59.999Z",
    ]) {
      clock.setNow(at);
      expect(clock.results()).toEqual(before);
    }

    clock.setNow("2026-08-29T13:30:00.000Z");
    const after = clock.results();
    expect([...dateCounts(after).keys()][0]).toBe("2026-08-29");
    expect(dateCounts(after).size).toBe(10);
    expectCommonDrawsUnchanged(before, after);
  });

  it.each([
    { before: "2026-08-31T23:30:00.000Z", after: "2026-09-01T13:30:00.000Z", date: "2026-09-01" },
    { before: "2026-12-31T23:30:00.000Z", after: "2027-01-01T13:30:00.000Z", date: "2027-01-01" },
  ])("rolls the ten-date window across the boundary into $date", ({ before, after, date }) => {
    const clock = clockProvider(before);
    const previous = clock.results();
    clock.setNow(after);
    const current = clock.results();

    expect([...dateCounts(current).keys()][0]).toBe(date);
    expect(dateCounts(current).size).toBe(10);
    expect(current.every((result) => Date.parse(result.occurredAt) <= Date.parse(after))).toBe(true);
    expectCommonDrawsUnchanged(previous, current);
  });

  it("shares fourteen deterministic canonical postures across modalities and isolates consumer mutations", () => {
    const clock = clockProvider("2026-08-28T19:31:00.000Z");
    const expected = clockProvider("2026-08-28T19:31:00.000Z").results();
    const results = clock.results();

    expect(results).toEqual(expected);
    expect(results.some((result) => result.drawNumbers?.some(({ value }) => value.startsWith("0")))).toBe(true);
    for (const head of heads(results)) {
      const related = results.filter((result) => result.drawId === head.drawId && result.occurredAt === head.occurredAt);
      expect(related.map((result) => result.gameId)).toEqual(["head", "prizes", "invert", "redoblona"]);
      expect(head.drawNumbers?.map(({ position }) => position)).toEqual(
        Array.from({ length: DRAW_POSTURE_COUNT }, (_, index) => index + 1),
      );
      expect(head.drawNumbers?.every(({ value }) => /^\d{3}$/.test(value))).toBe(true);
      for (const result of related) {
        expect(result.drawNumbers).toEqual(head.drawNumbers);
        expect(result.result).toBe(head.drawNumbers![0].value);
        expect(result.resultNumbers).toEqual([result.result]);
      }
    }

    results[0].drawNumbers![0].value = "changed-by-consumer";
    expect(clock.results()).toEqual(expected);
    expect(clock.randomSource.intInclusive).not.toHaveBeenCalled();
  });

  it("updates public demo results without changing instant history, plays, tickets, balance or settlement", () => {
    const clock = clockProvider("2026-08-28T12:00:00.000Z");
    const { provider, session } = clock;
    const instant = provider.placeInstantBet(
      session.id, { gameId: "sapyaite", amount: 500, selection: "007" }, "refresh-instant-001",
    );
    const traditional = provider.placeTraditionalBet(
      session.id,
      { gameId: "head", drawId: "early", amount: 500, selection: { number: "321" } },
      "refresh-traditional-001",
    );
    const before = provider.getBootstrap(session.id);
    const movements = provider.listMovements(session.id);
    const instantTicket = provider.getTicket(session.id, instant.ticket.id);
    const traditionalTicket = provider.getTicket(session.id, traditional.ticket.id);
    const randomCalls = clock.randomSource.intInclusive.mock.calls.length;

    clock.setNow("2026-08-29T19:30:00.000Z");
    const after = provider.getBootstrap(session.id);

    expect(after.results.filter((result) => result.source === "INSTANT"))
      .toEqual(before.results.filter((result) => result.source === "INSTANT"));
    expect(after.results.filter((result) => result.source === "INSTANT")).toHaveLength(1);
    expect(after.results.filter((result) => result.source === "DRAW")).not.toEqual(
      before.results.filter((result) => result.source === "DRAW"),
    );
    expect(after.session).toEqual(before.session);
    expect(after.plays).toEqual(before.plays);
    expect(after.plays.find((play) => play.id === traditional.play.id)?.status).toBe("PENDING");
    expect(provider.listMovements(session.id)).toEqual(movements);
    expect(provider.getTicket(session.id, instant.ticket.id)).toEqual(instantTicket);
    expect(provider.getTicket(session.id, traditional.ticket.id)).toEqual(traditionalTicket);
    expect(clock.randomSource.intInclusive).toHaveBeenCalledTimes(randomCalls);
  });
});
