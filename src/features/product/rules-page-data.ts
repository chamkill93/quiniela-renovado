import type { GamingCatalog, InstantGameDefinition } from "@/lib/gaming/types";
import { formatGs } from "@/lib/product/catalog";
import type { QuinieGameIconId } from "./game-icon-map";
import { formatMultiplier, type PrizeCalculation } from "./prize-estimate";

export interface RulePayoutView {
  headline: string;
  detail: string;
  available: boolean;
  reference: boolean;
  calculation: PrizeCalculation;
  rows?: readonly { label: string; value: string }[];
}

export interface RuleGameCard {
  id: QuinieGameIconId;
  family: "instant" | "traditional";
  title: string;
  copy: string;
  instructions: readonly string[];
  href: `/instantaneas/${string}` | `/quinielas/${string}`;
}

export interface EnabledRuleGameCard extends RuleGameCard {
  payout: RulePayoutView;
}

export const TRADITIONAL_RULES = [
  {
    id: "head", family: "traditional", title: "A la Cabeza",
    copy: "Acertá las tres cifras del primer resultado del sorteo.",
    instructions: [
      "Elegí tu número de tres cifras, el sorteo y el importe.",
      "Ganás si coincide exactamente con el primer resultado.",
    ],
    href: "/quinielas/head",
  },
  {
    id: "prizes", family: "traditional", title: "A los Premios",
    copy: "Elegí tres cifras y hasta qué posición querés jugar.",
    instructions: [
      "Ingresá tu número y elegí una posición de 2 a 14.",
      "Seleccioná el sorteo y el importe; revisá la jugada antes de confirmar.",
    ],
    href: "/quinielas/prizes",
  },
  {
    id: "invert", family: "traditional", title: "Invertida",
    copy: "Jugá tus tres cifras en distinto orden.",
    instructions: [
      "Elegí tres cifras y una posición de 1 a 14.",
      "Seleccioná el sorteo y el importe; revisá tu selección antes de confirmar.",
    ],
    href: "/quinielas/invert",
  },
  {
    id: "redoblona", family: "traditional", title: "Redoblona",
    copy: "Combiná una cabeza de tres cifras con una terminación de dos.",
    instructions: [
      "Elegí el número de cabeza y la terminación de dos cifras.",
      "Elegí una posición de 2 a 14, el sorteo y el importe.",
    ],
    href: "/quinielas/redoblona",
  },
] as const satisfies readonly RuleGameCard[];

export const INSTANT_RULES = [
  {
    id: "sapyaite", family: "instant", title: "Sapy’aite",
    copy: "Como A la Cabeza, pero instantáneo: acertá las tres cifras exactas.",
    instructions: [
      "Elegí un número de 000 a 999, el importe y tocá Jugar.",
      "Ganás si las tres cifras coinciden en el mismo orden. No tenés que esperar un sorteo.",
    ],
    href: "/quinielas/sapyaite",
  },
  {
    id: "poa", family: "instant", title: "Po’a",
    copy: "Acertá la centena en la que cae el resultado.",
    instructions: ["Elegí una centena y el importe.", "Ganás si el resultado está dentro del rango elegido."],
    href: "/instantaneas/poa",
  },
  {
    id: "pyae", family: "instant", title: "Pya’e",
    copy: "Elegí menor o mayor que 500.",
    instructions: ["MENOR cubre 001–499 y MAYOR cubre 501–999.", "El 500 se resuelve con la configuración vigente del juego."],
    href: "/instantaneas/pyae",
  },
  {
    id: "petei", family: "instant", title: "Peteĩ",
    copy: "Acertá la última cifra del resultado.",
    instructions: ["Elegí una cifra de 0 a 9 y el importe.", "Si coincide con la última cifra, ganás."],
    href: "/instantaneas/petei",
  },
  {
    id: "mokoi", family: "instant", title: "Mokõi",
    copy: "Acertá las dos últimas cifras.",
    instructions: ["Elegí un número de 00 a 99 y el importe.", "Si coincide con las dos últimas cifras, ganás."],
    href: "/instantaneas/mokoi",
  },
  {
    id: "mbohapy", family: "instant", title: "Mbohapy",
    copy: "Acertá el número completo de tres cifras.",
    instructions: ["Elegí un número de 001 a 999 y el importe.", "Las tres cifras deben coincidir en el mismo orden."],
    href: "/instantaneas/mbohapy",
  },
  {
    id: "poa5", family: "instant", title: "Po’a 5",
    copy: "Buscá tus tres números entre cinco resultados.",
    instructions: ["Elegí tres números distintos y el importe.", "El premio depende de cuántos coincidan."],
    href: "/instantaneas/poa5",
  },
  {
    id: "poa10", family: "instant", title: "Po’a 10",
    copy: "Buscá tus tres números entre diez resultados.",
    instructions: ["Elegí tres números distintos y el importe.", "El premio depende de cuántos coincidan."],
    href: "/instantaneas/poa10",
  },
  {
    id: "racha5", family: "instant", title: "Racha 5",
    copy: "Elegí par o impar para cinco resultados.",
    instructions: ["Elegí una paridad y el importe.", "El premio depende de cuántos resultados coincidan con tu elección."],
    href: "/instantaneas/racha5",
  },
] as const satisfies readonly RuleGameCard[];

export const ALL_GAME_RULES = [...TRADITIONAL_RULES, ...INSTANT_RULES] as const;

function traditionalReferencePayout(
  id: typeof TRADITIONAL_RULES[number]["id"],
  threeDigitMultiplier: number,
  twoDigitMultiplier: number,
): RulePayoutView {
  const base = formatMultiplier(threeDigitMultiplier);
  const common = { available: true, reference: true };
  switch (id) {
    case "head":
      return {
        ...common, headline: `${base}× el importe`,
        detail: "Referencia para un acierto exacto de tres cifras, como Sapy’aite.",
        calculation: { kind: "FIXED", multiplier: threeDigitMultiplier },
      };
    case "prizes":
      return {
        ...common, headline: `${base}× ÷ postura`,
        detail: "Para un acierto: importe × multiplicador base ÷ postura elegida.",
        calculation: { kind: "POSITION", multiplier: threeDigitMultiplier, minPosition: 2, maxPosition: 14 },
      };
    case "invert":
      return {
        ...common, headline: `${base}× ÷ combinaciones ÷ postura`,
        detail: "El importe se reparte entre los órdenes distintos de tus cifras y la postura. Se estima un acierto.",
        calculation: { kind: "PERMUTATIONS", multiplier: threeDigitMultiplier, minPosition: 1, maxPosition: 14 },
      };
    case "redoblona":
      return {
        ...common, headline: `${base}× · ${formatMultiplier(twoDigitMultiplier)}× ÷ postura`,
        detail: "Si acertás ambas etapas: importe × base de tres cifras × base de dos cifras ÷ postura.",
        calculation: { kind: "REDOBLONA", multiplier: threeDigitMultiplier, secondMultiplier: twoDigitMultiplier, minPosition: 2, maxPosition: 14 },
      };
  }
}

function referenceBase(catalog: Pick<GamingCatalog, "instant">, id: "sapyaite" | "mokoi", fallback: number) {
  const payout = catalog.instant.find((game) => game.id === id)?.payout;
  return payout?.kind === "MULTIPLIER" && Number.isFinite(payout.winMultiplier) && payout.winMultiplier > 0
    ? payout.winMultiplier : fallback;
}

function instantPayoutView(game: InstantGameDefinition, amounts: readonly number[]): RulePayoutView {
  const validAmounts = amounts.filter((value) => Number.isFinite(value) && value > 0);
  const exampleAmount = validAmounts.length ? Math.min(...validAmounts) : null;
  if (game.payout.kind === "MULTIPLIER") {
    const multiplier = game.payout.winMultiplier;
    return {
      headline: `${formatMultiplier(multiplier)}× el importe`,
      detail: exampleAmount === null
        ? `Si acertás, el premio total es tu importe × ${formatMultiplier(multiplier)}.`
        : `Si acertás con ${formatGs(exampleAmount)}, el premio total es ${formatGs(exampleAmount * multiplier)}.`,
      available: true,
      reference: false,
      calculation: { kind: "FIXED", multiplier },
    };
  }

  const pending = game.payout.pendingFromMatches
    ? ` Desde ${game.payout.pendingFromMatches} aciertos, el premio queda pendiente de validación.`
    : "";
  return {
    headline: "Multiplicador según aciertos",
    detail: `Cada multiplicador se aplica al importe jugado.${pending}`,
    available: true,
    reference: false,
    calculation: { kind: "TIERS", tiers: game.payout.tiers },
    rows: game.payout.tiers.map((tier) => ({
      label: `${tier.exactMatches} ${tier.exactMatches === 1 ? "acierto" : "aciertos"}`,
      value: `${formatMultiplier(tier.multiplier)}×`,
    })),
  };
}

export function selectEnabledGameRules(
  catalog: Pick<GamingCatalog, "amounts" | "traditional" | "instant">,
): { traditional: EnabledRuleGameCard[]; instant: EnabledRuleGameCard[] } {
  const enabledTraditionalIds = new Set(catalog.traditional.map((game) => game.id));
  const instantById = new Map(catalog.instant.map((game) => [game.id, game]));
  // User-approved estimates based on the platform's three-/two-digit rates.
  // These do not add payout configuration to the traditional gaming contract.
  const threeDigitMultiplier = referenceBase(catalog, "sapyaite", 700);
  const twoDigitMultiplier = referenceBase(catalog, "mokoi", 80);
  return {
    traditional: TRADITIONAL_RULES
      .filter((rule) => enabledTraditionalIds.has(rule.id))
      .map((rule) => ({ ...rule, payout: traditionalReferencePayout(rule.id, threeDigitMultiplier, twoDigitMultiplier) })),
    instant: INSTANT_RULES.flatMap((rule) => {
      const game = instantById.get(rule.id);
      return game ? [{ ...rule, payout: instantPayoutView(game, catalog.amounts) }] : [];
    }),
  };
}
