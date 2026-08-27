import { describe, expect, it } from "vitest";
import { buildGamingCatalog } from "@/lib/gaming/catalog";
import { drawDateKey, drawWallTime, isDrawDateKey } from "@/lib/gaming/draw-calendar";
import { emptyDrawDay, paginateDrawDays, selectDailyDrawResults } from "@/features/product/results-page-data";
import type { MockResult } from "@/lib/product/api-types";

const catalog = buildGamingCatalog("REFUND", new Date("2026-08-27T12:00:00Z"));
const result = (id: string, drawId: string, occurredAt: string, overrides: Partial<MockResult> = {}): MockResult => ({
  id, drawId, occurredAt, source: "DRAW", gameId: "head", result: "007", ...overrides,
});

describe("daily draw result presentation", () => {
  it("orders dates newest first and always includes four slots in chronological order", () => {
    const { days } = selectDailyDrawResults(catalog, [
      result("old", "night", "2026-08-25T23:30:00Z"),
      result("new-night", "night", "2026-08-26T23:30:00Z"),
      result("new-early", "early", "2026-08-26T13:30:00Z"),
    ]);
    expect(days.map((day) => day.dateKey)).toEqual(["2026-08-26", "2026-08-25"]);
    expect(days[0].draws.map((draw) => draw.id)).toEqual(["early", "morning", "evening", "night"]);
    expect(days[0].draws.map((draw) => draw.publications.length)).toEqual([1, 0, 0, 1]);
    expect(days[0].draws[0].publications[0].values).toEqual(["007"]);
  });
  it("uses the result date in Paraguay, not UTC or the current catalog schedule", () => {
    const { days } = selectDailyDrawResults(catalog, [
      result("before-midnight", "night", "2026-08-27T02:59:59Z"),
      result("after-midnight", "early", "2026-08-27T03:00:00Z"),
    ]);
    expect(days.map((day) => day.dateKey)).toEqual(["2026-08-27", "2026-08-26"]);
    expect(days[1].draws[3].publications[0].timeLabel).toBe("23:59");
  });
  it("keeps all numbers, leading zeroes, and distinct game publications in the same draw", () => {
    const { days } = selectDailyDrawResults(catalog, [
      result("prizes", "morning", "2026-08-26T16:05:00Z", { gameId: "prizes", resultNumbers: ["0", "7", "123", "12", "9"] }),
      result("head", "morning", "2026-08-26T16:00:00Z"),
    ]);
    const publications = days[0].draws[1].publications;
    expect(publications).toHaveLength(2);
    expect(publications[0].values).toEqual(["000", "007", "123", "012", "009"]);
    expect(publications[1].gameId).toBe("head");
  });
  it("filters a date, and shows unpublished slots instead of inventing numbers for an empty date", () => {
    const history = [result("one", "early", "2026-08-26T13:30:00Z")];
    expect(selectDailyDrawResults(catalog, history, "2026-08-26").days).toHaveLength(1);
    const empty = selectDailyDrawResults(catalog, history, "2026-08-20");
    expect(empty.days[0].dateKey).toBe("2026-08-20");
    expect(empty.days[0].draws.every((draw) => draw.publications.length === 0)).toBe(true);
    expect(selectDailyDrawResults(catalog, history, "2026-02-30").days).toHaveLength(0);
  });
  it("recognizes explicit slot names and catalog aliases without guessing from the hour", () => {
    const aliasedCatalog = { ...catalog, draws: [{ ...catalog.draws[0], id: "draw-123", label: "Asunción · Vespertino" }] };
    const { days, other } = selectDailyDrawResults(aliasedCatalog, [
      result("alias", "draw-123", "2026-08-26T13:00:00Z"),
      result("slug", "matutino", "2026-08-26T13:00:00Z"),
      result("unknown", "unknown", "2026-08-26T13:00:00Z"),
    ]);
    expect(days[0].draws[2].publications[0].id).toBe("alias");
    expect(days[0].draws[1].publications[0].id).toBe("slug");
    expect(other.map((publication) => publication.id)).toEqual(["unknown"]);
  });
  it("separates Mega Loto, unidentifiable results and the instant account history", () => {
    const { days, other } = selectDailyDrawResults(catalog, [
      result("mega", "early", "2026-08-26T13:00:00Z", { gameId: "megaloto" }),
      result("no-date", "early", "invalid"),
      result("instant", "early", "2026-08-26T13:00:00Z", { source: "INSTANT" }),
    ]);
    expect(days).toHaveLength(0);
    expect(other.map((publication) => publication.id)).toEqual(["mega", "no-date"]);
  });
  it("uses a valid publishedAt fallback and ignores repeated IDs and empty records", () => {
    const record = result("same", "early", "invalid", { publishedAt: "2026-08-26T13:00:00Z" });
    const { days } = selectDailyDrawResults(catalog, [record, record, result("empty", "early", record.publishedAt!, { result: "" })]);
    expect(days[0].draws[0].publications).toHaveLength(1);
  });
});

describe("daily history pagination", () => {
  const days = Array.from({ length: 11 }, (_, index) => emptyDrawDay(`2026-08-${String(26 - index).padStart(2, "0")}`));
  it("splits history into five whole days per page without overlaps or omissions", () => {
    const pages = [0, 1, 2].map((page) => paginateDrawDays(days, page));
    expect(pages.map((page) => page.days.length)).toEqual([5, 5, 1]);
    expect(pages.map((page) => [page.from, page.to])).toEqual([[1, 5], [6, 10], [11, 11]]);
    expect(pages.flatMap((page) => page.days)).toEqual(days);
    expect(pages.every((page) => page.days.every((day) => day.draws.length === 4))).toBe(true);
  });
  it.each([-1, NaN, Infinity])("safely handles invalid page %s", (page) => {
    expect(paginateDrawDays(days, page).page).toBe(0);
  });
  it("clamps pages after data changes and handles empty, exact and partial boundaries", () => {
    expect(paginateDrawDays(days, 100)).toMatchObject({ page: 2, from: 11, to: 11 });
    expect(paginateDrawDays([], 2)).toMatchObject({ page: 0, pageCount: 1, from: 0, to: 0, days: [] });
    expect(paginateDrawDays(days.slice(0, 5), 1).pageCount).toBe(1);
    expect(paginateDrawDays(days.slice(0, 6), 1).days).toHaveLength(1);
    expect(paginateDrawDays(days.slice(0, 10), 1).days).toHaveLength(5);
  });
});

describe("draw calendar", () => {
  it("round trips local draw times independently of the machine time zone", () => {
    const time = drawWallTime("2026-08-26", 20, 30);
    expect(new Date(time).toISOString()).toBe("2026-08-26T23:30:00.000Z");
    expect(drawDateKey(time)).toBe("2026-08-26");
  });
  it.each(["2026-02-30", "2026-13-01", "not-a-date", ""])("rejects invalid date %s", (date) => {
    expect(isDrawDateKey(date)).toBe(false);
    expect(drawWallTime(date, 12, 0)).toBeNaN();
  });
});
