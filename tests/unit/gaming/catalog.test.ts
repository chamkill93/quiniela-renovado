import { describe, expect, it } from "vitest";

import { buildGamingCatalog, buildMockDraws } from "../../../src/lib/gaming/catalog";
import { buildPreviewDailyDraws } from "../../../src/lib/gaming/daily-draw-schedule";
import { MockGamingProvider } from "../../../src/lib/gaming/mock-provider";

describe("gaming catalog", () => {
  it("shares the preview calendar instead of scheduling relative to startup", () => {
    const now = new Date("2026-08-26T15:00:00Z");
    expect(buildMockDraws(now)).toEqual(buildPreviewDailyDraws(now.getTime()));
    expect(buildGamingCatalog("REFUND", now).draws).toEqual(buildMockDraws(now));
    expect(buildMockDraws(now).map((draw) => draw.drawsAt)).toEqual([
      "2026-08-27T13:30:00.000Z", "2026-08-26T16:00:00.000Z",
      "2026-08-26T19:30:00.000Z", "2026-08-26T23:30:00.000Z",
    ]);
  });

  it("refreshes mock draw dates when queried without changing games or existing snapshots", () => {
    let nowMs = Date.parse("2026-08-26T13:29:59Z");
    const provider = new MockGamingProvider({
      now: () => new Date(nowMs), enabledInstantGameIds: ["sapyaite"],
    });
    const before = provider.getCatalog();
    nowMs = Date.parse("2026-08-27T13:30:00Z");
    const after = provider.getCatalog();
    expect(before.draws[0].drawsAt).toBe("2026-08-26T13:30:00.000Z");
    expect(after.draws).toEqual(buildMockDraws(new Date(nowMs)));
    expect(after.draws[0].drawsAt).toBe("2026-08-28T13:30:00.000Z");
    expect(after.amounts).toEqual(before.amounts);
    expect(after.traditional).toEqual(before.traditional);
    expect(after.instant).toEqual(before.instant);
    expect(after.instant.map((game) => game.id)).toEqual(["sapyaite"]);
  });

  it("publishes six traditional games and exactly nine instant games", () => {
    const catalog = buildGamingCatalog();

    expect(catalog.traditional.map((game) => game.id)).toEqual([
      "head",
      "prizes",
      "invert",
      "redoblona",
      "sapyaite-traditional",
      "megaloto",
    ]);
    expect(catalog.instant.map((game) => game.id)).toEqual([
      "sapyaite",
      "poa",
      "pyae",
      "petei",
      "mokoi",
      "mbohapy",
      "poa5",
      "poa10",
      "racha5",
    ]);
    expect(catalog.traditional.find((game) => game.id === "redoblona")?.selection).toEqual({
      kind: "REDOBLONA",
      initialDigits: 2,
      redoblonaDigits: 2,
      initialUntil: { min: 1, max: 14 },
      redoblonaUntil: { min: 7, max: 14 },
    });
  });

  it("marks every payout as prototype configuration", () => {
    const catalog = buildGamingCatalog("LOSS");

    expect(catalog.instant.every((game) => game.payout.prototype)).toBe(true);
    expect(catalog.instant.find((game) => game.id === "pyae")?.neutral500Policy).toBe(
      "LOSS",
    );
    expect(catalog.instant.find((game) => game.id === "sapyaite")).toMatchObject({
      engine: "EXACT_THREE_DIGITS",
      reels: 1,
      rng: { min: 0, max: 999 },
      selection: { kind: "PADDED_INTEGER", min: 0, max: 999, width: 3 },
      payout: { kind: "MULTIPLIER", winMultiplier: 700 },
    });
    expect(
      catalog.instant
        .filter((game) => game.id !== "sapyaite")
        .every((game) => game.rng.min === 1 && game.rng.max === 999),
    ).toBe(true);
  });
});
