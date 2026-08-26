import type { GamingCatalog, InstantGameDefinition } from "@/lib/gaming/types";
import { formatGs } from "@/lib/product/catalog";

import type { QuinieGameIconId } from "./game-icon-map";

export interface RulePayoutView {
  detail: string;
  headline: string;
  note: string;
  source: "backoffice" | "catalog-preview";
  sourceLabel: string;
}

export interface RuleGameCard {
  id: QuinieGameIconId;
  family: "instant" | "traditional";
  title: string;
  tagline: string;
  copy: string;
  instructions: readonly string[];
  winCondition: string;
  example: string;
  href: `/instantaneas/${string}` | `/quinielas/${string}`;
}

export interface EnabledRuleGameCard extends RuleGameCard {
  payout: RulePayoutView;
}

export const TRADITIONAL_RULES = [
  {
    id: "head",
    family: "traditional",
    title: "A la Cabeza",
    tagline: "3 cifras · primera posición",
    copy: "Elegí un número de 001 a 999 para uno de los sorteos habilitados.",
    instructions: [
      "Elegí el sorteo en el que querés participar.",
      "Ingresá un número de tres cifras, de 001 a 999, o usá la selección al azar.",
      "Elegí el importe disponible que querés jugar.",
      "Revisá número, sorteo e importe y confirmá antes del cierre.",
    ],
    winCondition: "Tu jugada apunta al primer resultado del sorteo elegido. El proveedor valida la coincidencia exacta al publicar el resultado.",
    example: "Jugás 497 en el Matutino. La selección ganadora debe coincidir exactamente con 497 en la primera posición.",
    href: "/quinielas/head",
  },
  {
    id: "prizes",
    family: "traditional",
    title: "A los Premios",
    tagline: "3 cifras · posición 2 a 14",
    copy: "Elegí un número de 001 a 999 y hasta qué posición querés que participe.",
    instructions: [
      "Ingresá un número de tres cifras, de 001 a 999.",
      "Indicá «hasta la posición» entre 2 y 14.",
      "Elegí el sorteo y el importe habilitado.",
      "Comprobá el límite de posición en el resumen y confirmá la jugada.",
    ],
    winCondition: "El proveedor evalúa tu número dentro del límite de posición elegido y aplica la regla oficial vigente del sorteo.",
    example: "Si ingresás 208 y elegís hasta la posición 5, el comprobante debe registrar 208 y el límite 5.",
    href: "/quinielas/prizes",
  },
  {
    id: "invert",
    family: "traditional",
    title: "Invertida",
    tagline: "3 cifras · posición 1 a 14",
    copy: "Ingresá tres cifras, elegí una posición y revisá su presentación separada por puntos.",
    instructions: [
      "Ingresá un número de tres cifras, de 001 a 999.",
      "Elegí una posición entre 1 y 14.",
      "Seleccioná el sorteo y el importe disponible.",
      "Verificá las tres cifras y la posición antes de confirmar.",
    ],
    winCondition: "La validación de Invertida la realiza el proveedor con la regla oficial y la posición seleccionada; la separación por puntos es solamente visual.",
    example: "Ingresás 208 y la pantalla muestra 2 · 0 · 8. Revisá que la posición y el premio informados sean los correctos antes de jugar.",
    href: "/quinielas/invert",
  },
  {
    id: "redoblona",
    family: "traditional",
    title: "Redoblona",
    tagline: "Cabeza de 3 cifras + redoblona de 2",
    copy: "Combiná un número de cabeza con una terminación y una posición para la redoblona.",
    instructions: [
      "Ingresá el número de cabeza de 001 a 999.",
      "Ingresá la redoblona de 00 a 99.",
      "Elegí para la redoblona una posición entre 2 y 14.",
      "Seleccioná sorteo e importe, revisá ambas cifras y confirmá.",
    ],
    winCondition: "El proveedor valida la combinación de la cabeza y la redoblona, junto con la posición seleccionada, según su regla oficial vigente.",
    example: "Cabeza 497 + redoblona 12 hasta la posición 5. El comprobante debe mostrar las dos selecciones y la posición 5.",
    href: "/quinielas/redoblona",
  },
] as const satisfies readonly RuleGameCard[];

export const INSTANT_RULES = [
  {
    id: "sapyaite",
    family: "instant",
    title: "Sapy’aite",
    tagline: "Par o impar · resultado inmediato",
    copy: "Elegí si el resultado de 001 a 999 será par o impar.",
    instructions: [
      "Elegí PAR o IMPAR.",
      "Seleccioná uno de los importes habilitados.",
      "Revisá tu elección y presioná Jugar.",
      "Esperá a que el rodillo termine: el resultado del proveedor es el válido.",
    ],
    winCondition: "Ganás si la paridad del resultado coincide con tu elección.",
    example: "Elegís PAR y sale 208: acertaste. Si sale 497, no acertaste.",
    href: "/instantaneas/sapyaite",
  },
  {
    id: "poa",
    family: "instant",
    title: "Po’a",
    tagline: "Una centena · resultado inmediato",
    copy: "Elegí el rango de cien números en el que pensás que caerá el resultado.",
    instructions: [
      "Elegí una centena, por ejemplo 200–299.",
      "Seleccioná un importe habilitado.",
      "Revisá la centena elegida y presioná Jugar.",
      "Esperá el resultado de tres cifras.",
    ],
    winCondition: "Ganás si el resultado está dentro de la centena seleccionada.",
    example: "Elegís 200–299 y sale 247: acertaste. Si sale 302, no acertaste.",
    href: "/instantaneas/poa",
  },
  {
    id: "pyae",
    family: "instant",
    title: "Pya’e",
    tagline: "Menor o mayor que 500",
    copy: "Elegí MENOR o MAYOR; el resultado 500 depende de la configuración vigente.",
    instructions: [
      "Elegí MENOR para 001–499 o MAYOR para 501–999.",
      "Seleccioná el importe que querés jugar.",
      "Revisá tu elección y presioná Jugar.",
      "Si sale 500, se aplica la política informada por el proveedor.",
    ],
    winCondition: "Ganás si el resultado cae en el lado de 500 que elegiste; el 500 se resuelve según la configuración publicada.",
    example: "Elegís MENOR y sale 208: acertaste. Si sale 731, no acertaste.",
    href: "/instantaneas/pyae",
  },
  {
    id: "petei",
    family: "instant",
    title: "Peteĩ",
    tagline: "Última cifra",
    copy: "Elegí una cifra de 0 a 9 para compararla con el final del resultado.",
    instructions: [
      "Elegí una cifra entre 0 y 9.",
      "Seleccioná un importe habilitado.",
      "Revisá tu cifra y presioná Jugar.",
      "Compará tu cifra con la última del resultado.",
    ],
    winCondition: "Ganás si la última cifra del resultado coincide con la que elegiste.",
    example: "Elegís 7 y sale 497: acertaste porque termina en 7.",
    href: "/instantaneas/petei",
  },
  {
    id: "mokoi",
    family: "instant",
    title: "Mokõi",
    tagline: "Últimas 2 cifras",
    copy: "Elegí un número de 00 a 99 para compararlo con la terminación del resultado.",
    instructions: [
      "Elegí dos cifras entre 00 y 99.",
      "Seleccioná un importe habilitado.",
      "Revisá la terminación y presioná Jugar.",
      "Comparala con las dos últimas cifras del resultado.",
    ],
    winCondition: "Ganás si las dos últimas cifras del resultado coinciden exactamente con tu elección.",
    example: "Elegís 97 y sale 497: acertaste porque el resultado termina en 97.",
    href: "/instantaneas/mokoi",
  },
  {
    id: "mbohapy",
    family: "instant",
    title: "Mbohapy",
    tagline: "3 cifras exactas",
    copy: "Elegí un número completo de 001 a 999.",
    instructions: [
      "Ingresá un número de tres cifras, de 001 a 999.",
      "Seleccioná un importe habilitado.",
      "Revisá el número completo y presioná Jugar.",
      "Comparalo con el resultado final.",
    ],
    winCondition: "Ganás si las tres cifras coinciden exactamente y en el mismo orden.",
    example: "Elegís 497 y sale 497: acertaste. Un resultado 947 no coincide.",
    href: "/instantaneas/mbohapy",
  },
  {
    id: "poa5",
    family: "instant",
    title: "Po’a 5",
    tagline: "3 números · 5 resultados",
    copy: "Elegí tres números distintos y buscalos entre cinco resultados.",
    instructions: [
      "Elegí tres números distintos de 001 a 999.",
      "Seleccioná un importe habilitado.",
      "Revisá las tres selecciones y presioná Jugar.",
      "Contá cuántos de tus números aparecen en los cinco resultados.",
    ],
    winCondition: "El premio depende de la cantidad de coincidencias exactas informada por el resultado.",
    example: "Elegís 012, 208 y 497. Si entre los cinco resultados aparecen 208 y 497, obtenés dos aciertos.",
    href: "/instantaneas/poa5",
  },
  {
    id: "poa10",
    family: "instant",
    title: "Po’a 10",
    tagline: "3 números · 10 resultados",
    copy: "Elegí tres números distintos y buscalos entre diez resultados.",
    instructions: [
      "Elegí tres números distintos de 001 a 999.",
      "Seleccioná un importe habilitado.",
      "Revisá las tres selecciones y presioná Jugar.",
      "Contá cuántos de tus números aparecen en los diez resultados.",
    ],
    winCondition: "El premio depende de la cantidad de coincidencias exactas informada por el resultado.",
    example: "Elegís 012, 208 y 497. Cada número que aparezca entre los diez resultados suma un acierto.",
    href: "/instantaneas/poa10",
  },
  {
    id: "racha5",
    family: "instant",
    title: "Racha 5",
    tagline: "Par o impar · 5 resultados",
    copy: "Elegí una paridad y sumá coincidencias en una serie de cinco resultados.",
    instructions: [
      "Elegí PAR o IMPAR para toda la serie.",
      "Seleccioná un importe habilitado.",
      "Revisá la paridad y presioná Jugar.",
      "Contá cuántos de los cinco resultados coinciden con tu elección.",
    ],
    winCondition: "La configuración actual premia cuatro o cinco coincidencias de paridad.",
    example: "Elegís PAR y cuatro de los cinco resultados son pares: obtenés cuatro aciertos.",
    href: "/instantaneas/racha5",
  },
] as const satisfies readonly RuleGameCard[];

export const ALL_GAME_RULES = [...TRADITIONAL_RULES, ...INSTANT_RULES] as const;

const TRADITIONAL_PAYOUT: RulePayoutView = {
  headline: "Premio según tabla oficial vigente",
  detail: "Varía según el importe, la modalidad y la posición. Revisá el valor que informe el proveedor antes de confirmar; luego queda registrado en Mis jugadas.",
  note: "No mostramos una cifra fija porque el catálogo actual todavía no publica la tabla de pagos de estas modalidades.",
  source: "backoffice",
  sourceLabel: "Tabla del proveedor",
};

function multiplierLabel(value: number) {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 2 }).format(value);
}

function instantPayoutView(
  game: InstantGameDefinition,
  amounts: readonly number[],
): RulePayoutView {
  const exampleAmount = amounts.length > 0 ? Math.min(...amounts) : null;
  const sharedNote = "Es la configuración de vista previa actual; el proveedor debe confirmar la tabla vigente antes de jugar.";

  if (game.payout.kind === "MULTIPLIER") {
    const multiplier = game.payout.winMultiplier;
    const detail = exampleAmount === null
      ? "El multiplicador se aplica al importe confirmado."
      : `Ejemplo con ${formatGs(exampleAmount)}: recibís ${formatGs(exampleAmount * multiplier)} en total y la ganancia neta es ${formatGs(exampleAmount * (multiplier - 1))}.`;

    return {
      headline: `Premio total actual: ${multiplierLabel(multiplier)}× el importe`,
      detail,
      note: sharedNote,
      source: "catalog-preview",
      sourceLabel: "Vista previa actual",
    };
  }

  const tiers = game.payout.tiers
    .map((tier) => `${tier.exactMatches} ${tier.exactMatches === 1 ? "acierto" : "aciertos"}: ${multiplierLabel(tier.multiplier)}×`)
    .join(" · ");
  const pending = game.payout.pendingFromMatches
    ? ` Desde ${game.payout.pendingFromMatches} aciertos, la liquidación queda pendiente de validación.`
    : "";

  return {
    headline: "Premio según cantidad de aciertos",
    detail: `${tiers}. El multiplicador se aplica al importe confirmado.${pending}`,
    note: sharedNote,
    source: "catalog-preview",
    sourceLabel: "Vista previa actual",
  };
}

export function selectEnabledGameRules(
  catalog: Pick<GamingCatalog, "amounts" | "traditional" | "instant">,
): {
  traditional: EnabledRuleGameCard[];
  instant: EnabledRuleGameCard[];
} {
  const enabledTraditionalIds = new Set(
    catalog.traditional.map((game) => game.id),
  );
  const instantById = new Map(catalog.instant.map((game) => [game.id, game]));

  return {
    traditional: TRADITIONAL_RULES
      .filter((rule) => enabledTraditionalIds.has(rule.id))
      .map((rule) => ({ ...rule, payout: TRADITIONAL_PAYOUT })),
    instant: INSTANT_RULES.flatMap((rule) => {
      const game = instantById.get(rule.id);
      return game
        ? [{ ...rule, payout: instantPayoutView(game, catalog.amounts) }]
        : [];
    }),
  };
}
