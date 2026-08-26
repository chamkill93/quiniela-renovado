import type { DrawDefinition, GamingCatalog } from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";

const ASUNCION_TIME_FORMATTER = new Intl.DateTimeFormat("es-PY", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Asuncion",
});

const HERO_DRAW_ASSET_ROOT = "/assets/quinie-home-v3/draws";

const HERO_DRAW_PRESENTATION = {
  early: { label: "Tempranero", slug: "tempranero" },
  morning: { label: "Matutino", slug: "matutino" },
  evening: { label: "Vespertino", slug: "vespertino" },
  night: { label: "Nocturno", slug: "nocturno" },
} as const;

export type HomeHeroDrawIconSlug =
  (typeof HERO_DRAW_PRESENTATION)[keyof typeof HERO_DRAW_PRESENTATION]["slug"];

export interface HomeHeroDrawIcon {
  dark: string;
  light: string;
  slug: HomeHeroDrawIconSlug;
}

export interface HomeHeroResult {
  id: string;
  value: string;
  occurredAt: string;
  spinKey: string;
}

export type HomeHeroCountdown =
  | {
      state: "unavailable";
      totalSeconds: null;
      hours: null;
      minutes: null;
      seconds: null;
    }
  | {
      state: "open" | "closed";
      totalSeconds: number;
      hours: string;
      minutes: string;
      seconds: string;
    };

export interface HomeHeroDraw {
  id: string;
  name: string;
  drawsAt: string;
  closesAt: string;
  timeLabel: string;
  href: "/quinielas";
  iconSlug: HomeHeroDrawIconSlug | null;
  state: HomeHeroCountdown["state"];
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

function normalizeHeroNumber(value: unknown): string | null {
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
    const normalized = normalizeHeroNumber(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function resultTimestamp(result: MockResult): ParsedTimestamp | null {
  return parseTimestamp(result.occurredAt) ?? parseTimestamp(result.publishedAt);
}

function isQuinielaResult(result: MockResult, catalog: GamingCatalog): boolean {
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

export function selectLatestHeroResult(
  results: readonly MockResult[],
  catalog: GamingCatalog,
): HomeHeroResult | null {
  const candidates = results.flatMap((result, sourceIndex) => {
    if (!isQuinielaResult(result, catalog)) return [];
    const value = resultNumber(result);
    const timestamp = resultTimestamp(result);
    if (!value || !timestamp) return [];

    return [{ result, sourceIndex, timestamp, value }];
  });

  candidates.sort(
    (left, right) =>
      right.timestamp.milliseconds - left.timestamp.milliseconds ||
      left.sourceIndex - right.sourceIndex,
  );
  const latest = candidates[0];
  if (!latest) return null;

  return {
    id: latest.result.id,
    value: latest.value,
    occurredAt: latest.timestamp.source,
    spinKey: `${latest.result.id}:${latest.timestamp.source}`,
  };
}

export function getHeroCountdown(
  closesAt: string,
  nowMs: number,
): HomeHeroCountdown {
  const closing = parseTimestamp(closesAt);
  if (!closing || !Number.isFinite(nowMs)) {
    return {
      state: "unavailable",
      totalSeconds: null,
      hours: null,
      minutes: null,
      seconds: null,
    };
  }

  const remainingMilliseconds = closing.milliseconds - nowMs;
  if (remainingMilliseconds <= 0) {
    return {
      state: "closed",
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
    state: "open",
    totalSeconds,
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

function isKnownHeroDrawId(
  drawId: string,
): drawId is keyof typeof HERO_DRAW_PRESENTATION {
  return Object.hasOwn(HERO_DRAW_PRESENTATION, drawId);
}

export function getHomeHeroDrawIcon(drawId: string): HomeHeroDrawIcon | null {
  if (!isKnownHeroDrawId(drawId)) return null;
  const { slug } = HERO_DRAW_PRESENTATION[drawId];
  return {
    slug,
    dark: `${HERO_DRAW_ASSET_ROOT}/dark/${slug}.webp`,
    light: `${HERO_DRAW_ASSET_ROOT}/light/${slug}.webp`,
  };
}

function drawName(draw: DrawDefinition): string {
  const withoutTime = draw.label
    .trim()
    .replace(/\s*(?:·|•|-)\s*\d{1,2}:\d{2}\s*$/u, "")
    .trim();
  if (withoutTime) return withoutTime;
  return isKnownHeroDrawId(draw.id)
    ? HERO_DRAW_PRESENTATION[draw.id].label
    : "Sorteo";
}

export function selectNextHeroDraw(
  draws: readonly DrawDefinition[],
  nowMs: number,
): HomeHeroDraw | null {
  if (!Number.isFinite(nowMs)) return null;

  const next = draws
    .flatMap((draw, sourceIndex) => {
      if (draw.family !== "QUINIELA") return [];
      const timestamp = parseTimestamp(draw.drawsAt);
      if (!timestamp || timestamp.milliseconds <= nowMs) return [];
      return [{ draw, sourceIndex, timestamp }];
    })
    .sort(
      (left, right) =>
        left.timestamp.milliseconds - right.timestamp.milliseconds ||
        left.sourceIndex - right.sourceIndex,
    )[0];
  if (!next) return null;

  const closing = parseTimestamp(next.draw.closesAt);
  const countdown = getHeroCountdown(next.draw.closesAt, nowMs);
  const state =
    !closing || closing.milliseconds > next.timestamp.milliseconds
      ? "unavailable"
      : countdown.state;
  const icon = getHomeHeroDrawIcon(next.draw.id);

  return {
    id: next.draw.id,
    name: drawName(next.draw),
    drawsAt: next.timestamp.source,
    closesAt: next.draw.closesAt,
    timeLabel: ASUNCION_TIME_FORMATTER.format(next.timestamp.milliseconds),
    href: "/quinielas",
    iconSlug: icon?.slug ?? null,
    state,
  };
}
