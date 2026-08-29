import { DRAW_POSTURE_COUNT, type PositionedDrawNumber } from "./types";

export const REDOBLONA_ENDING_DIGITS = 2;
export const REDOBLONA_INITIAL_POSTURE_RANGE = Object.freeze({ min: 1, max: DRAW_POSTURE_COUNT });
export const REDOBLONA_SECOND_POSTURE_RANGE = Object.freeze({ min: 7, max: DRAW_POSTURE_COUNT });

export interface RedoblonaSelection {
  initialNumber: string;
  initialUntil: number;
  redoblonaNumber: string;
  redoblonaUntil: number;
}

export type RedoblonaValidationErrors = Partial<
  Record<keyof RedoblonaSelection, string>
>;

export interface RedoblonaPositionRange {
  min: number;
  max: number;
}

export interface RedoblonaEvaluationRanges {
  initial: RedoblonaPositionRange;
  redoblona: RedoblonaPositionRange;
}

export interface RedoblonaHit {
  position: number;
  value: string;
  ending: string;
}

export interface RedoblonaEvaluation {
  won: boolean;
  hits: {
    initial: RedoblonaHit | null;
    redoblona: RedoblonaHit | null;
  };
  ranges: RedoblonaEvaluationRanges;
  summary: string;
}

/**
 * Formats the last two numeric characters for display/input use.
 * Validation deliberately remains separate: a raw canonical selection must
 * already contain exactly two digits.
 */
export function normalizeRedoblonaEnding(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits ? digits.slice(-REDOBLONA_ENDING_DIGITS).padStart(REDOBLONA_ENDING_DIGITS, "0") : "";
}

function isCanonicalEnding(value: string): boolean {
  return /^\d{2}$/.test(value);
}

function isIntegerInRange(value: number, range: RedoblonaPositionRange): boolean {
  return Number.isSafeInteger(value) && value >= range.min && value <= range.max;
}

export function validateRedoblonaSelection(
  selection: RedoblonaSelection,
): RedoblonaValidationErrors {
  const errors: RedoblonaValidationErrors = {};

  if (!isCanonicalEnding(selection.initialNumber)) {
    errors.initialNumber = "El número inicial debe tener exactamente dos cifras (00 a 99).";
  }
  if (!isCanonicalEnding(selection.redoblonaNumber)) {
    errors.redoblonaNumber = "El segundo número debe tener exactamente dos cifras (00 a 99).";
  }
  if (!isIntegerInRange(selection.initialUntil, REDOBLONA_INITIAL_POSTURE_RANGE)) {
    errors.initialUntil = "La postura inicial debe estar entre 1 y 14.";
  }
  if (!isIntegerInRange(selection.redoblonaUntil, REDOBLONA_SECOND_POSTURE_RANGE)) {
    errors.redoblonaUntil = "La postura final debe estar entre 7 y 14.";
  } else if (
    isIntegerInRange(selection.initialUntil, REDOBLONA_INITIAL_POSTURE_RANGE)
    && selection.redoblonaUntil < selection.initialUntil
  ) {
    errors.redoblonaUntil = "La postura final debe ser igual o mayor que la inicial.";
  }

  return errors;
}

function assertValidSelection(selection: RedoblonaSelection): void {
  const errors = Object.values(validateRedoblonaSelection(selection));
  if (errors.length > 0) {
    throw new RangeError(`Selección de Redoblona inválida: ${errors.join(" ")}`);
  }
}

/**
 * Cabeza en postura 1 reserves the first result for the initial hit, so a
 * second posture of 7 covers the following seven results: positions 2 to 8.
 * For any wider initial posture, both searches start at position 1 and the
 * evaluator prevents the same occurrence from satisfying both conditions.
 */
export function getRedoblonaEvaluationRanges(
  selection: Pick<RedoblonaSelection, "initialUntil" | "redoblonaUntil">,
): RedoblonaEvaluationRanges {
  const positionSelection: RedoblonaSelection = {
    initialNumber: "00",
    redoblonaNumber: "00",
    ...selection,
  };
  assertValidSelection(positionSelection);

  return {
    initial: { min: 1, max: selection.initialUntil },
    redoblona: selection.initialUntil === 1
      ? { min: 2, max: selection.redoblonaUntil + 1 }
      : { min: 1, max: selection.redoblonaUntil },
  };
}

function normalizeDrawValue(value: string): { value: string; ending: string } | null {
  const trimmed = value.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;

  const numericValue = Number(trimmed);
  if (numericValue < 0 || numericValue > 999) return null;

  const normalizedValue = String(numericValue).padStart(3, "0");
  return {
    value: normalizedValue,
    ending: normalizedValue.slice(-REDOBLONA_ENDING_DIGITS),
  };
}

function hitsFor(
  ending: string,
  range: RedoblonaPositionRange,
  drawNumbers: readonly PositionedDrawNumber[],
): RedoblonaHit[] {
  return drawNumbers
    .map((drawNumber, sourceIndex) => ({ drawNumber, sourceIndex }))
    .filter(({ drawNumber }) =>
      Number.isSafeInteger(drawNumber.position)
      && drawNumber.position >= range.min
      && drawNumber.position <= range.max,
    )
    .sort((left, right) =>
      left.drawNumber.position - right.drawNumber.position
      || left.sourceIndex - right.sourceIndex,
    )
    .flatMap(({ drawNumber }) => {
      const normalized = normalizeDrawValue(drawNumber.value);
      if (!normalized || normalized.ending !== ending) return [];
      return [{ position: drawNumber.position, ...normalized }];
    });
}

function firstDistinctPair(
  initialHits: readonly RedoblonaHit[],
  secondHits: readonly RedoblonaHit[],
): readonly [RedoblonaHit, RedoblonaHit] | null {
  for (const initialHit of initialHits) {
    const secondHit = secondHits.find((candidate) => candidate.position !== initialHit.position);
    if (secondHit) return [initialHit, secondHit];
  }
  return null;
}

function positionLabel(position: number): string {
  return `${position}.ª posición`;
}

export function summarizeRedoblonaSelection(selection: RedoblonaSelection): string {
  assertValidSelection(selection);
  if (selection.initialUntil === 1) {
    return `${selection.initialNumber} Cabeza + ${selection.redoblonaNumber} hasta ${selection.redoblonaUntil}`;
  }
  return `${selection.initialNumber} hasta ${selection.initialUntil} + ${selection.redoblonaNumber} hasta ${selection.redoblonaUntil}`;
}

function evaluationSummary(
  selection: RedoblonaSelection,
  initialHit: RedoblonaHit | null,
  redoblonaHit: RedoblonaHit | null,
  won: boolean,
): string {
  if (won && initialHit && redoblonaHit) {
    return `Acertó ${selection.initialNumber} en la ${positionLabel(initialHit.position)} y ${selection.redoblonaNumber} en la ${positionLabel(redoblonaHit.position)}.`;
  }
  if (!initialHit) {
    return `${selection.initialNumber} no apareció dentro de la postura inicial.`;
  }
  return `${selection.redoblonaNumber} no apareció en otra posición dentro de la postura final.`;
}

export function evaluateRedoblona(
  selection: RedoblonaSelection,
  drawNumbers: readonly PositionedDrawNumber[],
): RedoblonaEvaluation {
  assertValidSelection(selection);
  const ranges = getRedoblonaEvaluationRanges(selection);
  const initialCandidates = hitsFor(selection.initialNumber, ranges.initial, drawNumbers);
  const redoblonaCandidates = hitsFor(selection.redoblonaNumber, ranges.redoblona, drawNumbers);
  const pair = firstDistinctPair(initialCandidates, redoblonaCandidates);

  const initialHit = pair?.[0] ?? initialCandidates[0] ?? null;
  const redoblonaHit = pair?.[1]
    ?? redoblonaCandidates.find((candidate) => candidate.position !== initialHit?.position)
    ?? (initialHit ? null : redoblonaCandidates[0] ?? null);
  const won = pair !== null;

  return {
    won,
    hits: { initial: initialHit, redoblona: redoblonaHit },
    ranges,
    summary: evaluationSummary(selection, initialHit, redoblonaHit, won),
  };
}
