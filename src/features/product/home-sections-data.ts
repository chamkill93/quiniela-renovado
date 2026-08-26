import type { DrawDefinition, GamingCatalog } from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";

const ASUNCION_TIME_FORMATTER = new Intl.DateTimeFormat("es-PY", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Asuncion",
});

const ASUNCION_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-PY", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Asuncion",
});

const DRAW_ASSET_ROOT = "/assets/quinie-home-v3/draws";

export const HOME_DRAW_SLOTS = [
  { id: "early", label: "Tempranero", slug: "tempranero" },
  { id: "morning", label: "Matutino", slug: "matutino" },
  { id: "evening", label: "Vespertino", slug: "vespertino" },
  { id: "night", label: "Nocturno", slug: "nocturno" },
] as const;

export type HomeDrawId = (typeof HOME_DRAW_SLOTS)[number]["id"];
export type HomeDrawSlug = (typeof HOME_DRAW_SLOTS)[number]["slug"];
export type HomeDrawState = "open" | "closed" | "completed" | "unavailable";

export interface HomeDrawCardView {
  id: HomeDrawId;
  slug: HomeDrawSlug;
  label: string;
  href: `/sorteos/${HomeDrawSlug}`;
  iconDark: string;
  iconLight: string;
  timeLabel: string;
  statusLabel: string;
  state: HomeDrawState;
  isNext: boolean;
}

export interface HomePublishedResultView {
  id: string;
  modality: string;
  value: string;
  occurredAt: string;
  dateLabel: string;
  drawLabel: string;
}

interface ParsedTimestamp {
  source: string;
  milliseconds: number;
}

function parseTimestamp(value: string | null | undefined): ParsedTimestamp | null {
  const source = value?.trim();
  if (!source) return null;
  const milliseconds = Date.parse(source);
  return Number.isFinite(milliseconds) ? { source, milliseconds } : null;
}

function countdownLabel(closesAtMs: number, nowMs: number) {
  const totalMinutes = Math.max(1, Math.ceil((closesAtMs - nowMs) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `EN ${hours}H ${String(minutes).padStart(2, "0")}M`;
}

function findCanonicalDraw(
  draws: readonly DrawDefinition[],
  id: HomeDrawId,
) {
  return draws.find((draw) => draw.id === id && draw.family === "QUINIELA");
}

export function selectHomeDrawCards(
  draws: readonly DrawDefinition[],
  nowMs: number,
): HomeDrawCardView[] {
  const validNow = Number.isFinite(nowMs);
  const nextDrawId = validNow
    ? draws
        .flatMap((draw, sourceIndex) => {
          if (draw.family !== "QUINIELA") return [];
          const slot = HOME_DRAW_SLOTS.find((candidate) => candidate.id === draw.id);
          const drawsAt = parseTimestamp(draw.drawsAt);
          if (!slot || !drawsAt || drawsAt.milliseconds <= nowMs) return [];
          return [{ id: slot.id, sourceIndex, drawsAt: drawsAt.milliseconds }];
        })
        .sort(
          (left, right) =>
            left.drawsAt - right.drawsAt || left.sourceIndex - right.sourceIndex,
        )[0]?.id ?? null
    : null;

  return HOME_DRAW_SLOTS.map((slot) => {
    const draw = findCanonicalDraw(draws, slot.id);
    const drawsAt = parseTimestamp(draw?.drawsAt);
    const closesAt = parseTimestamp(draw?.closesAt);
    const base = {
      id: slot.id,
      slug: slot.slug,
      label: slot.label,
      href: `/sorteos/${slot.slug}` as const,
      iconDark: `${DRAW_ASSET_ROOT}/dark/${slot.slug}.webp`,
      iconLight: `${DRAW_ASSET_ROOT}/light/${slot.slug}.webp`,
      timeLabel: drawsAt
        ? ASUNCION_TIME_FORMATTER.format(drawsAt.milliseconds)
        : "--:--",
      isNext: slot.id === nextDrawId,
    };

    if (!validNow || !draw || !drawsAt) {
      return {
        ...base,
        state: "unavailable" as const,
        statusLabel: "NO DISPONIBLE",
      };
    }

    if (drawsAt.milliseconds <= nowMs) {
      return {
        ...base,
        state: "completed" as const,
        statusLabel: "HORARIO CUMPLIDO",
      };
    }

    if (!closesAt || closesAt.milliseconds > drawsAt.milliseconds) {
      return {
        ...base,
        state: "unavailable" as const,
        statusLabel: "CIERRE NO DISPONIBLE",
      };
    }

    if (closesAt.milliseconds <= nowMs) {
      return {
        ...base,
        state: "closed" as const,
        statusLabel: "VENTA CERRADA",
      };
    }

    return {
      ...base,
      state: "open" as const,
      statusLabel: countdownLabel(closesAt.milliseconds, nowMs),
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

function resultNumber(result: MockResult) {
  const candidates = [
    result.result,
    ...(result.resultNumbers ?? []),
    ...(result.numbers ?? []),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeResultNumber(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function resultTimestamp(result: MockResult) {
  return parseTimestamp(result.occurredAt) ?? parseTimestamp(result.publishedAt);
}

function resultBelongsToQuiniela(result: MockResult, catalog: GamingCatalog) {
  if (result.source !== "DRAW" || result.gameId === "megaloto") return false;

  const draw = result.drawId
    ? catalog.draws.find((candidate) => candidate.id === result.drawId)
    : undefined;
  if (draw) return draw.family === "QUINIELA";

  const game = result.gameId
    ? catalog.traditional.find((candidate) => candidate.id === result.gameId)
    : undefined;
  return Boolean(game && game.selection.kind !== "MEGALOTO");
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
    const value = resultNumber(result);
    const timestamp = resultTimestamp(result);
    if (!value || !timestamp) return [];

    const draw = result.drawId
      ? catalog.draws.find((candidate) => candidate.id === result.drawId)
      : undefined;
    const game = result.gameId
      ? catalog.traditional.find((candidate) => candidate.id === result.gameId)
      : undefined;
    const drawLabel = draw
      ? cleanDrawLabel(draw.label) || "Quiniela"
      : result.label?.trim() || "Quiniela";

    return [{
      id: result.id,
      modality: result.gameName?.trim() || game?.name || "Quiniela",
      value,
      occurredAt: timestamp.source,
      dateLabel: ASUNCION_DATE_TIME_FORMATTER.format(timestamp.milliseconds),
      drawLabel,
      sourceIndex,
      timestamp: timestamp.milliseconds,
    }];
  });

  return candidates
    .sort(
      (left, right) =>
        right.timestamp - left.timestamp || left.sourceIndex - right.sourceIndex,
    )
    .slice(0, 4)
    .map((result) => ({
      id: result.id,
      modality: result.modality,
      value: result.value,
      occurredAt: result.occurredAt,
      dateLabel: result.dateLabel,
      drawLabel: result.drawLabel,
    }));
}
