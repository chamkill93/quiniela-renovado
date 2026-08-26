import type { GamingCatalog } from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";

export const HOME_TIME_ZONE = "America/Asuncion";

export const HOME_DRAW_SLOTS = [
  {
    id: "early",
    label: "Tempranero",
    slug: "tempranero",
    time: "10:30",
    hour: 10,
    minute: 30,
  },
  {
    id: "morning",
    label: "Matutino",
    slug: "matutino",
    time: "13:00",
    hour: 13,
    minute: 0,
  },
  {
    id: "evening",
    label: "Vespertino",
    slug: "vespertino",
    time: "16:30",
    hour: 16,
    minute: 30,
  },
  {
    id: "night",
    label: "Nocturno",
    slug: "nocturno",
    time: "20:30",
    hour: 20,
    minute: 30,
  },
] as const;

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
  href: `/sorteos/${HomeDrawSlug}`;
  timeLabel: string;
  statusLabel: string | null;
  targetAt: string | null;
  isNext: boolean;
  isTomorrow: boolean;
}

export interface HomePublishedResultView {
  id: string;
  tabId: HomeResultTabId;
  modality: string;
  productLabel: string;
  position: number | null;
  value: string;
  occurredAt: string;
  dateLabel: string;
  timeLabel: string;
  drawLabel: string;
}

interface ParsedTimestamp {
  source: string;
  milliseconds: number;
}

interface LocalCalendarDate {
  year: number;
  month: number;
  day: number;
}

const ASUNCION_CALENDAR_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: HOME_TIME_ZONE,
});

const ASUNCION_DATE_FORMATTER = new Intl.DateTimeFormat("es-PY", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
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

function calendarPartsAt(timestamp: number) {
  const values = new Map(
    ASUNCION_CALENDAR_FORMATTER.formatToParts(timestamp).map((part) => [
      part.type,
      Number(part.value),
    ]),
  );

  return {
    year: values.get("year") ?? 0,
    month: values.get("month") ?? 0,
    day: values.get("day") ?? 0,
    hour: values.get("hour") ?? 0,
    minute: values.get("minute") ?? 0,
    second: values.get("second") ?? 0,
  };
}

function addCalendarDays(date: LocalCalendarDate, days: number): LocalCalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function offsetAt(timestamp: number) {
  const parts = calendarPartsAt(timestamp);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - Math.floor(timestamp / 1_000) * 1_000;
}

function asuncionWallTimeToEpoch(
  date: LocalCalendarDate,
  hour: number,
  minute: number,
) {
  const wallTimeAsUtc = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  let candidate = wallTimeAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const corrected = wallTimeAsUtc - offsetAt(candidate);
    if (corrected === candidate) break;
    candidate = corrected;
  }

  return candidate;
}

function countdownLabel(targetMs: number, nowMs: number) {
  const totalSeconds = Math.max(0, Math.ceil((targetMs - nowMs) / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `EN ${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}M ${String(seconds).padStart(2, "0")}S`;
}

export function selectHomeDrawCards(nowMs: number): HomeDrawCardView[] {
  if (!Number.isFinite(nowMs)) {
    return HOME_DRAW_SLOTS.map((slot) => ({
      id: slot.id,
      slug: slot.slug,
      label: slot.label,
      href: `/sorteos/${slot.slug}` as const,
      timeLabel: slot.time,
      statusLabel: null,
      targetAt: null,
      isNext: false,
      isTomorrow: false,
    }));
  }

  const localNow = calendarPartsAt(nowMs);
  const today = {
    year: localNow.year,
    month: localNow.month,
    day: localNow.day,
  };
  const tomorrow = addCalendarDays(today, 1);
  const todayTargets = HOME_DRAW_SLOTS.map((slot) =>
    asuncionWallTimeToEpoch(today, slot.hour, slot.minute),
  );
  const nextIndex = todayTargets.findIndex((target) => target > nowMs);
  const activeIndex = nextIndex === -1 ? 0 : nextIndex;
  const activeDate = nextIndex === -1 ? tomorrow : today;

  return HOME_DRAW_SLOTS.map((slot, index) => {
    const isNext = index === activeIndex;
    const targetMs = isNext
      ? asuncionWallTimeToEpoch(activeDate, slot.hour, slot.minute)
      : null;

    return {
      id: slot.id,
      slug: slot.slug,
      label: slot.label,
      href: `/sorteos/${slot.slug}` as const,
      timeLabel: slot.time,
      statusLabel: targetMs === null ? null : countdownLabel(targetMs, nowMs),
      targetAt: targetMs === null ? null : new Date(targetMs).toISOString(),
      isNext,
      isTomorrow: isNext && nextIndex === -1,
    };
  });
}

function normalizeResultNumber(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const source = String(value).trim();
  if (!/^\d{1,3}$/.test(source)) return null;
  const numericValue = Number(source);
  if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 999) {
    return null;
  }
  return source.padStart(3, "0");
}

function receivedResultNumbers(result: MockResult) {
  const values = result.resultNumbers?.length
    ? result.resultNumbers
    : result.numbers?.length
      ? result.numbers
      : result.result === undefined
        ? []
        : [result.result];

  return values.flatMap((value, index) => {
    const normalized = normalizeResultNumber(value);
    return normalized ? [{ sequence: index, value: normalized }] : [];
  });
}

function resultTimestamp(result: MockResult) {
  return parseTimestamp(result.occurredAt) ?? parseTimestamp(result.publishedAt);
}

function homeResultTab(result: MockResult) {
  return HOME_RESULT_TABS.find((tab) => tab.id === result.gameId) ?? null;
}

function resultBelongsToQuiniela(result: MockResult, catalog: GamingCatalog) {
  if (result.source !== "DRAW" || !homeResultTab(result)) return false;

  const draw = result.drawId
    ? catalog.draws.find((candidate) => candidate.id === result.drawId)
    : undefined;
  if (draw?.family === "MEGALOTO") return false;

  const game = result.gameId
    ? catalog.traditional.find((candidate) => candidate.id === result.gameId)
    : undefined;
  return game?.selection.kind !== "MEGALOTO";
}

function cleanDrawLabel(value: string) {
  return value
    .trim()
    .replace(/\s*(?:·|•|-)\s*\d{1,2}:\d{2}\s*$/u, "")
    .trim();
}

export function selectHomePublishedResults(
  catalog: GamingCatalog,
  results: readonly MockResult[],
): HomePublishedResultView[] {
  const candidates = results.flatMap((result, sourceIndex) => {
    if (!resultBelongsToQuiniela(result, catalog)) return [];
    const timestamp = resultTimestamp(result);
    const tab = homeResultTab(result);
    const numbers = receivedResultNumbers(result);
    if (!timestamp || !tab || numbers.length === 0) return [];

    const draw = result.drawId
      ? catalog.draws.find((candidate) => candidate.id === result.drawId)
      : undefined;
    const game = result.gameId
      ? catalog.traditional.find((candidate) => candidate.id === result.gameId)
      : undefined;
    const drawLabel = draw
      ? cleanDrawLabel(draw.label) || "Quiniela"
      : result.label?.trim() || "Quiniela";
    const productLabel = result.gameName?.trim() || game?.name || tab.label;

    return numbers.map(({ sequence, value }) => ({
      id: `${result.id}-${sequence + 1}`,
      tabId: tab.id,
      modality: tab.label,
      productLabel,
      position: null,
      value,
      occurredAt: timestamp.source,
      dateLabel: ASUNCION_DATE_FORMATTER.format(timestamp.milliseconds),
      timeLabel: ASUNCION_TIME_FORMATTER.format(timestamp.milliseconds),
      drawLabel,
      sequence,
      sourceIndex,
      timestamp: timestamp.milliseconds,
    }));
  });

  return candidates
    .sort(
      (left, right) =>
        right.timestamp - left.timestamp ||
        left.sourceIndex - right.sourceIndex ||
        left.sequence - right.sequence,
    )
    .map((result) => ({
      id: result.id,
      tabId: result.tabId,
      modality: result.modality,
      productLabel: result.productLabel,
      position: result.position,
      value: result.value,
      occurredAt: result.occurredAt,
      dateLabel: result.dateLabel,
      timeLabel: result.timeLabel,
      drawLabel: result.drawLabel,
    }));
}
