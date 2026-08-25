import type {
  DrawDefinition,
  GamingCatalog,
  InstantGameDefinition,
  PyaeNeutralPolicy,
  TraditionalGameDefinition,
} from "./types";

export const PROTOTYPE_AMOUNTS = [
  500,
  1_000,
  2_000,
  5_000,
  10_000,
  20_000,
  50_000,
] as const;

export const HUNDRED_RANGE_OPTIONS = [
  { value: "001-099", label: "001–099" },
  { value: "100-199", label: "100–199" },
  { value: "200-299", label: "200–299" },
  { value: "300-399", label: "300–399" },
  { value: "400-499", label: "400–499" },
  { value: "500-599", label: "500–599" },
  { value: "600-699", label: "600–699" },
  { value: "700-799", label: "700–799" },
  { value: "800-899", label: "800–899" },
  { value: "900-999", label: "900–999" },
] as const;

const QUINIELA_DRAW_IDS = [
  "early",
  "morning",
  "evening",
  "night",
] as const;

export const TRADITIONAL_GAMES = [
  {
    id: "head",
    name: "A la Cabeza",
    description: "Número de tres cifras con postura fija en 1.",
    iconKey: "head",
    drawIds: QUINIELA_DRAW_IDS,
    selection: { kind: "THREE_DIGIT", position: { min: 1, max: 1 } },
  },
  {
    id: "prizes",
    name: "A los Premios",
    description: "Número de tres cifras con postura de 2 a 14.",
    iconKey: "prize",
    drawIds: QUINIELA_DRAW_IDS,
    selection: { kind: "THREE_DIGIT", position: { min: 2, max: 14 } },
  },
  {
    id: "invert",
    name: "Invertida",
    description: "Tres cifras con visualización por puntos y postura de 1 a 14.",
    iconKey: "invert",
    drawIds: QUINIELA_DRAW_IDS,
    selection: { kind: "THREE_DIGIT", position: { min: 1, max: 14 } },
  },
  {
    id: "redoblona",
    name: "Redoblona",
    description: "Número de cabeza de tres cifras más redoblona de dos cifras.",
    iconKey: "redoblona",
    drawIds: QUINIELA_DRAW_IDS,
    selection: {
      kind: "REDOBLONA",
      headDigits: 3,
      redoblonaDigits: 2,
      position: { min: 2, max: 14 },
    },
  },
  {
    id: "sapyaite-traditional",
    name: "Sapy’aite",
    description: "Quiniela rápida de tres cifras.",
    iconKey: "bolt",
    drawIds: QUINIELA_DRAW_IDS,
    selection: { kind: "THREE_DIGIT", position: null },
  },
  {
    id: "megaloto",
    name: "Megaloto",
    description: "Seis números únicos del 1 al 45, manuales o al azar.",
    iconKey: "mega",
    drawIds: QUINIELA_DRAW_IDS,
    selection: {
      kind: "MEGALOTO",
      count: 6,
      min: 1,
      max: 45,
      unique: true,
      modalities: ["MEGA_FULL", "MEGA_POZO"],
    },
  },
] as const satisfies readonly TraditionalGameDefinition[];

const BASE_INSTANT_GAMES = [
  {
    id: "sapyaite",
    name: "Sapy’aite",
    description: "Elegí PAR o IMPAR para un resultado de 001 a 999.",
    iconKey: "bolt",
    engine: "PARITY",
    reels: 1,
    rng: { min: 1, max: 999 },
    selection: { kind: "ENUM", values: ["PAR", "IMPAR"] },
    payout: { prototype: true, kind: "MULTIPLIER", winMultiplier: 2 },
  },
  {
    id: "poa",
    name: "Po’a",
    description: "Elegí la centena en la que caerá el resultado.",
    iconKey: "poa",
    engine: "HUNDRED_RANGE",
    reels: 1,
    rng: { min: 1, max: 999 },
    selection: { kind: "HUNDRED_RANGE", values: HUNDRED_RANGE_OPTIONS },
    payout: { prototype: true, kind: "MULTIPLIER", winMultiplier: 9 },
  },
  {
    id: "pyae",
    name: "Pya’e",
    description: "Elegí MENOR o MAYOR que 500.",
    iconKey: "pyae",
    engine: "OVER_UNDER_500",
    reels: 1,
    rng: { min: 1, max: 999 },
    selection: { kind: "ENUM", values: ["MENOR", "MAYOR"] },
    payout: { prototype: true, kind: "MULTIPLIER", winMultiplier: 2 },
  },
  {
    id: "petei",
    name: "Peteĩ",
    description: "Elegí la última cifra, de 0 a 9.",
    iconKey: "one",
    engine: "LAST_DIGIT",
    reels: 1,
    rng: { min: 1, max: 999 },
    selection: { kind: "PADDED_INTEGER", min: 0, max: 9, width: 1 },
    payout: { prototype: true, kind: "MULTIPLIER", winMultiplier: 9 },
  },
  {
    id: "mokoi",
    name: "Mokõi",
    description: "Elegí las últimas dos cifras, de 00 a 99.",
    iconKey: "two",
    engine: "LAST_TWO_DIGITS",
    reels: 1,
    rng: { min: 1, max: 999 },
    selection: { kind: "PADDED_INTEGER", min: 0, max: 99, width: 2 },
    payout: { prototype: true, kind: "MULTIPLIER", winMultiplier: 80 },
  },
  {
    id: "mbohapy",
    name: "Mbohapy",
    description: "Elegí un número exacto de 001 a 999.",
    iconKey: "three",
    engine: "EXACT_THREE_DIGITS",
    reels: 1,
    rng: { min: 1, max: 999 },
    selection: { kind: "PADDED_INTEGER", min: 1, max: 999, width: 3 },
    payout: { prototype: true, kind: "MULTIPLIER", winMultiplier: 700 },
  },
  {
    id: "poa5",
    name: "Po’a 5",
    description: "Elegí tres números y comparalos con cinco resultados.",
    iconKey: "poa5",
    engine: "MULTI_EXACT",
    reels: 5,
    rng: { min: 1, max: 999 },
    selection: {
      kind: "UNIQUE_THREE_DIGIT_NUMBERS",
      count: 3,
      min: 1,
      max: 999,
    },
    payout: {
      prototype: true,
      kind: "MATCH_TIERS",
      tiers: [
        { exactMatches: 1, multiplier: 60 },
        { exactMatches: 2, multiplier: 500 },
        { exactMatches: 3, multiplier: 5_000 },
      ],
      pendingFromMatches: 4,
    },
  },
  {
    id: "poa10",
    name: "Po’a 10",
    description: "Elegí tres números y comparalos con diez resultados.",
    iconKey: "poa10",
    engine: "MULTI_EXACT",
    reels: 10,
    rng: { min: 1, max: 999 },
    selection: {
      kind: "UNIQUE_THREE_DIGIT_NUMBERS",
      count: 3,
      min: 1,
      max: 999,
    },
    payout: {
      prototype: true,
      kind: "MATCH_TIERS",
      tiers: [
        { exactMatches: 1, multiplier: 25 },
        { exactMatches: 2, multiplier: 400 },
        { exactMatches: 3, multiplier: 12_500 },
      ],
      pendingFromMatches: 4,
    },
  },
  {
    id: "racha5",
    name: "Racha 5",
    description: "Elegí PAR o IMPAR y sumá coincidencias en cinco resultados.",
    iconKey: "racha5",
    engine: "MULTI_PARITY",
    reels: 5,
    rng: { min: 1, max: 999 },
    selection: { kind: "ENUM", values: ["PAR", "IMPAR"] },
    payout: {
      prototype: true,
      kind: "MATCH_TIERS",
      tiers: [
        { exactMatches: 4, multiplier: 3 },
        { exactMatches: 5, multiplier: 15 },
      ],
    },
  },
] as const satisfies readonly InstantGameDefinition[];

function atTime(base: Date, hoursFromNow: number): string {
  return new Date(base.getTime() + hoursFromNow * 60 * 60 * 1_000).toISOString();
}

export function buildMockDraws(now = new Date()): readonly DrawDefinition[] {
  const definitions = [
    ["early", "Tempranero · 10:00", "QUINIELA", 2],
    ["morning", "Matutino · 13:00", "QUINIELA", 5],
    ["evening", "Vespertino · 17:00", "QUINIELA", 9],
    ["night", "Nocturno · 21:00", "QUINIELA", 13],
  ] as const;

  return definitions.map(([id, label, family, hours]) => ({
    id,
    label,
    family,
    closesAt: atTime(now, hours - 0.25),
    drawsAt: atTime(now, hours),
    status: "OPEN",
  }));
}

export function buildInstantGames(
  neutral500Policy: PyaeNeutralPolicy = "REFUND",
): readonly InstantGameDefinition[] {
  return BASE_INSTANT_GAMES.map((game) =>
    game.id === "pyae" ? { ...game, neutral500Policy } : game,
  );
}

export function buildGamingCatalog(
  neutral500Policy: PyaeNeutralPolicy = "REFUND",
  now = new Date(),
): GamingCatalog {
  return {
    amounts: PROTOTYPE_AMOUNTS,
    draws: buildMockDraws(now),
    traditional: TRADITIONAL_GAMES,
    instant: buildInstantGames(neutral500Policy),
  };
}

export function findTraditionalGame(id: string): TraditionalGameDefinition | undefined {
  return TRADITIONAL_GAMES.find((game) => game.id === id);
}

export function findInstantGame(
  id: string,
  neutral500Policy: PyaeNeutralPolicy = "REFUND",
): InstantGameDefinition | undefined {
  return buildInstantGames(neutral500Policy).find((game) => game.id === id);
}
