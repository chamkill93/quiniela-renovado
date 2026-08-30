import type { TraditionalPlayRequest } from "@/lib/gaming/schemas";
import type { TraditionalGameDefinition } from "@/lib/gaming/types";
import type { TraditionalGameId } from "@/lib/product/catalog";

export type TraditionalDraft = {
  number: string;
  position: number;
  initialNumber: string;
  initialUntil: number;
  redoblonaNumber: string;
  redoblonaUntil: number;
};

export function createTraditionalDraft(gameId: TraditionalGameId): TraditionalDraft {
  return {
    number: "",
    position: gameId === "invert" ? 1 : 2,
    initialNumber: "",
    initialUntil: 1,
    redoblonaNumber: "",
    redoblonaUntil: 7,
  };
}

export function normalizeTraditionalNumber(value: string, digits: number): string {
  const number = value.replace(/\D/g, "").slice(0, digits);
  return number ? number.padStart(digits, "0") : "";
}

export function isValidInvertNumber(value: string): boolean {
  return /^(?!000)\d{3}$/.test(value) && new Set(value).size === 3;
}

export function getTraditionalPositionRange(
  definition: TraditionalGameDefinition,
): { min: number; max: number } | null {
  const selection = definition.selection;
  if (selection.kind !== "THREE_DIGIT" || !selection.position) return null;
  return { min: selection.position.min, max: selection.position.max };
}

export function getRedoblonaRanges(definition: TraditionalGameDefinition) {
  const selection = definition.selection;
  if (selection.kind !== "REDOBLONA") return null;
  return {
    initialUntil: { ...selection.initialUntil },
    redoblonaUntil: { ...selection.redoblonaUntil },
  };
}

function isNumberInRange(value: string, digits: number, min: number, max: number) {
  return /^\d+$/.test(value)
    && value.length <= digits
    && Number(value) >= min
    && Number(value) <= max;
}

export function validateTraditionalDraft(
  gameId: TraditionalGameId,
  draft: TraditionalDraft,
  definition: TraditionalGameDefinition,
): Partial<Record<keyof TraditionalDraft, string>> {
  const errors: Partial<Record<keyof TraditionalDraft, string>> = {};

  if (gameId === "redoblona") {
    if (!/^\d{2}$/.test(draft.initialNumber)) {
      errors.initialNumber = "Ingresá un número de 2 cifras.";
    }
    if (!/^\d{2}$/.test(draft.redoblonaNumber)) {
      errors.redoblonaNumber = "Ingresá un número de 2 cifras.";
    }
    const ranges = getRedoblonaRanges(definition);
    if (!ranges) {
      errors.initialUntil = "Los alcances de Redoblona no están disponibles.";
      errors.redoblonaUntil = "Los alcances de Redoblona no están disponibles.";
    } else {
      if (!Number.isInteger(draft.initialUntil)
        || draft.initialUntil < ranges.initialUntil.min
        || draft.initialUntil > ranges.initialUntil.max) {
        errors.initialUntil = `Elegí un alcance inicial entre ${ranges.initialUntil.min} y ${ranges.initialUntil.max}.`;
      }
      if (!Number.isInteger(draft.redoblonaUntil)
        || draft.redoblonaUntil < ranges.redoblonaUntil.min
        || draft.redoblonaUntil > ranges.redoblonaUntil.max) {
        errors.redoblonaUntil = `La Redoblona comienza desde la postura ${ranges.redoblonaUntil.min}.`;
      } else if (draft.redoblonaUntil < draft.initialUntil) {
        errors.redoblonaUntil = "El alcance de Redoblona debe ser igual o mayor al alcance inicial.";
      }
    }
  } else if (!isNumberInRange(draft.number, 3, 1, 999)) {
    errors.number = "Ingresá un número entre 001 y 999.";
  } else if (
    gameId === "invert"
    && !isValidInvertNumber(normalizeTraditionalNumber(draft.number, 3))
  ) {
    errors.number = "Elegí un número del 001 al 999 con tres cifras distintas.";
  }

  // A la Cabeza has a fixed server-side position, absent from its request.
  if (gameId !== "head" && gameId !== "redoblona") {
    const range = getTraditionalPositionRange(definition);
    if (!range) {
      errors.position = "Las posiciones no están disponibles.";
    } else if (
      !Number.isInteger(draft.position)
      || draft.position < range.min
      || draft.position > range.max
    ) {
      errors.position = `Elegí una posición entre ${range.min} y ${range.max}.`;
    }
  }

  return errors;
}

export function buildTraditionalPlayInput(
  gameId: TraditionalGameId,
  amount: number,
  drawId: string,
  draft: TraditionalDraft,
): TraditionalPlayRequest {
  if (gameId === "redoblona") {
    return {
      gameId,
      amount,
      drawId,
      selection: {
        initialNumber: normalizeTraditionalNumber(draft.initialNumber, 2),
        initialUntil: draft.initialUntil,
        redoblonaNumber: normalizeTraditionalNumber(draft.redoblonaNumber, 2),
        redoblonaUntil: draft.redoblonaUntil,
      },
    };
  }

  if (gameId === "prizes" || gameId === "invert") {
    return {
      gameId,
      amount,
      drawId,
      selection: {
        number: normalizeTraditionalNumber(draft.number, 3),
        position: draft.position,
      },
    };
  }

  return {
    gameId,
    amount,
    drawId,
    selection: { number: normalizeTraditionalNumber(draft.number, 3) },
  };
}

function randomIndex(count: number) {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RangeError("Random option count must be positive.");
  }
  const sourceSize = 2 ** 32;
  const unbiasedLimit = sourceSize - (sourceSize % count);
  const buffer = new Uint32Array(1);

  // Reject the incomplete final bucket before mapping to the permitted numbers.
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= unbiasedLimit);

  return buffer[0] % count;
}

function randomNumber(min: number, max: number, digits: number, previous: string) {
  const previousNumber = isNumberInRange(previous, digits, min, max)
    ? Number(previous)
    : null;
  const count = max - min + 1 - (previousNumber === null ? 0 : 1);
  let value = min + randomIndex(count);
  // Exclude the previous value without retrying an otherwise valid sample.
  if (previousNumber !== null && value >= previousNumber) value += 1;
  return normalizeTraditionalNumber(String(value), digits);
}

const VALID_INVERT_NUMBERS = Array.from(
  { length: 999 },
  (_, index) => String(index + 1).padStart(3, "0"),
).filter(isValidInvertNumber);

function randomInvertNumber(previous: string) {
  const normalizedPrevious = normalizeTraditionalNumber(previous, 3);
  const previousIndex = isValidInvertNumber(normalizedPrevious)
    ? VALID_INVERT_NUMBERS.indexOf(normalizedPrevious)
    : -1;
  const count = VALID_INVERT_NUMBERS.length - (previousIndex >= 0 ? 1 : 0);
  let candidateIndex = randomIndex(count);
  if (previousIndex >= 0 && candidateIndex >= previousIndex) candidateIndex += 1;
  return VALID_INVERT_NUMBERS[candidateIndex];
}

export function randomizeTraditionalDraft(
  gameId: TraditionalGameId,
  draft: TraditionalDraft,
): TraditionalDraft {
  if (gameId === "redoblona") {
    return {
      ...draft,
      initialNumber: randomNumber(0, 99, 2, draft.initialNumber),
      redoblonaNumber: randomNumber(0, 99, 2, draft.redoblonaNumber),
    };
  }
  if (gameId === "invert") {
    return { ...draft, number: randomInvertNumber(draft.number) };
  }
  return { ...draft, number: randomNumber(1, 999, 3, draft.number) };
}

export function getTraditionalPositionLabel(
  gameId: TraditionalGameId,
  position: number,
): string {
  if (gameId === "head") return "1.ª posición";
  return `Hasta la posición ${position}`;
}
