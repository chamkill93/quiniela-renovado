export type QuinieTheme = "dark" | "light";

export type TraditionalGameIconId =
  | "head"
  | "prizes"
  | "invert"
  | "redoblona"
  | "sapyaite-traditional"
  | "megaloto";

export type InstantGameIconId =
  | "sapyaite"
  | "poa"
  | "pyae"
  | "petei"
  | "mokoi"
  | "mbohapy"
  | "poa5"
  | "poa10"
  | "racha5";

export type QuinieGameIconId = TraditionalGameIconId | InstantGameIconId;

interface GameIconDefinition {
  family: "traditional" | "instant";
  slug: string;
}

export interface GameIconAssetSet extends GameIconDefinition {
  dark: string;
  light: string;
}

const ICON_ROOT = "/assets/quinie-icons-v2/games";

/**
 * Presentation-only mapping from canonical product IDs to approved assets.
 * Backoffice icon keys are intentionally not interpolated into public paths.
 */
export const GAME_ICON_DEFINITIONS = {
  head: { family: "traditional", slug: "a-la-cabeza" },
  prizes: { family: "traditional", slug: "a-los-premios" },
  invert: { family: "traditional", slug: "invertida" },
  redoblona: { family: "traditional", slug: "redoblona" },
  "sapyaite-traditional": {
    family: "traditional",
    slug: "sapyaite-tradicional",
  },
  megaloto: { family: "traditional", slug: "megaloto" },
  sapyaite: { family: "instant", slug: "sapyaite" },
  poa: { family: "instant", slug: "poa" },
  pyae: { family: "instant", slug: "pyae" },
  petei: { family: "instant", slug: "petei" },
  mokoi: { family: "instant", slug: "mokoi" },
  mbohapy: { family: "instant", slug: "mbohapy" },
  poa5: { family: "instant", slug: "poa-5" },
  poa10: { family: "instant", slug: "poa-10" },
  racha5: { family: "instant", slug: "racha-5" },
} as const satisfies Readonly<Record<QuinieGameIconId, GameIconDefinition>>;

export function isQuinieGameIconId(value: string): value is QuinieGameIconId {
  return Object.hasOwn(GAME_ICON_DEFINITIONS, value);
}

export function getGameIcon(
  gameId: string,
  theme: QuinieTheme,
): string | null {
  if (!isQuinieGameIconId(gameId)) return null;
  const { family, slug } = GAME_ICON_DEFINITIONS[gameId];
  return `${ICON_ROOT}/${family}/${theme}/${slug}.webp`;
}

export function getGameIconAssetSet(gameId: string): GameIconAssetSet | null {
  if (!isQuinieGameIconId(gameId)) return null;
  const definition = GAME_ICON_DEFINITIONS[gameId];
  return {
    ...definition,
    dark: getGameIcon(gameId, "dark")!,
    light: getGameIcon(gameId, "light")!,
  };
}
