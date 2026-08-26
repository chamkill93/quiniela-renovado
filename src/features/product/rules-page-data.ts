import type { QuinieGameIconId } from "./game-icon-map";

export interface RuleGameCard {
  id: QuinieGameIconId;
  family: "instant" | "traditional";
  title: string;
  copy: string;
  href: `/instantaneas/${string}` | `/quinielas/${string}`;
}

export const TRADITIONAL_RULES = [
  {
    id: "head",
    family: "traditional",
    title: "A la Cabeza",
    copy: "Elegí 3 cifras para el primer premio.",
    href: "/quinielas/head",
  },
  {
    id: "prizes",
    family: "traditional",
    title: "A los Premios",
    copy: "Elegí 3 cifras y hasta qué posición participa.",
    href: "/quinielas/prizes",
  },
  {
    id: "invert",
    family: "traditional",
    title: "Invertida",
    copy: "Jugá 3 cifras en distintas posiciones.",
    href: "/quinielas/invert",
  },
  {
    id: "redoblona",
    family: "traditional",
    title: "Redoblona",
    copy: "Combiná un número y una terminación.",
    href: "/quinielas/redoblona",
  },
] as const satisfies readonly RuleGameCard[];

export const INSTANT_RULES = [
  {
    id: "sapyaite",
    family: "instant",
    title: "Sapy’aite",
    copy: "Elegí par o impar.",
    href: "/instantaneas/sapyaite",
  },
  {
    id: "poa",
    family: "instant",
    title: "Po’a",
    copy: "Elegí en qué centena cae.",
    href: "/instantaneas/poa",
  },
  {
    id: "pyae",
    family: "instant",
    title: "Pya’e",
    copy: "Elegí menor o mayor; el 500 depende de configuración.",
    href: "/instantaneas/pyae",
  },
  {
    id: "petei",
    family: "instant",
    title: "Peteĩ",
    copy: "Elegí la última cifra.",
    href: "/instantaneas/petei",
  },
  {
    id: "mokoi",
    family: "instant",
    title: "Mokõi",
    copy: "Elegí las últimas 2 cifras.",
    href: "/instantaneas/mokoi",
  },
  {
    id: "mbohapy",
    family: "instant",
    title: "Mbohapy",
    copy: "Elegí el número exacto.",
    href: "/instantaneas/mbohapy",
  },
  {
    id: "poa5",
    family: "instant",
    title: "Po’a 5",
    copy: "Buscá tus números en 5 resultados.",
    href: "/instantaneas/poa5",
  },
  {
    id: "poa10",
    family: "instant",
    title: "Po’a 10",
    copy: "Buscá tus números en 10 resultados.",
    href: "/instantaneas/poa10",
  },
  {
    id: "racha5",
    family: "instant",
    title: "Racha 5",
    copy: "Elegí par o impar para 5 resultados.",
    href: "/instantaneas/racha5",
  },
] as const satisfies readonly RuleGameCard[];

export const ALL_GAME_RULES = [...TRADITIONAL_RULES, ...INSTANT_RULES] as const;
