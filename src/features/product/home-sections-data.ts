import {
  buildPreviewDailyDraws,
  DAILY_DRAW_SLOTS,
} from "@/lib/gaming/daily-draw-schedule";
import { DRAW_TIME_ZONE, drawDateKey } from "@/lib/gaming/draw-calendar";
import type { DrawDefinition, GamingCatalog } from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";
import { selectDailyDrawResults, selectDrawPostures } from "./results-page-data";

export const HOME_TIME_ZONE = DRAW_TIME_ZONE;
export const HOME_DRAW_SLOTS = DAILY_DRAW_SLOTS;

export const HOME_RESULT_TABS = [
  { id: "head", label: "A LA CABEZA" },
  { id: "prizes", label: "A LOS PREMIOS" },
  { id: "redoblona", label: "REDOBLONA" },
  { id: "invert", label: "INVERTIDA" },
] as const;

export type HomeDrawId = (typeof HOME_DRAW_SLOTS)[number]["id"];
export type HomeDrawSlug = (typeof HOME_DRAW_SLOTS)[number]["slug"];
export type HomeResultTabId = (typeof HOME_RESULT_TABS)[number]["id"];

export interface HomeDrawCardView {
  id: HomeDrawId;
  slug: HomeDrawSlug;
  label: string;
  href: `/sorteos/${HomeDrawSlug}` | `/sorteos/${HomeDrawSlug}?fecha=${string}`;
  timeLabel: string;
  dateLabel: string | null;
  statusLabel: string | null;
  targetAt: string | null;
  isNext: boolean;
  isTomorrow: boolean;
  isPast: boolean;
}

export interface HomeResultPositionView {
  position: number;
  value: string | null;
  ending: string | null;
  combinations: readonly string[];
}

export interface HomeLatestDrawResults {
  id: string;
  drawId: HomeDrawId;
  drawLabel: string;
  dateKey: string;
  dateLabel: string;
  occurredAt: string;
  timeLabel: string;
  positions: readonly HomeResultPositionView[];
}

interface ParsedTimestamp {
  source: string;
  milliseconds: number;
}

const DRAW_CARD_DATE_FORMATTER = new Intl.DateTimeFormat("es-PY", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: HOME_TIME_ZONE,
});

const ASUNCION_TIME_FORMATTER = new Intl.DateTimeFormat("es-PY", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: HOME_TIME_ZONE,
});

function parseTimestamp(value: string | null | undefined): ParsedTimestamp | null {
  const source = value?.trim();
  if (!source) return null;
  const milliseconds = Date.parse(source);
  return Number.isFinite(milliseconds) ? { source, milliseconds } : null;
}

function countdownLabel(targetMs: number, nowMs: number) {
  const totalSeconds = Math.max(0, Math.ceil((targetMs - nowMs) / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `EN ${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}M ${String(seconds).padStart(2, "0")}S`;
}

/** Received schedules are authoritative; an explicitly empty list stays empty. */
export function selectHomeDrawCards(
  nowMs: number,
  draws?: readonly DrawDefinition[],
): HomeDrawCardView[] {
  const validClock = Number.isFinite(nowMs) && Number.isFinite(new Date(nowMs).getTime());
  const todayKey = validClock ? drawDateKey(nowMs) : null;
  const tomorrowKey = todayKey
    ? new Date(Date.parse(`${todayKey}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
    : null;
  const source = draws ?? buildPreviewDailyDraws(nowMs);
  const cards = HOME_DRAW_SLOTS.map<HomeDrawCardView>((slot) => {
    const candidates = source
      .filter((draw) => draw.id === slot.id && draw.family === "QUINIELA")
      .flatMap((draw) => {
        const timestamp = parseTimestamp(draw.drawsAt);
        return timestamp ? [timestamp] : [];
      })
      .sort((left, right) => left.milliseconds - right.milliseconds);
    const scheduled = validClock
      ? candidates.find((candidate) => candidate.milliseconds > nowMs) ?? candidates.at(-1)
      : candidates[0];
    const targetMs = scheduled?.milliseconds ?? null;
    const dateKey = targetMs === null ? null : drawDateKey(targetMs);
    const isTomorrow = dateKey !== null && dateKey === tomorrowKey;

    return {
      id: slot.id,
      slug: slot.slug,
      label: slot.label,
      href: dateKey ? `/sorteos/${slot.slug}?fecha=${dateKey}` : `/sorteos/${slot.slug}`,
      timeLabel: targetMs === null ? "—" : ASUNCION_TIME_FORMATTER.format(targetMs),
      dateLabel: targetMs === null
        ? null
        : dateKey === todayKey
          ? "Hoy"
          : isTomorrow
            ? "Mañana"
            : DRAW_CARD_DATE_FORMATTER.format(targetMs),
      statusLabel: null,
      targetAt: scheduled?.source ?? null,
      isNext: false,
      isTomorrow,
      isPast: validClock && targetMs !== null && targetMs <= nowMs,
    };
  });

  if (!validClock) return cards;
  const nextCard = cards
    .filter((card) => card.targetAt !== null && !card.isPast)
    .sort((left, right) => Date.parse(left.targetAt!) - Date.parse(right.targetAt!))[0];
  if (nextCard) {
    nextCard.isNext = true;
    nextCard.statusLabel = countdownLabel(Date.parse(nextCard.targetAt!), nowMs);
  }
  return cards;
}

function normalizeResultNumber(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const source = String(value).trim();
  if (!/^\d{1,3}$/.test(source)) return null;
  return source.padStart(3, "0");
}

function resultCombinations(value: string): string[] {
  const [a, b, c] = value;
  return [...new Set([a + b + c, a + c + b, b + a + c, b + c + a, c + a + b, c + b + a])];
}

/** A single published occurrence and snapshot is shared by all four Home tabs. */
export function selectHomeLatestDrawResults(
  catalog: GamingCatalog,
  results: readonly MockResult[],
): HomeLatestDrawResults | null {
  const eligible = results.filter((result) => {
    if (result.source !== "DRAW") return false;
    const gameId = result.gameId?.trim();
    const knownModality = HOME_RESULT_TABS.some((tab) => tab.id === gameId);
    if (!knownModality && (gameId || result.drawNumbers === undefined)) return false;
    const game = catalog.traditional.find((candidate) => candidate.id === gameId);
    return game?.selection.kind !== "MEGALOTO";
  });
  const { days } = selectDailyDrawResults(catalog, eligible);
  const latest = days.flatMap((day) => day.draws.flatMap((draw) => {
    const timestamp = parseTimestamp(draw.publications[0]?.occurredAt);
    return timestamp ? [{ day, draw, timestamp }] : [];
  })).sort((left, right) => right.timestamp.milliseconds - left.timestamp.milliseconds)[0];
  if (!latest) return null;

  return {
    id: `${latest.day.dateKey}:${latest.draw.id}`,
    drawId: latest.draw.id,
    drawLabel: latest.draw.label,
    dateKey: latest.day.dateKey,
    dateLabel: DRAW_CARD_DATE_FORMATTER.format(latest.timestamp.milliseconds),
    occurredAt: latest.timestamp.source,
    timeLabel: ASUNCION_TIME_FORMATTER.format(latest.timestamp.milliseconds),
    positions: selectDrawPostures(latest.draw).map(({ position, value }) => {
      const normalized = normalizeResultNumber(value);
      return {
        position,
        value: normalized,
        ending: normalized === null ? null : normalized.slice(-2),
        combinations: normalized === null ? [] : resultCombinations(normalized),
      };
    }),
  };
}
