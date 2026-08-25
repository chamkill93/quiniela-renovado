import { describe, expect, it } from "vitest";

import { findInstantGame } from "../../../src/lib/gaming/catalog";
import { instantPlayRequestSchema } from "../../../src/lib/gaming/schemas";
import { evaluateInstantPlay } from "../../../src/lib/gaming/rules";

function evaluate(rawInput: unknown, results: readonly string[], policy: "REFUND" | "LOSS" = "REFUND") {
  const input = instantPlayRequestSchema.parse(rawInput);
  const game = findInstantGame(input.gameId, policy);
  if (!game) throw new Error("missing game");
  return evaluateInstantPlay(input, game, results, policy);
}

describe("instant rules", () => {
  it.each([
    ["sapyaite", "PAR", ["684"], "PAR", 2],
    ["poa", "300-399", ["372"], "300-399", 9],
    ["pyae", "MAYOR", ["718"], "MAYOR", 2],
    ["petei", "7", ["297"], "7", 9],
    ["mokoi", "84", ["684"], "84", 80],
    ["mbohapy", "497", ["497"], "497", 700],
  ] as const)(
    "evaluates %s on an authoritative result",
    (gameId, selection, results, ruleResult, multiplier) => {
      const evaluation = evaluate({ gameId, amount: 500, selection }, results);

      expect(evaluation).toMatchObject({
        status: "WON",
        ruleResult,
        payoutMultiplier: multiplier,
        prize: 500 * multiplier,
      });
    },
  );

  it("supports refund or loss for Pya’e result 500", () => {
    const input = { gameId: "pyae", amount: 500, selection: "MAYOR" };

    expect(evaluate(input, ["500"], "REFUND")).toMatchObject({
      status: "REFUNDED",
      prize: 500,
      payoutMultiplier: 1,
    });
    expect(evaluate(input, ["500"], "LOSS")).toMatchObject({
      status: "LOST",
      prize: 0,
      payoutMultiplier: 0,
    });
  });

  it("evaluates Po’a 5, Po’a 10 and Racha 5 from configured tiers", () => {
    const selection = { numbers: ["001", "002", "003"] };
    expect(
      evaluate(
        { gameId: "poa5", amount: 500, selection },
        ["001", "999", "002", "111", "003"],
      ),
    ).toMatchObject({ status: "WON", matches: 3, payoutMultiplier: 5_000 });

    expect(
      evaluate(
        { gameId: "poa10", amount: 500, selection },
        ["001", "002", "003", "001", "999", "998", "997", "996", "995", "994"],
      ),
    ).toMatchObject({ status: "PENDING", matches: 4, payoutMultiplier: 0, prize: 0 });

    expect(
      evaluate(
        { gameId: "racha5", amount: 500, selection: "PAR" },
        ["002", "004", "006", "008", "009"],
      ),
    ).toMatchObject({ status: "WON", matches: 4, payoutMultiplier: 3 });
  });
});
