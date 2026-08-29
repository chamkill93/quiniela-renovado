import { describe, expect, it } from "vitest";

import {
  evaluateRedoblona,
  getRedoblonaEvaluationRanges,
  normalizeRedoblonaEnding,
  REDOBLONA_ENDING_DIGITS,
  REDOBLONA_INITIAL_POSTURE_RANGE,
  REDOBLONA_SECOND_POSTURE_RANGE,
  summarizeRedoblonaSelection,
  validateRedoblonaSelection,
  type RedoblonaSelection,
} from "../../../src/lib/gaming/redoblona";
import type { PositionedDrawNumber } from "../../../src/lib/gaming/types";

const baseSelection: RedoblonaSelection = {
  initialNumber: "35",
  initialUntil: 1,
  redoblonaNumber: "72",
  redoblonaUntil: 7,
};

function positions(values: readonly string[]): PositionedDrawNumber[] {
  return values.map((value, index) => ({ position: index + 1, value }));
}

describe("Redoblona domain rule", () => {
  it("centralizes number and posture limits", () => {
    expect(REDOBLONA_ENDING_DIGITS).toBe(2);
    expect(REDOBLONA_INITIAL_POSTURE_RANGE).toEqual({ min: 1, max: 14 });
    expect(REDOBLONA_SECOND_POSTURE_RANGE).toEqual({ min: 7, max: 14 });
  });

  it.each([
    ["7", "07"],
    ["07", "07"],
    ["005", "05"],
    ["0", "00"],
    ["00", "00"],
    ["100", "00"],
    ["", ""],
  ])("normalizes the last two digits of %j as %j", (raw, expected) => {
    expect(normalizeRedoblonaEnding(raw)).toBe(expected);
  });

  it("requires canonical two-digit endings while accepting 00 and 05", () => {
    expect(validateRedoblonaSelection({
      ...baseSelection,
      initialNumber: "05",
      redoblonaNumber: "00",
    })).toEqual({});

    expect(validateRedoblonaSelection({
      ...baseSelection,
      initialNumber: "100",
      redoblonaNumber: "7",
    })).toMatchObject({
      initialNumber: expect.stringMatching(/exactamente dos cifras/i),
      redoblonaNumber: expect.stringMatching(/exactamente dos cifras/i),
    });

    const normalized = {
      ...baseSelection,
      initialNumber: normalizeRedoblonaEnding("5"),
      redoblonaNumber: normalizeRedoblonaEnding("0"),
    };
    expect(normalized).toMatchObject({ initialNumber: "05", redoblonaNumber: "00" });
    expect(validateRedoblonaSelection(normalized)).toEqual({});
  });

  it.each([
    [{ initialUntil: 0 }, "initialUntil"],
    [{ initialUntil: 15 }, "initialUntil"],
    [{ initialUntil: 1.5 }, "initialUntil"],
    [{ redoblonaUntil: 6 }, "redoblonaUntil"],
    [{ redoblonaUntil: 15 }, "redoblonaUntil"],
    [{ redoblonaUntil: 7.5 }, "redoblonaUntil"],
    [{ initialUntil: 8, redoblonaUntil: 7 }, "redoblonaUntil"],
  ] as const)("rejects invalid posture values %o", (change, field) => {
    expect(validateRedoblonaSelection({ ...baseSelection, ...change })).toHaveProperty(field);
  });

  it("maps Cabeza 1 plus hasta 7 to initial position 1 and second positions 2 through 8", () => {
    expect(getRedoblonaEvaluationRanges(baseSelection)).toEqual({
      initial: { min: 1, max: 1 },
      redoblona: { min: 2, max: 8 },
    });
    expect(summarizeRedoblonaSelection(baseSelection)).toBe(
      "35 Cabeza + 72 hasta 7",
    );
  });

  it("uses overlapping absolute ranges above Cabeza and enforces their limits", () => {
    expect(getRedoblonaEvaluationRanges({ initialUntil: 8, redoblonaUntil: 8 })).toEqual({
      initial: { min: 1, max: 8 },
      redoblona: { min: 1, max: 8 },
    });
    expect(getRedoblonaEvaluationRanges({ initialUntil: 14, redoblonaUntil: 14 })).toEqual({
      initial: { min: 1, max: 14 },
      redoblona: { min: 1, max: 14 },
    });
    expect(() => getRedoblonaEvaluationRanges({ initialUntil: 8, redoblonaUntil: 7 }))
      .toThrow(/igual o mayor/i);
  });

  it("wins the supplied 35 + 72 example and returns the deterministic hits", () => {
    const evaluation = evaluateRedoblona(baseSelection, positions([
      "435", "621", "972", "501", "244", "119", "820", "944",
    ]));

    expect(evaluation).toEqual({
      won: true,
      hits: {
        initial: { position: 1, value: "435", ending: "35" },
        redoblona: { position: 3, value: "972", ending: "72" },
      },
      ranges: {
        initial: { min: 1, max: 1 },
        redoblona: { min: 2, max: 8 },
      },
      summary: "Acertó 35 en la 1.ª posición y 72 en la 3.ª posición.",
    });
  });

  it("loses when 35 is absent from Cabeza even if 72 appears in its range", () => {
    const evaluation = evaluateRedoblona(baseSelection, positions([
      "436", "621", "972", "501", "244", "119", "820", "944",
    ]));

    expect(evaluation).toMatchObject({
      won: false,
      hits: {
        initial: null,
        redoblona: { position: 3, value: "972", ending: "72" },
      },
      summary: expect.stringMatching(/35 no apareció/i),
    });
  });

  it("loses when the initial ending hits but the second ending does not", () => {
    const evaluation = evaluateRedoblona(baseSelection, positions([
      "435", "621", "971", "501", "244", "119", "820", "944",
    ]));

    expect(evaluation).toMatchObject({
      won: false,
      hits: {
        initial: { position: 1, value: "435", ending: "35" },
        redoblona: null,
      },
      summary: expect.stringMatching(/72 no apareció/i),
    });
  });

  it("requires two different occurrences when both selected endings are equal", () => {
    const sameEndingSelection = {
      ...baseSelection,
      initialNumber: "25",
      redoblonaNumber: "25",
    };

    expect(evaluateRedoblona(
      sameEndingSelection,
      positions(["125", "901", "225", "333", "444", "555", "666", "777"]),
    )).toMatchObject({
      won: true,
      hits: {
        initial: { position: 1, ending: "25" },
        redoblona: { position: 3, ending: "25" },
      },
    });

    expect(evaluateRedoblona(
      sameEndingSelection,
      positions(["125", "901", "902", "333", "444", "555", "666", "777"]),
    )).toMatchObject({
      won: false,
      hits: { initial: { position: 1, ending: "25" }, redoblona: null },
    });
  });

  it("keeps leading zeroes in both selected endings and normalized draw results", () => {
    const evaluation = evaluateRedoblona({
      ...baseSelection,
      initialNumber: "05",
      redoblonaNumber: "00",
    }, positions(["5", "100", "972", "501", "244", "119", "820", "944"]));

    expect(evaluation).toMatchObject({
      won: true,
      hits: {
        initial: { position: 1, value: "005", ending: "05" },
        redoblona: { position: 2, value: "100", ending: "00" },
      },
    });
  });

  it("chooses the first available pair in position order without reusing a position", () => {
    const evaluation = evaluateRedoblona({
      initialNumber: "25",
      redoblonaNumber: "25",
      initialUntil: 3,
      redoblonaUntil: 7,
    }, [
      { position: 3, value: "325" },
      { position: 2, value: "225" },
      { position: 1, value: "125" },
    ]);

    expect(evaluation).toMatchObject({
      won: true,
      hits: {
        initial: { position: 1, value: "125" },
        redoblona: { position: 2, value: "225" },
      },
    });
  });

  it("ignores results outside each configured evaluation range", () => {
    expect(evaluateRedoblona(baseSelection, [
      { position: 2, value: "435" },
      { position: 9, value: "972" },
    ])).toMatchObject({ won: false, hits: { initial: null, redoblona: null } });
  });
});
