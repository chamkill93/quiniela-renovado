import type { DrawDefinition } from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";

const ASUNCION_TIME_ZONE = "America/Asuncion";

const DRAW_TIME_FORMATTER = new Intl.DateTimeFormat("es-PY", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: ASUNCION_TIME_ZONE,
});

const DRAW_DATE_FORMATTER = new Intl.DateTimeFormat("es-PY", {
  dateStyle: "full",
  timeZone: ASUNCION_TIME_ZONE,
});

const RESULT_DATE_FORMATTER = new Intl.DateTimeFormat("es-PY", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: ASUNCION_TIME_ZONE,
});

export type DrawPageDrawId = "early" | "morning" | "evening" | "night";
export type DrawPageSlug =
  | "tempranero"
  | "matutino"
  | "vespertino"
  | "nocturno";

export interface DrawPageDefinition {
  slug: DrawPageSlug;
  drawId: DrawPageDrawId;
  name: string;
  iconSlug: DrawPageSlug;
}

const DRAW_PAGE_BY_SLUG = {
  tempranero: {
    slug: "tempranero",
    drawId: "early",
    name: "Tempranero",
    iconSlug: "tempranero",
  },
  matutino: {
    slug: "matutino",
    drawId: "morning",
    name: "Matutino",
    iconSlug: "matutino",
  },
  vespertino: {
    slug: "vespertino",
    drawId: "evening",
    name: "Vespertino",
    iconSlug: "vespertino",
  },
  nocturno: {
    slug: "nocturno",
    drawId: "night",
    name: "Nocturno",
    iconSlug: "nocturno",
  },
} as const satisfies Readonly<Record<DrawPageSlug, DrawPageDefinition>>;

export const DRAW_PAGE_DEFINITIONS = Object.freeze(
  Object.values(DRAW_PAGE_BY_SLUG),
);

export function isDrawPageSlug(value: string): value is DrawPageSlug {
  return Object.hasOwn(DRAW_PAGE_BY_SLUG, value);
}

export function getDrawPageDefinition(
  slug: string,
): DrawPageDefinition | null {
  return isDrawPageSlug(slug) ? DRAW_PAGE_BY_SLUG[slug] : null;
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

function capitalize(value: string) {
  return value ? `${value.charAt(0).toLocaleUpperCase("es-PY")}${value.slice(1)}` : value;
}

export interface DrawPageSchedule {
  draw: DrawDefinition;
  drawsAt: string;
  drawsAtMs: number;
  closesAt: string | null;
  closesAtMs: number | null;
  dateLabel: string;
  timeLabel: string;
  closingTimeLabel: string | null;
}

export function selectDrawPageSchedule(
  draws: readonly DrawDefinition[],
  definition: DrawPageDefinition,
): DrawPageSchedule | null {
  const draw = draws.find(
    (candidate) =>
      candidate.id === definition.drawId && candidate.family === "QUINIELA",
  );
  if (!draw) return null;

  const drawsAt = parseTimestamp(draw.drawsAt);
  if (!drawsAt) return null;
  const closesAt = parseTimestamp(draw.closesAt);

  return {
    draw,
    drawsAt: drawsAt.source,
    drawsAtMs: drawsAt.milliseconds,
    closesAt: closesAt?.source ?? null,
    closesAtMs: closesAt?.milliseconds ?? null,
    dateLabel: capitalize(DRAW_DATE_FORMATTER.format(drawsAt.milliseconds)),
    timeLabel: DRAW_TIME_FORMATTER.format(drawsAt.milliseconds),
    closingTimeLabel: closesAt
      ? DRAW_TIME_FORMATTER.format(closesAt.milliseconds)
      : null,
  };
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

function resultNumber(result: MockResult): string | null {
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

export interface DrawPageResult {
  id: string;
  value: string;
  occurredAt: string;
  occurredAtMs: number;
  occurredLabel: string;
  label: string | null;
}

export function selectDrawPageResults(
  results: readonly MockResult[],
  drawId: DrawPageDrawId,
  limit = 6,
): DrawPageResult[] {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(0, Math.min(12, Math.trunc(limit)))
    : 6;

  return results
    .flatMap((result, sourceIndex) => {
      if (
        result.source !== "DRAW" ||
        result.drawId !== drawId ||
        result.gameId === "megaloto"
      ) {
        return [];
      }
      const value = resultNumber(result);
      const timestamp =
        parseTimestamp(result.occurredAt) ?? parseTimestamp(result.publishedAt);
      if (!value || !timestamp) return [];
      const label = result.gameName?.trim() || result.label?.trim() || null;
      return [{ result, sourceIndex, timestamp, value, label }];
    })
    .sort(
      (left, right) =>
        right.timestamp.milliseconds - left.timestamp.milliseconds ||
        left.sourceIndex - right.sourceIndex,
    )
    .slice(0, safeLimit)
    .map(({ result, timestamp, value, label }) => ({
      id: result.id,
      value,
      occurredAt: timestamp.source,
      occurredAtMs: timestamp.milliseconds,
      occurredLabel: RESULT_DATE_FORMATTER.format(timestamp.milliseconds),
      label,
    }));
}

export type DrawPageCountdown =
  | {
      state: "unavailable";
      totalSeconds: null;
      hours: null;
      minutes: null;
      seconds: null;
    }
  | {
      state: "upcoming" | "elapsed";
      totalSeconds: number;
      hours: string;
      minutes: string;
      seconds: string;
    };

export function getDrawPageCountdown(
  drawsAt: string,
  nowMs: number,
): DrawPageCountdown {
  const target = parseTimestamp(drawsAt);
  if (!target || !Number.isFinite(nowMs)) {
    return {
      state: "unavailable",
      totalSeconds: null,
      hours: null,
      minutes: null,
      seconds: null,
    };
  }

  const remainingMilliseconds = target.milliseconds - nowMs;
  if (remainingMilliseconds <= 0) {
    return {
      state: "elapsed",
      totalSeconds: 0,
      hours: "00",
      minutes: "00",
      seconds: "00",
    };
  }

  const totalSeconds = Math.ceil(remainingMilliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return {
    state: "upcoming",
    totalSeconds,
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

/** Public draw embeds are intentionally limited to credential-free HTTPS URLs. */
export function sanitizePublicDrawStreamUrl(
  value: string | null | undefined,
): string | null {
  const source = value?.trim();
  if (!source) return null;

  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function getConfiguredDrawStreamUrl(
  drawId: DrawPageDrawId,
): string | null {
  const configured =
    drawId === "early"
      ? process.env.NEXT_PUBLIC_DRAW_STREAM_TEMPRANERO_URL
      : drawId === "morning"
        ? process.env.NEXT_PUBLIC_DRAW_STREAM_MATUTINO_URL
        : drawId === "evening"
          ? process.env.NEXT_PUBLIC_DRAW_STREAM_VESPERTINO_URL
          : process.env.NEXT_PUBLIC_DRAW_STREAM_NOCTURNO_URL;

  return sanitizePublicDrawStreamUrl(configured);
}
