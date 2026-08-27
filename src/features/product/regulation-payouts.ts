import type { TraditionalGameId } from "@/lib/product/catalog";

export interface RulePayoutView {
  headline: string;
  detail: string;
  note: string;
  source: "official" | "catalog-preview";
  sourceLabel: string;
  rows?: readonly { label: string; value: string }[];
  conditions?: readonly string[];
}

/**
 * Presentation only. Source: REGLAMENTO DE JUEGO QUINIELA (1).pdf,
 * supplied by the project owner; printed pages 4–7, articles 3.1–3.5.
 * Minimums and repetition caps are not interchangeable with fixed payouts.
 * These values do not configure or settle games.
 */
export const REGULATION_PAYOUTS = {
  head: {
    headline: "Mínimo 400× · 3 cifras",
    detail: "Para tres cifras a la cabeza: importe apostado × 400 como mínimo.",
    note: "El art. 3.1.1 dice «al menos» y contempla lo dispuesto por el concesionario. No es una promesa de pago fijo para todas las modalidades.",
    source: "official",
    sourceLabel: "Art. 3.1.1 · pág. 4",
    rows: [
      { label: "3 últimas cifras", value: "Mínimo 400×" },
      { label: "2 últimas cifras", value: "Mínimo 60×" },
      { label: "Última cifra", value: "Mínimo 6×" },
    ],
    conditions: [
      "Esta pantalla ofrece la selección de tres cifras. La tabla también documenta los pagos de una y dos cifras del reglamento; no habilita esas opciones en el formulario.",
    ],
  },
  prizes: {
    headline: "Base 400× ÷ postura · 3 cifras",
    detail: "Premio por acierto = (importe apostado ÷ postura elegida) × multiplicador de la cantidad de cifras.",
    note: "Se usa la base mínima del art. 3.1.1. Los límites y repeticiones se tratan por separado: no garantizan 600× en cada jugada.",
    source: "official",
    sourceLabel: "Arts. 3.2.1–3.2.4 · pág. 4",
    rows: [
      { label: "3 cifras · base mínima", value: "400× ÷ postura" },
      { label: "2 cifras · base mínima", value: "60× ÷ postura" },
      { label: "1 cifra · base mínima", value: "6× ÷ postura" },
    ],
    conditions: [
      "Sin repetición, la suma de premios se limita a la premiación correspondiente a la cabeza (art. 3.2.3).",
      "Con repeticiones, el art. 3.2.4 establece un tope de 600 veces sobre la base importe ÷ postura, liquidado una sola vez. Se aplica la cantidad de repeticiones sin superar ese tope.",
    ],
  },
  invert: {
    headline: "450× por combinación · a la cabeza",
    detail: "El multiplicador se aplica al importe de la combinación ganadora, no automáticamente al total de las seis combinaciones.",
    note: "Tres cifras distintas generan seis combinaciones con igual importe y postura. Si el total se reparte entre las seis, la base de cada combinación es total ÷ 6.",
    source: "official",
    sourceLabel: "Arts. 3.3.1–3.3.9 · págs. 4–5",
    rows: [
      { label: "Combinación ganadora · cabeza", value: "450×" },
      { label: "Combinación ganadora · premios", value: "450× ÷ postura" },
    ],
    conditions: [
      "Las seis combinaciones se juegan por el mismo importe y a la misma postura (art. 3.3.4).",
      "Con repeticiones, el art. 3.3.8 indica un máximo de 800 veces el monto apostado en las posturas seleccionadas. Es un tope acumulado, no el multiplicador normal.",
      "Si la apuesta no cumple las condiciones de invertida, se considera directa de tres cifras según el art. 3.3.9.",
    ],
  },
  redoblona: {
    headline: "Doble acierto · sin multiplicador fijo",
    detail: "Se calcula primero el premio de la apuesta inicial. Ese premio se distribuye a la postura de la redoblona para calcular el segundo acierto.",
    note: "El reglamento no da un multiplicador único para toda la redoblona. El límite de 900× corresponde solo al supuesto de repeticiones del art. 3.4.11.",
    source: "official",
    sourceLabel: "Arts. 3.4.1–3.4.11 · págs. 5–7",
    rows: [
      { label: "Apuesta inicial", value: "Pago de la directa según cifras y postura" },
      { label: "Segunda apuesta", value: "Se calcula sobre el premio inicial" },
      { label: "Repeticiones · al menos 3 aciertos", value: "Tope 900× del importe inicial, una sola vez" },
    ],
    conditions: [
      "La modalidad base combina dos números de dos cifras; el reglamento permite que el concesionario determine otras variantes.",
      "La postura inicial puede ser de 1 a 14. La segunda debe abarcar al menos 7 posturas y ser igual o mayor a la inicial, dentro del rango 7 a 14, salvo modificación autorizada.",
      "Si la inicial es a la cabeza, se excluye de la redoblona: para abarcar siete posturas se consideran de la 2 a la 8 (art. 3.4.5).",
      "Si la inicial es posterior a la cabeza, se incluye en el rango y no se añade una postura adicional (art. 3.4.8).",
      "El tope por repeticiones exige al menos tres aciertos. Incluye apostar al mismo número en ambas etapas cuando sale premiado tres o más veces dentro del rango.",
    ],
  },
} as const satisfies Record<TraditionalGameId, RulePayoutView>;
