/**
 * Formats an Invertida number for display while its canonical value remains
 * an unseparated string (for example, `012` becomes `0.1.2`).
 */
export function formatInvertNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 3).split("").join(".");
}
