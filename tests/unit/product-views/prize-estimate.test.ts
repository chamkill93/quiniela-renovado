import { describe, expect, it } from "vitest";
import { estimatePrize, uniqueThreeDigitPermutations, type PrizeCalculation } from "@/features/product/prize-estimate";
import { selectEnabledGameRules } from "@/features/product/rules-page-data";
import { buildGamingCatalog } from "@/lib/gaming/catalog";

const rules = selectEnabledGameRules(buildGamingCatalog("REFUND", new Date("2026-08-27T12:00:00Z"), ["sapyaite"]));
const fixed: PrizeCalculation = { kind: "FIXED", multiplier: 700 };
const calculation = (id: string) => [...rules.traditional, ...rules.instant].find((rule) => rule.id === id)!.payout.calculation;

describe("reference prize estimates", () => {
  it.each(["head", "sapyaite"])("estimates total and net separately for %s", (id) => {
    expect(estimatePrize(calculation(id), { amount: 500 })).toMatchObject({ total: 350_000, net: 349_500, multiplier: 700 });
  });
  it("divides the prizes base by the selected position", () => {
    expect(estimatePrize(calculation("prizes"), { amount: 1_000, position: 10 })).toMatchObject({ total: 70_000, net: 69_000, multiplier: 70 });
  });
  it.each([["123", 6], ["112", 3], ["111", 1], ["001", 3], ["010", 3]] as const)("counts distinct orders of %s", (number, count) => {
    expect(uniqueThreeDigitPermutations(number)).toBe(count);
    expect(estimatePrize(calculation("invert"), { amount: 600, position: 1, number })?.total).toBe(420_000 / count);
  });
  it("does not use a rounded multiplier for money calculation", () => {
    expect(estimatePrize(calculation("invert"), { amount: 1_000, position: 14, number: "123" })).toMatchObject({ total: 8_333, net: 7_333 });
  });
  it("estimates both Redoblona stages, not just one successful stage", () => {
    expect(estimatePrize(calculation("redoblona"), { amount: 500, position: 10 })).toMatchObject({ total: 2_800_000, net: 2_799_500, multiplier: 5_600 });
  });
  it.each([0, -500, 1.5, NaN, Infinity, 1_000_000_001])("rejects invalid amount %s", (amount) => {
    expect(estimatePrize(fixed, { amount })).toBeNull();
  });
  it.each([0, 1, 15, NaN, 2.5])("rejects invalid prize posture %s", (position) => {
    expect(estimatePrize(calculation("prizes"), { amount: 500, position })).toBeNull();
  });
  it.each(["", "12", "1234", "abc", "000"])("rejects invalid inverse number %s", (number) => {
    expect(estimatePrize(calculation("invert"), { amount: 500, position: 1, number })).toBeNull();
  });
  it("uses only configured match tiers", () => {
    const tiers: PrizeCalculation = { kind: "TIERS", tiers: [{ exactMatches: 1, multiplier: 60 }, { exactMatches: 2, multiplier: 500 }] };
    expect(estimatePrize(tiers, { amount: 500, matches: 2 })?.total).toBe(250_000);
    expect(estimatePrize(tiers, { amount: 500, matches: 4 })).toBeNull();
  });
});
