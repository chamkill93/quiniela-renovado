import type { GamingCatalog } from "@/lib/gaming/types";
import type { QuinieGameIconId } from "./game-icon-map";
import { MEGA_LOTO_URL, SAPYAITE_PATH } from "./product-links";

export interface RuleGameCard {
  id: QuinieGameIconId;
  family: "instant" | "traditional" | "external";
  title: string;
  copy: string;
  facts: readonly { label: string; value: string }[];
  instructions: readonly string[];
  conditions: readonly string[];
  example: string;
  href: `/instantaneas/${string}` | `/quinielas/${string}` | `https://${string}`;
}

export const TRADITIONAL_RULES = [
  {
    id: "head", family: "traditional", title: "A la Cabeza",
    copy: "Tu número debe coincidir exactamente con el primer resultado.",
    facts: [
      { label: "Número", value: "001 a 999" },
      { label: "Posición", value: "Solo la primera" },
    ],
    instructions: [
      "Elegí un número de tres cifras, entre 001 y 999. Conservá los ceros a la izquierda: el 7 se registra como 007.",
      "Seleccioná uno o varios sorteos abiertos y revisá la fecha y la hora de cada uno.",
      "Definí el importe por sorteo y comprobá el total de tu selección en el resumen.",
      "Confirmá antes del cierre y guardá el comprobante con el número y los sorteos elegidos.",
    ],
    conditions: [
      "La comparación se realiza únicamente con la primera posición del sorteo que confirmaste.",
      "Deben coincidir las tres cifras en el mismo orden. Acertar solo una cifra o la terminación no alcanza.",
      "El 000 no es una selección válida en esta modalidad.",
      "Si elegís varios sorteos, cada uno corresponde a una jugada independiente.",
    ],
    example: "Si elegís 007 y el primer resultado es 007, hay coincidencia. Un 070 en la primera posición, o un 007 que aparece únicamente en otra posición, no coincide con esta jugada.",
    href: "/quinielas/head",
  },
  {
    id: "prizes", family: "traditional", title: "A los Premios",
    copy: "Compará tu número dentro de las posiciones de la postura elegida.",
    facts: [
      { label: "Número", value: "001 a 999" },
      { label: "Postura", value: "De 2 a 14" },
    ],
    instructions: [
      "Ingresá un número de tres cifras, entre 001 y 999, respetando los ceros a la izquierda.",
      "Elegí una postura de 2 a 14. Indica hasta qué posición participa tu selección, dentro de las posiciones cubiertas por la jugada.",
      "Seleccioná uno o varios sorteos abiertos y definí el importe por sorteo.",
      "Revisá número, postura, sorteos y total. Confirmá antes del cierre y conservá el comprobante.",
    ],
    conditions: [
      "El resultado debe coincidir con las tres cifras de tu número y en el mismo orden.",
      "Solo se consideran el sorteo confirmado y las posiciones cubiertas por la postura elegida.",
      "Un resultado posterior a la posición elegida queda fuera, aunque el número coincida.",
      "El 000 no está admitido. Si participás en varios sorteos, cada jugada se evalúa por separado.",
    ],
    example: "Con el número 248 y postura 5, un 248 en la posición 4 está dentro del límite elegido. Si aparece únicamente en la posición 6, queda fuera de esa jugada.",
    href: "/quinielas/prizes",
  },
  {
    id: "invert", family: "traditional", title: "Invertida",
    copy: "Elegí tres cifras diferentes y participá con sus seis órdenes posibles.",
    facts: [
      { label: "Número", value: "001 a 999 · sin repetir" },
      { label: "Postura", value: "De 1 a 14" },
    ],
    instructions: [
      "Ingresá un número de tres cifras diferentes, entre 001 y 999. No se admiten cifras repetidas.",
      "Elegí una postura de 1 a 14 para indicar hasta qué posición participa la selección.",
      "Seleccioná uno o varios sorteos abiertos y definí el importe por sorteo.",
      "Revisá las tres cifras, la postura, los sorteos y el total. Confirmá antes del cierre y guardá el comprobante.",
    ],
    conditions: [
      "Las tres cifras deben ser diferentes entre sí y generan exactamente seis órdenes posibles.",
      "Los seis órdenes usan las mismas tres cifras, sin agregar, quitar ni repetir ninguna.",
      "Para coincidir, uno de esos órdenes debe aparecer dentro de las posiciones cubiertas por la postura del sorteo confirmado.",
      "Compartir solo una o dos cifras no es suficiente. Cualquier número con cifras repetidas, incluido el 000, queda fuera de esta modalidad.",
    ],
    example: "Con 123 se forman exactamente 123, 132, 213, 231, 312 y 321: un 213 dentro de la postura coincide, pero un 124 no.",
    href: "/quinielas/invert",
  },
  {
    id: "redoblona", family: "traditional", title: "Redoblona",
    copy: "Combiná dos números de dos cifras y elegí hasta dónde participa cada uno.",
    facts: [
      { label: "Selección", value: "2 cifras + 2 cifras" },
      { label: "Alcances", value: "Inicial 1–14 · Redoblona 7–14" },
    ],
    instructions: [
      "Ingresá dos números de 00 a 99; pueden ser iguales o diferentes.",
      "Definí el alcance inicial entre Cabeza y 14, y el alcance de Redoblona entre 7 y 14.",
      "El alcance de Redoblona debe ser igual o mayor al inicial. Elegí uno o varios sorteos y un único importe por sorteo.",
      "Revisá ambos números, sus alcances y el total. Confirmá antes del cierre y conservá el comprobante.",
    ],
    conditions: [
      "Las dos últimas cifras de los resultados se comparan con cada número elegido. Se necesitan dos aciertos en posiciones diferentes del mismo sorteo.",
      "Si la inicial es Cabeza, esa aparición se excluye: Redoblona hasta 7 busca el segundo acierto de la posición 2 a la 8.",
      "Con una inicial superior a Cabeza no se agrega otra posición; ambos aciertos se buscan dentro de los alcances contratados sin reutilizar una aparición.",
      "El orden y los ceros importan: 05 no es lo mismo que 50. Acertar solo uno de los números no completa la jugada.",
    ],
    example: "35 Cabeza + 72 hasta 7 gana si la posición 1 termina en 35 y otra posición entre la 2 y la 8 termina en 72.",
    href: "/quinielas/redoblona",
  },
] as const satisfies readonly RuleGameCard[];

export const INSTANT_RULES = [
  {
    id: "sapyaite", family: "instant", title: "Sapy’aite",
    copy: "Elegí tres cifras y comparalas con un resultado inmediato.",
    facts: [
      { label: "Número", value: "000 a 999" },
      { label: "Resultado", value: "Instantáneo" },
    ],
    instructions: [
      "Elegí un número de 000 a 999 y escribilo con tres cifras; por ejemplo, 042.",
      "Definí el importe y revisá que el número seleccionado sea el que querés confirmar.",
      "Tocá Jugar y esperá a que termine la presentación del resultado.",
      "Consultá el resultado y el estado de la jugada. Conservá su comprobante para revisarla después.",
    ],
    conditions: [
      "Cada jugada se compara con un único resultado de tres cifras, sin esperar un sorteo programado ni elegir una postura.",
      "Para acertar, las tres cifras deben coincidir exactamente y en el mismo orden.",
      "El 000 y los números con cifras repetidas están permitidos.",
      "Una coincidencia parcial o las mismas cifras en otro orden no cuentan como acierto.",
    ],
    example: "Si elegís 042, únicamente el resultado 042 coincide. Los resultados 024, 420 o 142 no coinciden con esa selección.",
    href: SAPYAITE_PATH,
  },
] as const satisfies readonly RuleGameCard[];

// Selection and options checked against the linked official portal.
// Do not reuse the retired local 1–45 game contract for this external product.
export const MEGA_LOTO_RULE = {
  id: "megaloto", family: "external", title: "Mega Loto",
  copy: "Armá una combinación de seis números para el sorteo.",
  facts: [
    { label: "Selección", value: "6 números distintos" },
    { label: "Rango", value: "Del 1 al 40" },
  ],
  instructions: [
    "Abrí el sitio oficial desde esta tarjeta.",
    "Marcá seis números distintos del 1 al 40 o usá la opción Al azar.",
    "Elegí Mega Pozo, o la opción que también incluye Mega Revancha y Mega Chance.",
    "Revisá el sorteo, la modalidad, los seis números y el importe antes de confirmar. Guardá el comprobante emitido allí.",
  ],
  conditions: [
    "La selección debe contener seis valores diferentes, todos dentro del rango del 1 al 40.",
    "La participación corresponde únicamente a las modalidades que figuran en tu comprobante.",
    "Consultá los resultados y las condiciones de acierto en el sitio oficial para el sorteo y la modalidad que elegiste.",
  ],
  example: "03, 08, 14, 22, 31 y 40 es una selección válida. Un número repetido, el 00 o el 41 no cumplen esta selección.",
  href: MEGA_LOTO_URL,
} as const satisfies RuleGameCard;

export const ALL_GAME_RULES = [
  ...TRADITIONAL_RULES,
  ...INSTANT_RULES,
  MEGA_LOTO_RULE,
] as const;

export function selectEnabledGameRules(
  catalog: Pick<GamingCatalog, "traditional" | "instant">,
): { traditional: RuleGameCard[]; instant: RuleGameCard[]; external: RuleGameCard[] } {
  const enabledTraditionalIds = new Set(catalog.traditional.map((game) => game.id));
  const enabledInstantIds = new Set(catalog.instant.map((game) => game.id));

  return {
    traditional: TRADITIONAL_RULES.filter((rule) => enabledTraditionalIds.has(rule.id)),
    instant: INSTANT_RULES.filter((rule) => enabledInstantIds.has(rule.id)),
    external: [MEGA_LOTO_RULE],
  };
}
