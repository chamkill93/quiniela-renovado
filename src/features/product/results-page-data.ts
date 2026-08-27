import { DRAW_POSTURE_COUNT, type GamingCatalog, type PositionedDrawNumber } from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";
import { drawDateKey, DRAW_TIME_ZONE, isDrawDateKey } from "@/lib/gaming/draw-calendar";
import { DAILY_DRAW_SLOTS as HOME_DRAW_SLOTS } from "@/lib/gaming/daily-draw-schedule";

type HomeDrawId = (typeof HOME_DRAW_SLOTS)[number]["id"];

const dateFormatter = new Intl.DateTimeFormat("es-PY", { dateStyle: "full", timeZone: DRAW_TIME_ZONE });
const timeFormatter = new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: DRAW_TIME_ZONE });

export interface DailyPublication {
  id: string;
  gameId: string | null;
  label: string;
  values: readonly string[];
  drawNumbers?: readonly PositionedDrawNumber[];
  occurredAt: string | null;
  timeLabel: string | null;
  dateKey: string | null;
}
export interface DailyDraw {
  id: HomeDrawId;
  label: string;
  publications: DailyPublication[];
}
export interface DailyDrawResults {
  dateKey: string;
  dateLabel: string;
  draws: DailyDraw[];
}

export const RESULTS_DAYS_PER_PAGE = 5;

/** Paginate whole dates after grouping; never split a day's four draw cards. */
export function paginateDrawDays(days: readonly DailyDrawResults[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(days.length / RESULTS_DAYS_PER_PAGE));
  const page = Math.max(0, Math.min(pageCount - 1, Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 0));
  const start = page * RESULTS_DAYS_PER_PAGE;
  return {
    page, pageCount, totalDays: days.length,
    from: days.length ? start + 1 : 0,
    to: Math.min(start + RESULTS_DAYS_PER_PAGE, days.length),
    days: days.slice(start, start + RESULTS_DAYS_PER_PAGE),
  };
}

function timestamp(value: string | undefined) {
  const milliseconds = Date.parse(value ?? "");
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function canonicalDraw(catalog: GamingCatalog, result: MockResult): HomeDrawId | null {
  const draw = catalog.draws.find((item) => item.id === result.drawId);
  if (draw?.family === "MEGALOTO" || result.gameId === "megaloto") return null;
  // Match explicit IDs or a named slot, never infer a slot from publication time.
  const direct = HOME_DRAW_SLOTS.find((slot) => result.drawId === slot.id || result.drawId === slot.slug);
  if (direct) return direct.id;
  const label = draw?.label ?? result.label ?? "";
  const words = label.toLocaleLowerCase("es-PY").split(/[^a-záéíóúñ]+/);
  const matches = HOME_DRAW_SLOTS.filter((slot) => words.includes(slot.slug));
  return matches.length === 1 ? matches[0].id : null;
}

function publicNumbers(result: MockResult): string[] {
  const values = result.resultNumbers?.length ? result.resultNumbers
    : result.numbers?.length ? result.numbers
    : result.result ? [result.result] : [];
  return values.map(String).map((value) => value.trim()).filter(Boolean)
    .map((value) => /^\d{1,3}$/.test(value) ? value.padStart(3, "0") : value);
}

function positionedDrawNumbers(result: MockResult): PositionedDrawNumber[] {
  const seen = new Set<number>();
  return (result.drawNumbers ?? []).flatMap(({ position, value }) => {
    const normalized = value.trim();
    if (!Number.isInteger(position) || position < 1 || position > DRAW_POSTURE_COUNT || seen.has(position) || !/^\d{1,3}$/.test(normalized)) return [];
    seen.add(position);
    return [{ position, value: normalized.padStart(3, "0") }];
  }).sort((a, b) => a.position - b.position);
}

/** Use one draw snapshot across all modalities; never assign a modality to a posture. */
export function selectDrawPostures(draw: DailyDraw) {
  const publication = draw.publications.find((item) => item.drawNumbers !== undefined);
  const numbers = new Map(publication?.drawNumbers?.map(({ position, value }) => [position, value]));
  if (!publication) {
    const head = draw.publications.find((item) => item.gameId === "head");
    if (head?.values[0]) numbers.set(1, head.values[0]);
  }
  return Array.from({ length: DRAW_POSTURE_COUNT }, (_, index) => ({
    position: index + 1,
    value: numbers.get(index + 1) ?? null,
  }));
}

export function emptyDrawDay(dateKey: string): DailyDrawResults {
  const dateLabel = dateFormatter.format(new Date(`${dateKey}T12:00:00Z`));
  return {
    dateKey,
    dateLabel: dateLabel.charAt(0).toLocaleUpperCase("es-PY") + dateLabel.slice(1),
    draws: HOME_DRAW_SLOTS.map((slot) => ({ id: slot.id, label: slot.label, publications: [] })),
  };
}

export function selectDailyDrawResults(catalog: GamingCatalog, results: readonly MockResult[], selectedDate = "") {
  const days = new Map<string, DailyDrawResults>();
  const other: DailyPublication[] = [];
  const ordered = results.filter((result) => result.source === "DRAW").map((result, index) => ({
    result, index, time: timestamp(result.occurredAt) ?? timestamp(result.publishedAt),
  })).sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity) || a.index - b.index);
  const seen = new Set<string>();

  for (const { result, time } of ordered) {
    if (seen.has(result.id)) continue;
    const drawNumbers = result.drawNumbers === undefined ? undefined : positionedDrawNumbers(result);
    const receivedValues = publicNumbers(result);
    const values = receivedValues.length ? receivedValues : drawNumbers?.map(({ value }) => value) ?? [];
    if (!values.length && drawNumbers === undefined) continue;
    seen.add(result.id);
    const dateKey = time === null ? null : drawDateKey(time);
    if (selectedDate && dateKey !== selectedDate) continue;
    const game = catalog.traditional.find((item) => item.id === result.gameId);
    const publication: DailyPublication = {
      id: result.id, gameId: result.gameId ?? null,
      label: result.gameName?.trim() || game?.name || result.label?.trim() || "Resultado",
      values, drawNumbers, dateKey, occurredAt: time === null ? null : new Date(time).toISOString(),
      timeLabel: time === null ? null : timeFormatter.format(time),
    };
    const slot = canonicalDraw(catalog, result);
    if (!slot || !dateKey) {
      other.push(publication);
      continue;
    }
    const day = days.get(dateKey) ?? emptyDrawDay(dateKey);
    day.draws.find((draw) => draw.id === slot)!.publications.push(publication);
    days.set(dateKey, day);
  }
  if (selectedDate && isDrawDateKey(selectedDate) && !days.has(selectedDate)) {
    days.set(selectedDate, emptyDrawDay(selectedDate));
  }
  return { days: [...days.values()].sort((a, b) => b.dateKey.localeCompare(a.dateKey)), other };
}
