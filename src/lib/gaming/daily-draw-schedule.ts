import {
  drawDateKey,
  drawWallTime,
  isDrawDateKey,
} from "./draw-calendar";
import type { DrawDefinition } from "./types";

/** Shared wall-clock schedule for the preview, never a replacement for backoffice data. */
export const DAILY_DRAW_SLOTS = [
  { id: "early", label: "Tempranero", slug: "tempranero", time: "10:30", hour: 10, minute: 30 },
  { id: "morning", label: "Matutino", slug: "matutino", time: "13:00", hour: 13, minute: 0 },
  { id: "evening", label: "Vespertino", slug: "vespertino", time: "16:30", hour: 16, minute: 30 },
  { id: "night", label: "Nocturno", slug: "nocturno", time: "20:30", hour: 20, minute: 30 },
] as const;

const PREVIEW_SALES_CUTOFF_MS = 15 * 60 * 1_000;

/** A specific preview day, including past draws when opening their dated room. */
export function buildPreviewDrawsForDate(dateKey: string): readonly DrawDefinition[] {
  if (!isDrawDateKey(dateKey)) return [];

  return DAILY_DRAW_SLOTS.map((slot) => {
    const drawsAtMs = drawWallTime(dateKey, slot.hour, slot.minute);
    return {
      id: slot.id,
      label: `${slot.label} · ${slot.time}`,
      family: "QUINIELA",
      drawsAt: new Date(drawsAtMs).toISOString(),
      closesAt: new Date(drawsAtMs - PREVIEW_SALES_CUTOFF_MS).toISOString(),
      // OPEN is the existing transport contract, not a claim about sales availability.
      status: "OPEN",
    };
  });
}

/** Each slot advances at its exact draw time, using the Paraguay calendar day. */
export function buildPreviewDailyDraws(nowMs: number): readonly DrawDefinition[] {
  if (!Number.isFinite(nowMs) || !Number.isFinite(new Date(nowMs).getTime())) return [];
  const todayKey = drawDateKey(nowMs);
  if (!todayKey) return [];
  const tomorrowKey = new Date(Date.parse(`${todayKey}T12:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  const todayDraws = buildPreviewDrawsForDate(todayKey);
  const tomorrowDraws = buildPreviewDrawsForDate(tomorrowKey);

  return todayDraws.flatMap((draw, index) => {
    const next = Date.parse(draw.drawsAt) > nowMs ? draw : tomorrowDraws[index];
    return next ? [next] : [];
  });
}
