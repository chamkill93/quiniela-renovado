/**
 * Presentation-only estimates. Never use these values to settle a play, mutate
 * the wallet, or populate a ticket. Traditional rates are illustrative.
 */
export type PrizeCalculation =
  | { kind: "FIXED"; multiplier: number }
  | { kind: "POSITION" | "PERMUTATIONS"; multiplier: number; minPosition: number; maxPosition: number }
  | { kind: "REDOBLONA"; multiplier: number; secondMultiplier: number; minPosition: number; maxPosition: number }
  | { kind: "TIERS"; tiers: readonly { exactMatches: number; multiplier: number }[] };

export interface PrizeEstimateInput {
  amount: number;
  position?: number;
  number?: string;
  matches?: number;
}

export const MAX_ESTIMATE_AMOUNT = 1_000_000_000;

export function uniqueThreeDigitPermutations(number: string): number | null {
  if (!/^\d{3}$/.test(number) || Number(number) === 0) return null;
  const [a, b, c] = number;
  return new Set([a + b + c, a + c + b, b + a + c, b + c + a, c + a + b, c + b + a]).size;
}

export function estimatePrize(calculation: PrizeCalculation, input: PrizeEstimateInput) {
  if (!Number.isSafeInteger(input.amount) || input.amount < 1 || input.amount > MAX_ESTIMATE_AMOUNT) return null;
  let numerator: number;
  let divisor = 1;
  let combinations: number | null = null;
  if (calculation.kind === "TIERS") {
    const tier = calculation.tiers.find((item) => item.exactMatches === input.matches);
    if (!tier) return null;
    numerator = tier.multiplier;
  } else {
    numerator = calculation.multiplier;
    if (calculation.kind !== "FIXED") {
      const position = input.position ?? NaN;
      if (!Number.isInteger(position) || position < calculation.minPosition || position > calculation.maxPosition) return null;
      divisor = position;
      if (calculation.kind === "PERMUTATIONS") {
        combinations = uniqueThreeDigitPermutations(input.number ?? "");
        if (!combinations) return null;
        divisor *= combinations;
      }
      if (calculation.kind === "REDOBLONA") {
        if (!Number.isFinite(calculation.secondMultiplier) || calculation.secondMultiplier <= 0) return null;
        numerator *= calculation.secondMultiplier;
      }
    }
  }
  if (!Number.isFinite(numerator) || numerator < 0) return null;
  // Divide only after multiplying: rounded display multipliers must not affect
  // the estimate. Discard fractions because PYG is shown in whole guaraníes.
  const total = Math.floor(input.amount * numerator / divisor);
  if (!Number.isSafeInteger(total)) return null;
  return { total, net: total - input.amount, multiplier: numerator / divisor, combinations };
}

export function formatMultiplier(value: number) {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 2 }).format(value);
}
