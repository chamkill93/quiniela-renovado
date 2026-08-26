import { describe, expect, it } from "vitest";

import { buildGamingCatalog } from "../../../src/lib/gaming/catalog";

describe("gaming catalog", () => {
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
