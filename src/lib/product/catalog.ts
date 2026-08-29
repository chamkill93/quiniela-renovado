export type TraditionalGameId =
  | "head"
  | "prizes"
  | "invert"
  | "redoblona";

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
  tone: "red" | "orange" | "blue" | "purple" | "green" | "teal";
  basePrice: number;
}

export const TRADITIONAL_GAMES: ProductGame<TraditionalGameId>[] = [
  {
    id: "head",
    name: "A la Cabeza",
    eyebrow: "Quiniela clásica",
    description: "Elegí un número de tres cifras para la primera posición.",
    icon: "/assets/icons/game/head.svg",
    art: "/assets/game-art/head.webp",
    tone: "red",
    basePrice: 500,
  },
  {
    id: "prizes",
    name: "A los Premios",
    eyebrow: "Más posiciones",
    description: "Tu número participa desde la segunda hasta la decimocuarta posición.",
    icon: "/assets/icons/game/prize.svg",
    art: "/assets/game-art/prize.webp",
    tone: "orange",
    basePrice: 500,
  },
  {
    id: "invert",
    name: "Invertida",
    eyebrow: "Tres cifras",
    description: "Jugá las tres cifras con una lectura visual clara por posición.",
    icon: "/assets/icons/game/invert.svg",
    art: "/assets/game-art/invert.webp",
    tone: "blue",
    basePrice: 500,
  },
  {
    id: "redoblona",
    name: "Redoblona",
    eyebrow: "Doble selección",
    description: "Combiná dos números de dos cifras con un único importe.",
    icon: "/assets/icons/game/redoblona.svg",
    art: "/assets/game-art/redoblona.webp",
    tone: "teal",
    basePrice: 1_000,
  },
];

export const INSTANT_GAMES: ProductGame<InstantGameId>[] = [
  {
    id: "sapyaite",
    name: "Sapy’aite",
    eyebrow: "Tres cifras exactas",
    description: "Elegí un número de 000 a 999 y acertá el resultado exacto.",
    icon: "/assets/icons/game/bolt.svg",
    art: "/assets/game-art/bolt.webp",
    tone: "purple",
    basePrice: 500,
  },
  {
    id: "poa",
    name: "Po’a",
    eyebrow: "La centena",
    description: "Elegí el rango de centena en el que caerá el resultado.",
    icon: "/assets/icons/game/poa.svg",
    art: "/assets/game-art/poa.webp",
    tone: "green",
    basePrice: 500,
  },
  {
    id: "pyae",
    name: "Pya’e",
    eyebrow: "Mayor o menor",
    description: "Anticipá si el número será menor o mayor que 500.",
    icon: "/assets/icons/game/pyae.svg",
    art: "/assets/game-art/pyae.webp",
    tone: "purple",
    basePrice: 1_000,
  },
  {
    id: "petei",
    name: "Peteĩ",
    eyebrow: "Última cifra",
    description: "Elegí la cifra final del resultado de tres dígitos.",
    icon: "/assets/icons/game/petei.svg",
    art: "/assets/game-art/one.webp",
    tone: "red",
    basePrice: 500,
  },
  {
    id: "mokoi",
    name: "Mokõi",
    eyebrow: "Últimas dos",
    description: "Elegí las dos cifras con las que terminará el resultado.",
    icon: "/assets/icons/game/mokoi.svg",
    art: "/assets/game-art/two.webp",
    tone: "blue",
    basePrice: 500,
  },
  {
    id: "mbohapy",
    name: "Mbohapy",
    eyebrow: "Número exacto",
    description: "Buscá la coincidencia exacta de las tres cifras.",
    icon: "/assets/icons/game/mbohapy.svg",
    art: "/assets/game-art/three.webp",
    tone: "orange",
    basePrice: 500,
  },
  {
    id: "poa5",
    name: "Po’a 5",
    eyebrow: "Cinco rodillos",
    description: "Elegí tres números distintos y encontralos en cinco resultados.",
    icon: "/assets/icons/game/poa5.svg",
    art: "/assets/game-art/prize.webp",
    tone: "red",
    basePrice: 1_000,
  },
  {
    id: "poa10",
    name: "Po’a 10",
    eyebrow: "Diez rodillos",
    description: "Tus tres elegidos se enfrentan a diez resultados independientes.",
    icon: "/assets/icons/game/poa10.svg",
    art: "/assets/game-art/mega.webp",
    tone: "blue",
    basePrice: 2_000,
  },
  {
    id: "racha5",
    name: "Racha 5",
    eyebrow: "Cinco paridades",
    description: "Elegí par o impar y buscá cuatro o cinco coincidencias.",
    icon: "/assets/icons/game/racha5.svg",
    art: "/assets/game-art/redoblona.webp",
    tone: "green",
    basePrice: 1_000,
  },
];

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
