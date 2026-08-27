import type { TraditionalPlayRequest } from "@/lib/gaming/schemas";
import type { TraditionalGameDefinition } from "@/lib/gaming/types";
import type { TraditionalGameId } from "@/lib/product/catalog";

export type TraditionalDraft = {
  number: string;
  head: string;
  redoblona: string;
  position: number;
};

export function createTraditionalDraft(gameId: TraditionalGameId): TraditionalDraft {
  return {
    number: "",
    head: "",
    redoblona: "",
    position: gameId === "invert" ? 1 : 2,
  };
}

export function normalizeTraditionalNumber(value: string, digits: number): string {
  const number = value.replace(/\D/g, "").slice(0, digits);
  return number ? number.padStart(digits, "0") : "";
}

export function getTraditionalPositionRange(
  definition: TraditionalGameDefinition,
): { min: number; max: number } | null {
  const selection = definition.selection;
  if (selection.kind === "MEGALOTO" || !selection.position) return null;
  return { min: selection.position.min, max: selection.position.max };
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
    if (!isNumberInRange(draft.head, 3, 1, 999)) {
      errors.head = "Ingresá un número de cabeza entre 001 y 999.";
    }
    if (!isNumberInRange(draft.redoblona, 2, 0, 99)) {
      errors.redoblona = "Ingresá una terminación entre 00 y 99.";
    }
  } else if (!isNumberInRange(draft.number, 3, 1, 999)) {
    errors.number = "Ingresá un número entre 001 y 999.";
  }

  // A la Cabeza has a fixed server-side position, absent from its request.
  if (gameId !== "head") {
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
        head: normalizeTraditionalNumber(draft.head, 3),
        redoblona: normalizeTraditionalNumber(draft.redoblona, 2),
        position: draft.position,
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

function randomNumber(min: number, max: number, digits: number, previous: string) {
  const previousNumber = isNumberInRange(previous, digits, min, max)
    ? Number(previous)
    : null;
  const count = max - min + 1 - (previousNumber === null ? 0 : 1);
  const sourceSize = 2 ** 32;
  const unbiasedLimit = sourceSize - (sourceSize % count);
  const buffer = new Uint32Array(1);

  // Reject the incomplete final bucket before mapping to the permitted numbers.
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= unbiasedLimit);

  let value = min + (buffer[0] % count);
  // Exclude the previous value without retrying an otherwise valid sample.
  if (previousNumber !== null && value >= previousNumber) value += 1;
  return normalizeTraditionalNumber(String(value), digits);
}

export function randomizeTraditionalDraft(
  gameId: TraditionalGameId,
  draft: TraditionalDraft,
): TraditionalDraft {
  if (gameId === "redoblona") {
    return {
      ...draft,
      head: randomNumber(1, 999, 3, draft.head),
      redoblona: randomNumber(0, 99, 2, draft.redoblona),
    };
  }
  return { ...draft, number: randomNumber(1, 999, 3, draft.number) };
}

export function getTraditionalPositionLabel(
  gameId: TraditionalGameId,
  position: number,
): string {
  if (gameId === "head") return "1.ª posición";
  if (gameId === "redoblona") return `Cabeza + hasta la posición ${position}`;
  return `Hasta la posición ${position}`;
}
