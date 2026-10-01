/** Midnight in Paraguay, regardless of the browser's configured timezone. */
export const LAUNCH_AT = Date.parse("2026-10-02T00:00:00-03:00");
export const LAUNCH_TIME_ZONE = "America/Asuncion";

export function getCountdown(now: number) {
  const total = Math.max(0, Math.ceil((LAUNCH_AT - now) / 1000));
  return {
    launched: now >= LAUNCH_AT,
    values: [Math.floor(total / 86400), Math.floor(total / 3600) % 24,
      Math.floor(total / 60) % 60, total % 60],
  };
}
