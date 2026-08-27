import type {
  GamingCatalog,
  InstantGameDefinition,
  TraditionalGameDefinition,
} from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";
import { SAPYAITE_PATH } from "./product-links";

import {
  isQuinieGameIconId,
  type QuinieGameIconId,
} from "./game-icon-map";

export type CatalogFamily = "instant" | "traditional";
export type GameTone = "red" | "orange" | "blue" | "purple" | "green" | "teal";

interface GameVisualMetadata {
  iconKey: QuinieGameIconId;
  tone: GameTone;
}

export interface CatalogGameView {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  iconKey: QuinieGameIconId | null;
  tone: GameTone;
  baseAmount: number | null;
  href: string;
}

export interface PublishedResultView {
  id: string;
  label: string;
  result: string;
  resultNumbers: readonly string[];
  occurredAt: string | null;
  tone: GameTone;
}

const DEFAULT_VISUAL: GameVisualMetadata = {
  iconKey: "head",
  tone: "red",
};

const GAME_ICON_KEY_ALIASES = {
  "a-la-cabeza": "head",
  "a-los-premios": "prizes",
  invertida: "invert",
  "sapyaite-tradicional": "sapyaite-traditional",
  "poa-5": "poa5",
  "poa-10": "poa10",
  "racha-5": "racha5",
  bolt: "sapyaite",
  prize: "prizes",
  mega: "megaloto",
  one: "petei",
  two: "mokoi",
  three: "mbohapy",
} as const satisfies Readonly<Record<string, QuinieGameIconId>>;
const VISIBLE_TRADITIONAL_GAME_IDS = new Set([
  "head",
  "prizes",
  "invert",
  "redoblona",
]);

const SIMPLE_CATALOG_DESCRIPTIONS: Readonly<Record<string, string>> = {
  head: "Elegí 3 cifras para el primer premio.",
  prizes: "Elegí 3 cifras y hasta qué posición juega.",
  invert: "Jugá las 3 cifras en distinto orden.",
  redoblona: "Combiná un número y una terminación.",
  sapyaite: "Elegí las 3 cifras exactas.",
  poa: "Elegí una centena.",
  pyae: "Menor o mayor que 500.",
  petei: "Elegí la última cifra.",
  mokoi: "Elegí las últimas 2 cifras.",
  mbohapy: "Elegí las 3 cifras exactas.",
  poa5: "3 números en 5 giros.",
  poa10: "3 números en 10 giros.",
  racha5: "Par o impar en 5 giros.",
};

/** Presentation-only metadata. Names, rules, prices and results never live here. */
export const GAME_VISUALS: Readonly<Record<string, GameVisualMetadata>> = {
  head: { iconKey: "head", tone: "red" },
  prizes: { iconKey: "prizes", tone: "orange" },
  invert: { iconKey: "invert", tone: "blue" },
  redoblona: { iconKey: "redoblona", tone: "teal" },
  "sapyaite-traditional": { iconKey: "sapyaite-traditional", tone: "purple" },
  megaloto: { iconKey: "megaloto", tone: "blue" },
  sapyaite: { iconKey: "sapyaite", tone: "purple" },
  poa: { iconKey: "poa", tone: "green" },
  pyae: { iconKey: "pyae", tone: "purple" },
  petei: { iconKey: "petei", tone: "red" },
  mokoi: { iconKey: "mokoi", tone: "blue" },
  mbohapy: { iconKey: "mbohapy", tone: "orange" },
  poa5: { iconKey: "poa5", tone: "red" },
  poa10: { iconKey: "poa10", tone: "blue" },
  racha5: { iconKey: "racha5", tone: "green" },
};

function resolveIconCandidate(value: string | null | undefined): QuinieGameIconId | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  if (isQuinieGameIconId(candidate)) return candidate;
  if (!Object.hasOwn(GAME_ICON_KEY_ALIASES, candidate)) return null;
  return GAME_ICON_KEY_ALIASES[candidate as keyof typeof GAME_ICON_KEY_ALIASES];
}

/**
 * Resolve only approved presentation IDs. Backoffice keys and product IDs are
 * never interpolated into asset paths; an unknown pair intentionally has no
 * icon instead of borrowing an unrelated game's artwork.
 */
export function resolveCatalogGameIconId(
  gameId: string,
  backofficeIconKey: string | null | undefined,
): QuinieGameIconId | null {
  const normalizedGameId = gameId.trim();

  // The product contract is authoritative whenever it provides a canonical
  // ID. iconKey is only a presentation fallback for non-canonical remote IDs.
  if (isQuinieGameIconId(normalizedGameId)) return normalizedGameId;
  return resolveIconCandidate(backofficeIconKey) ?? resolveIconCandidate(normalizedGameId);
}

function minimumAmount(amounts: readonly number[]) {
  const validAmounts = amounts.filter(
    (amount) => Number.isFinite(amount) && amount > 0,
  );
  return validAmounts.length > 0 ? Math.min(...validAmounts) : null;
}

function instantEyebrow(game: InstantGameDefinition) {
  return game.reels === 1 ? "Resultado inmediato" : `${game.reels} rodillos`;
}

function traditionalEyebrow(game: TraditionalGameDefinition) {
  if (game.selection.kind === "MEGALOTO") {
    return `${game.selection.count} números`;
  }
  if (game.selection.kind === "REDOBLONA") return "Doble selección";
  return "Quiniela tradicional";
}

function normalizeLimit(limit: number | undefined, length: number) {
  if (limit === undefined) return length;
  if (!Number.isFinite(limit)) return 0;
  return Math.max(0, Math.trunc(limit));
}

export function mapCatalogGames(
  catalog: GamingCatalog,
  family: CatalogFamily,
  limit?: number,
): CatalogGameView[] {
  const amount = minimumAmount(catalog.amounts);
  const games = family === "traditional"
    ? catalog.traditional.filter((game) => VISIBLE_TRADITIONAL_GAME_IDS.has(game.id))
    : catalog.instant;
  return games.slice(0, normalizeLimit(limit, games.length)).map((game) => {
    const visual = GAME_VISUALS[game.id];
    return {
      id: game.id,
      name: game.name,
      eyebrow:
        family === "instant"
          ? instantEyebrow(game as InstantGameDefinition)
          : traditionalEyebrow(game as TraditionalGameDefinition),
      description: SIMPLE_CATALOG_DESCRIPTIONS[game.id] ?? game.description,
      iconKey: resolveCatalogGameIconId(game.id, game.iconKey) ?? visual?.iconKey ?? null,
      tone: visual?.tone ?? DEFAULT_VISUAL.tone,
      baseAmount: amount,
      href:
        family === "instant" && game.id === "sapyaite"
          ? SAPYAITE_PATH
          : family === "instant"
          ? `/instantaneas/${game.id}`
          : `/quinielas/${game.id}`,
    };
  });
}

/** Group the public catalog without changing game contracts or enabled status. */
export function mapQuinielaCatalogGames(catalog: GamingCatalog): CatalogGameView[] {
  return [
    ...mapCatalogGames(catalog, "traditional"),
    ...mapCatalogGames(catalog, "instant").filter((game) => game.id === "sapyaite"),
  ];
}

function resultNumbers(result: MockResult) {
  const values = result.resultNumbers ?? result.numbers ?? [];
  return values.map(String).map((value) => value.trim()).filter(Boolean);
}

function resultValue(result: MockResult, numbers: readonly string[]) {
  const direct = result.result?.trim();
  if (direct) return direct;
  return numbers.length > 0 ? numbers.join(" · ") : null;
}

function catalogGameName(catalog: GamingCatalog, gameId: string | undefined) {
  if (!gameId) return undefined;
  return [...catalog.traditional, ...catalog.instant].find(
    (game) => game.id === gameId,
  )?.name;
}

export function mapPublishedResults(
  catalog: GamingCatalog,
  results: readonly MockResult[],
  source: "DRAW" | "INSTANT",
  limit?: number,
): PublishedResultView[] {
  const mapped = results.flatMap((item) => {
    if (item.source !== source) return [];
    const numbers = resultNumbers(item);
    const value = resultValue(item, numbers);
    if (!value) return [];

    const draw = item.drawId
      ? catalog.draws.find((candidate) => candidate.id === item.drawId)
      : undefined;
    const visual = item.gameId
      ? GAME_VISUALS[item.gameId] ?? DEFAULT_VISUAL
      : DEFAULT_VISUAL;
    const fallbackLabel = source === "DRAW" ? "Sorteo" : "Instantánea";

    return [{
      id: item.id,
      label:
        draw?.label ??
        item.label ??
        item.gameName ??
        catalogGameName(catalog, item.gameId) ??
        fallbackLabel,
      result: value,
      resultNumbers: numbers,
      occurredAt: item.occurredAt ?? item.publishedAt ?? null,
      tone: visual.tone,
    } satisfies PublishedResultView];
  });

  return mapped.slice(0, normalizeLimit(limit, mapped.length));
}
