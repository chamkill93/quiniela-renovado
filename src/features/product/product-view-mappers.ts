import type {
  GamingCatalog,
  InstantGameDefinition,
  TraditionalGameDefinition,
} from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";

export type CatalogFamily = "instant" | "traditional";
export type GameTone = "red" | "orange" | "blue" | "purple" | "green";

interface GameVisualMetadata {
  iconKey: string;
  tone: GameTone;
}

export interface CatalogGameView {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  iconKey: string;
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

const LEGACY_ICON_KEYS = new Set(["bolt", "prize", "mega", "one", "two", "three"]);
const VISIBLE_TRADITIONAL_GAME_IDS = new Set([
  "head",
  "prizes",
  "invert",
  "redoblona",
]);

/** Presentation-only metadata. Names, rules, prices and results never live here. */
export const GAME_VISUALS: Readonly<Record<string, GameVisualMetadata>> = {
  head: { iconKey: "head", tone: "red" },
  prizes: { iconKey: "prizes", tone: "orange" },
  invert: { iconKey: "invert", tone: "blue" },
  redoblona: { iconKey: "redoblona", tone: "red" },
  "sapyaite-traditional": { iconKey: "sapyaite", tone: "purple" },
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
    const visual = GAME_VISUALS[game.id] ?? DEFAULT_VISUAL;
    return {
      id: game.id,
      name: game.name,
      eyebrow:
        family === "instant"
          ? instantEyebrow(game as InstantGameDefinition)
          : traditionalEyebrow(game as TraditionalGameDefinition),
      description: game.description,
      iconKey:
        game.iconKey?.trim() && !LEGACY_ICON_KEYS.has(game.iconKey.trim())
          ? game.iconKey.trim()
          : visual.iconKey,
      tone: visual.tone,
      baseAmount: amount,
      href:
        family === "instant"
          ? `/instantaneas/${game.id}`
          : `/quinielas/${game.id}`,
    };
  });
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
