import { randomInt } from "node:crypto";

import { GamingDomainError } from "./errors";
import type { InstantPlayRequest } from "./schemas";
import type {
  InstantGameDefinition,
  PlayStatus,
  PyaeNeutralPolicy,
} from "./types";

export interface RandomSource {
  intInclusive(min: number, max: number): number;
}

export class ServerCryptoRandomSource implements RandomSource {
  intInclusive(min: number, max: number): number {
    return randomInt(min, max + 1);
  }
}

export interface InstantEvaluation {
  status: PlayStatus;
  ruleResult: string;
  matches: number | null;
  payoutMultiplier: number;
  prize: number;
}

export function formatResultNumber(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new GamingDomainError("INVALID_RESULT", "El resultado debe estar entre 001 y 999.");
  }
  return String(value).padStart(3, "0");
}

export function hundredRangeFor(value: number): string {
  if (value <= 99) return "001-099";
  const start = Math.floor(value / 100) * 100;
  return `${String(start).padStart(3, "0")}-${String(start + 99).padStart(3, "0")}`;
}

export function parityFor(value: number): "PAR" | "IMPAR" {
  return value % 2 === 0 ? "PAR" : "IMPAR";
}

export function generateResultNumbers(
  game: InstantGameDefinition,
  randomSource: RandomSource,
): readonly string[] {
  return Array.from({ length: game.reels }, () =>
    formatResultNumber(randomSource.intInclusive(game.rng.min, game.rng.max)),
  );
}

function resultValuesFor(
  game: InstantGameDefinition,
  resultNumbers: readonly string[],
): readonly number[] {
  if (resultNumbers.length !== game.reels) {
    throw new GamingDomainError(
      "INVALID_RESULT",
      `El juego ${game.id} requiere ${game.reels} resultado(s).`,
    );
  }

  return resultNumbers.map((result) => {
    if (!/^(?!000)\d{3}$/.test(result)) {
      throw new GamingDomainError("INVALID_RESULT", `Resultado inválido: ${result}.`);
    }
    return Number(result);
  });
}

function multiplierForMatches(game: InstantGameDefinition, matches: number): number {
  if (game.payout.kind !== "MATCH_TIERS") return 0;
  return game.payout.tiers.find((tier) => matches === tier.exactMatches)?.multiplier ?? 0;
}

function needsPayoutConfiguration(game: InstantGameDefinition, matches: number): boolean {
  return game.payout.kind === "MATCH_TIERS"
    && game.payout.pendingFromMatches !== undefined
    && matches >= game.payout.pendingFromMatches;
}

function winEvaluation(
  won: boolean,
  ruleResult: string,
  amount: number,
  multiplier: number,
  matches: number | null = null,
): InstantEvaluation {
  return {
    status: won ? "WON" : "LOST",
    ruleResult,
    matches,
    payoutMultiplier: won ? multiplier : 0,
    prize: won ? amount * multiplier : 0,
  };
}

export function evaluateInstantPlay(
  input: InstantPlayRequest,
  game: InstantGameDefinition,
  resultNumbers: readonly string[],
  neutral500Policy: PyaeNeutralPolicy = game.neutral500Policy ?? "REFUND",
): InstantEvaluation {
  if (input.gameId !== game.id) {
    throw new GamingDomainError("GAME_NOT_FOUND", "La regla no corresponde al juego solicitado.");
  }

  const values = resultValuesFor(game, resultNumbers);
  const first = values[0];

  switch (input.gameId) {
    case "sapyaite": {
      const outcome = parityFor(first);
      return winEvaluation(
        input.selection === outcome,
        outcome,
        input.amount,
        game.payout.kind === "MULTIPLIER" ? game.payout.winMultiplier : 0,
      );
    }
    case "poa": {
      const outcome = hundredRangeFor(first);
      return winEvaluation(
        input.selection === outcome,
        outcome,
        input.amount,
        game.payout.kind === "MULTIPLIER" ? game.payout.winMultiplier : 0,
      );
    }
    case "pyae": {
      if (first === 500) {
        return neutral500Policy === "REFUND"
          ? {
              status: "REFUNDED",
              ruleResult: "NEUTRAL",
              matches: null,
              payoutMultiplier: 1,
              prize: input.amount,
            }
          : {
              status: "LOST",
              ruleResult: "NEUTRAL",
              matches: null,
              payoutMultiplier: 0,
              prize: 0,
            };
      }
      const outcome = first < 500 ? "MENOR" : "MAYOR";
      return winEvaluation(
        input.selection === outcome,
        outcome,
        input.amount,
        game.payout.kind === "MULTIPLIER" ? game.payout.winMultiplier : 0,
      );
    }
    case "petei": {
      const outcome = resultNumbers[0].slice(-1);
      return winEvaluation(
        input.selection === outcome,
        outcome,
        input.amount,
        game.payout.kind === "MULTIPLIER" ? game.payout.winMultiplier : 0,
      );
    }
    case "mokoi": {
      const outcome = resultNumbers[0].slice(-2);
      return winEvaluation(
        input.selection === outcome,
        outcome,
        input.amount,
        game.payout.kind === "MULTIPLIER" ? game.payout.winMultiplier : 0,
      );
    }
    case "mbohapy":
      return winEvaluation(
        input.selection === resultNumbers[0],
        resultNumbers[0],
        input.amount,
        game.payout.kind === "MULTIPLIER" ? game.payout.winMultiplier : 0,
      );
    case "poa5":
    case "poa10": {
      const selected = new Set(input.selection.numbers);
      const matches = resultNumbers.filter((result) => selected.has(result)).length;
      if (needsPayoutConfiguration(game, matches)) {
        return {
          status: "PENDING",
          ruleResult: `${matches} ACIERTOS · PAGO PENDIENTE DE CONFIGURACIÓN`,
          matches,
          payoutMultiplier: 0,
          prize: 0,
        };
      }
      const multiplier = multiplierForMatches(game, matches);
      return winEvaluation(
        multiplier > 0,
        `${matches} ${matches === 1 ? "ACIERTO" : "ACIERTOS"}`,
        input.amount,
        multiplier,
        matches,
      );
    }
    case "racha5": {
      const matches = values.filter((value) => parityFor(value) === input.selection).length;
      const multiplier = multiplierForMatches(game, matches);
      return winEvaluation(
        multiplier > 0,
        `${matches}/5 ${input.selection}`,
        input.amount,
        multiplier,
        matches,
      );
    }
  }
}
