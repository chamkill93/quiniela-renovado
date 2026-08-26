const MIN_HERO_VALUE = 1;
const MAX_HERO_VALUE = 999;

function formatHeroValue(value: number) {
  return String(value).padStart(3, "0");
}

export function createRandomHeroValue(
  random: () => number = Math.random,
  previousValue: string | null = null,
) {
  const sample = random();
  const normalizedSample = Number.isFinite(sample)
    ? Math.min(Math.max(sample, 0), 1 - Number.EPSILON)
    : 0;
  let numericValue = Math.floor(
    normalizedSample * (MAX_HERO_VALUE - MIN_HERO_VALUE + 1),
  ) + MIN_HERO_VALUE;
  let nextValue = formatHeroValue(numericValue);

  if (nextValue === previousValue) {
    numericValue = numericValue === MAX_HERO_VALUE
      ? MIN_HERO_VALUE
      : numericValue + 1;
    nextValue = formatHeroValue(numericValue);
  }

  return nextValue;
}
