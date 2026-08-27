export const DRAW_TIME_ZONE = "America/Asuncion";

const localParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: DRAW_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function drawDateKey(timestamp: number): string | null {
  if (!Number.isFinite(timestamp)) return null;
  const parts = new Map(localParts.formatToParts(timestamp).map((part) => [part.type, part.value]));
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

export function isDrawDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Convert a local draw wall time without relying on the machine's time zone. */
export function drawWallTime(dateKey: string, hour: number, minute: number): number {
  if (!isDrawDateKey(dateKey)) return NaN;
  const [year, month, day] = dateKey.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = wall;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const p = new Map(localParts.formatToParts(candidate).map((part) => [part.type, Number(part.value)]));
    const represented = Date.UTC(p.get("year")!, p.get("month")! - 1, p.get("day")!, p.get("hour")!, p.get("minute")!, p.get("second")!);
    const corrected = wall - (represented - candidate);
    if (corrected === candidate) break;
    candidate = corrected;
  }
  return candidate;
}
