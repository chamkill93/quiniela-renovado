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

const LIVE_BEFORE_DRAW_MS = 10 * 60 * 1_000;
const LIVE_AFTER_DRAW_MS = 30 * 60 * 1_000;

/** LIVE follows a dated draw occurrence, independently of its sales cutoff. */
export function selectLiveDraw(nowMs: number, draws?: readonly DrawDefinition[]): DrawDefinition | null {
  if (!Number.isFinite(nowMs) || !Number.isFinite(new Date(nowMs).getTime())) return null;

  let source = draws;
  if (source === undefined) {
    const todayKey = drawDateKey(nowMs);
    if (!todayKey || !isDrawDateKey(todayKey)) return null;
    const todayNoonMs = Date.parse(`${todayKey}T12:00:00Z`);
    // The next-draw schedule has already advanced when a live draw starts.
    source = [-1, 0, 1].flatMap((offset) => {
      const dateKey = new Date(todayNoonMs + offset * 86_400_000).toISOString().slice(0, 10);
      return buildPreviewDrawsForDate(dateKey);
    });
  }

  const candidates = source.flatMap((draw) => {
    const slotIndex = DAILY_DRAW_SLOTS.findIndex((slot) => slot.id === draw.id);
    if (slotIndex < 0 || draw.family !== "QUINIELA") return [];
    const scheduled = draw.drawsAt.trim();
    const drawsAtMs = Date.parse(scheduled);
    if (!Number.isFinite(drawsAtMs) || !isDrawDateKey(scheduled.slice(0, 10))) return [];
    if (nowMs < drawsAtMs - LIVE_BEFORE_DRAW_MS || nowMs >= drawsAtMs + LIVE_AFTER_DRAW_MS) return [];
    return [{ draw, drawsAtMs, slotIndex }];
  });

  candidates.sort((left, right) => {
    const leftStarted = left.drawsAtMs <= nowMs;
    const rightStarted = right.drawsAtMs <= nowMs;
    if (leftStarted !== rightStarted) return leftStarted ? -1 : 1;
    const byTime = leftStarted ? right.drawsAtMs - left.drawsAtMs : left.drawsAtMs - right.drawsAtMs;
    return byTime || left.slotIndex - right.slotIndex;
  });

  return candidates[0]?.draw ?? null;
}
