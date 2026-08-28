export const TRADITIONAL_STAKE_STEP = 500;
export const TRADITIONAL_MAX_STAKE_PER_DRAW = 10_000;

export function isTraditionalStakeAmount(value: number) {
  return Number.isSafeInteger(value) && value >= TRADITIONAL_STAKE_STEP &&
    value <= TRADITIONAL_MAX_STAKE_PER_DRAW && value % TRADITIONAL_STAKE_STEP === 0;
}

// The catalog offers denominations. A stake may combine them more than once.
export function getTraditionalStakeTotals(denominations: readonly number[]) {
  const chips = [...new Set(denominations.filter(isTraditionalStakeAmount))];
  const reachable = new Set<number>([0]);
  for (let total = TRADITIONAL_STAKE_STEP; total <= TRADITIONAL_MAX_STAKE_PER_DRAW; total += TRADITIONAL_STAKE_STEP) {
    if (chips.some((chip) => reachable.has(total - chip))) reachable.add(total);
  }
  reachable.delete(0);
  return [...reachable];
}
