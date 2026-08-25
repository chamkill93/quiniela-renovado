export type TraditionalGameId =
  | "head"
  | "prizes"
  | "invert"
  | "redoblona"
  | "sapyaite-traditional"
  | "megaloto";

export type InstantGameId =
  | "sapyaite"
  | "poa"
  | "pyae"
  | "petei"
  | "mokoi"
  | "mbohapy"
  | "poa5"
  | "poa10"
  | "racha5";

export interface ProductGame<TId extends string> {
  id: TId;
  name: string;
  eyebrow: string;
  description: string;
  icon: string;
  art: string;
}

export const TRADITIONAL_GAMES: ProductGame<TraditionalGameId>[] = [
  {
    id: "head",
    name: "A la Cabeza",
    eyebrow: "Quiniela clásica",
    description: "Elegí un número de tres cifras para la primera posición.",
    icon: "/assets/icons/game/head.svg",
    art: "/assets/game-art/head.webp",
  },
  {
    id: "prizes",
    name: "A los Premios",
    eyebrow: "Más posiciones",
    description: "Tu número participa desde la segunda hasta la decimocuarta posición.",
    icon: "/assets/icons/game/prize.svg",
    art: "/assets/game-art/prize.webp",
  },
  {
    id: "invert",
    name: "Invertida",
    eyebrow: "Tres cifras",
    description: "Jugá las tres cifras con una lectura visual clara por posición.",
    icon: "/assets/icons/game/invert.svg",
    art: "/assets/game-art/invert.webp",
  },
  {
    id: "redoblona",
    name: "Redoblona",
    eyebrow: "Doble selección",
    description: "Combiná un número de cabeza con una terminación de dos cifras.",
    icon: "/assets/icons/game/redoblona.svg",
    art: "/assets/game-art/redoblona.webp",
  },
  {
    id: "sapyaite-traditional",
    name: "Sapy’aite",
    eyebrow: "Quiniela rápida",
    description: "La forma directa de ingresar una selección tradicional de tres cifras.",
    icon: "/assets/icons/game/bolt.svg",
    art: "/assets/game-art/bolt.webp",
  },
  {
    id: "megaloto",
    name: "Megaloto",
    eyebrow: "6 del 1 al 45",
    description: "Armá una combinación única de seis números, manual o al azar.",
    icon: "/assets/icons/game/mega.svg",
    art: "/assets/game-art/mega.webp",
  },
];

export const INSTANT_GAMES: ProductGame<InstantGameId>[] = [
  {
    id: "sapyaite",
    name: "Sapy’aite",
    eyebrow: "Par o impar",
    description: "Elegí la paridad de un resultado entre 001 y 999.",
    icon: "/assets/icons/game/bolt.svg",
    art: "/assets/game-art/bolt.webp",
  },
  {
    id: "poa",
    name: "Po’a",
    eyebrow: "La centena",
    description: "Elegí el rango de centena en el que caerá el resultado.",
    icon: "/assets/icons/game/poa.svg",
    art: "/assets/game-art/poa.webp",
  },
  {
    id: "pyae",
    name: "Pya’e",
    eyebrow: "Mayor o menor",
    description: "Anticipá si el número será menor o mayor que 500.",
    icon: "/assets/icons/game/pyae.svg",
    art: "/assets/game-art/pyae.webp",
  },
  {
    id: "petei",
    name: "Peteĩ",
    eyebrow: "Última cifra",
    description: "Elegí la cifra final del resultado de tres dígitos.",
    icon: "/assets/icons/game/petei.svg",
    art: "/assets/game-art/one.webp",
  },
  {
    id: "mokoi",
    name: "Mokõi",
    eyebrow: "Últimas dos",
    description: "Elegí las dos cifras con las que terminará el resultado.",
    icon: "/assets/icons/game/mokoi.svg",
    art: "/assets/game-art/two.webp",
  },
  {
    id: "mbohapy",
    name: "Mbohapy",
    eyebrow: "Número exacto",
    description: "Buscá la coincidencia exacta de las tres cifras.",
    icon: "/assets/icons/game/mbohapy.svg",
    art: "/assets/game-art/three.webp",
  },
  {
    id: "poa5",
    name: "Po’a 5",
    eyebrow: "Cinco rodillos",
    description: "Elegí tres números distintos y encontralos en cinco resultados.",
    icon: "/assets/icons/game/poa5.svg",
    art: "/assets/game-art/prize.webp",
  },
  {
    id: "poa10",
    name: "Po’a 10",
    eyebrow: "Diez rodillos",
    description: "Tus tres elegidos se enfrentan a diez resultados independientes.",
    icon: "/assets/icons/game/poa10.svg",
    art: "/assets/game-art/mega.webp",
  },
  {
    id: "racha5",
    name: "Racha 5",
    eyebrow: "Cinco paridades",
    description: "Elegí par o impar y buscá cuatro o cinco coincidencias.",
    icon: "/assets/icons/game/racha5.svg",
    art: "/assets/game-art/redoblona.webp",
  },
];

export const MOCK_DRAWS = [
  { id: "early", label: "Tempranero", time: "10:00", result: "353", tone: "orange" },
  { id: "morning", label: "Matutino", time: "13:00", result: "487", tone: "blue" },
  { id: "evening", label: "Vespertino", time: "17:00", result: "619", tone: "red" },
  { id: "night", label: "Nocturno", time: "21:00", result: "842", tone: "purple" },
] as const;

export const BET_AMOUNTS = [5_000, 10_000, 20_000, 50_000] as const;

export function getTraditionalGame(id: string) {
  return TRADITIONAL_GAMES.find((game) => game.id === id);
}

export function getInstantGame(id: string) {
  return INSTANT_GAMES.find((game) => game.id === id);
}

export function formatGs(value: number) {
  return `Gs. ${new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(value)}`;
}

export function padNumber(value: string | number, digits = 3) {
  return String(value).replace(/\D/g, "").slice(0, digits).padStart(digits, "0");
}
