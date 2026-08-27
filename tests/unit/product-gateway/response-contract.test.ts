import { describe, expect, it } from "vitest";

import type { PlayResponse } from "@/lib/product/api-types";
import {
  assertPlayResponseMatchesCommand,
  assertTopUpResponseMatchesInput,
  assertWithdrawalResponseMatchesInput,
  ProductGatewayProtocolError,
  type ProductPlayCommand,
  type ProductTopUpResponse,
  type ProductWithdrawalResponse,
} from "@/lib/product/gateway";

const command: ProductPlayCommand = {
  kind: "instant",
  input: { gameId: "sapyaite", amount: 500, selection: "007" },
};

const response: PlayResponse = {
  play: {
    id: "play-1",
    ticketId: "ticket-1",
    family: "INSTANT",
    gameId: "sapyaite",
    gameName: "Sapy’aite",
    selection: "007",
    drawId: null,
    amount: 500,
    prize: 0,
    status: "LOST",
    result: "497",
    resultNumbers: ["497"],
    createdAt: "2026-08-25T12:00:00.000Z",
  },
  ticket: {
    id: "ticket-1",
    playId: "play-1",
    gameId: "sapyaite",
    family: "INSTANT",
    drawId: null,
    amount: 500,
    resultNumbers: ["497"],
  },
  session: { balance: 9_500, currency: "PYG" },
  replayed: false,
};

describe("product mutation response contract", () => {
  const withdrawal: ProductWithdrawalResponse = {
    session: { id: "user-1", displayName: "Ana", role: "PLAYER", balance: 10_000, currency: "PYG" },
    balanceEntry: {
      id: "withdrawal-1", type: "WITHDRAWAL", amount: -20_000, currency: "PYG",
      balanceAfter: 10_000, referenceId: "RET-1", method: "TIGO", createdAt: "2026-08-27T12:00:00.000Z",
    },
    replayed: false,
  };

  it("correlates a withdrawal with the submitted amount, channel and resulting balance", () => {
    expect(assertWithdrawalResponseMatchesInput(withdrawal, { amount: 20_000, method: "TIGO" })).toBe(withdrawal);
  });

  it.each([
    { amount: 20_000 },
    { amount: -10_000 },
    { method: "CLARO" as const },
    { type: "TOPUP" as const },
    { balanceAfter: 30_000 },
  ])("rejects a withdrawal receipt with mismatched fields: %j", (entryChanges) => {
    expect(() => assertWithdrawalResponseMatchesInput({
      ...withdrawal,
      balanceEntry: { ...withdrawal.balanceEntry, ...entryChanges },
    }, { amount: 20_000, method: "TIGO" })).toThrow(ProductGatewayProtocolError);
  });

  it.each([0, -10_000, Number.POSITIVE_INFINITY, 10_000.5])("rejects invalid submitted withdrawal amount %s", (amount) => {
    expect(() => assertWithdrawalResponseMatchesInput(withdrawal, { amount, method: "TIGO" })).toThrow(ProductGatewayProtocolError);
  });

  it("rejects a negative resulting withdrawal balance", () => {
    expect(() => assertWithdrawalResponseMatchesInput({
      ...withdrawal,
      session: { ...withdrawal.session, balance: -10_000 },
      balanceEntry: { ...withdrawal.balanceEntry, balanceAfter: -10_000 },
    }, { amount: 20_000, method: "TIGO" })).toThrow(ProductGatewayProtocolError);
  });

  it("accepts a play correlated to the exact command", () => {
    expect(assertPlayResponseMatchesCommand(response, command)).toBe(response);
  });

  it("rejects a coherent-looking play from another command", () => {
    expect(() =>
      assertPlayResponseMatchesCommand(
        {
          ...response,
          play: { ...response.play, gameId: "mbohapy", amount: 50_000 },
          ticket: { ...response.ticket, gameId: "mbohapy", amount: 50_000 },
        },
        command,
      ),
    ).toThrow(ProductGatewayProtocolError);
  });

  it("correlates a TOPUP movement with its submitted amount and method", () => {
    const topUp: ProductTopUpResponse = {
      session: {
        id: "user-1",
        displayName: "Ana",
        role: "PLAYER",
        balance: 30_000,
        currency: "PYG",
      },
      balanceEntry: {
        id: "movement-1",
        type: "TOPUP",
        amount: 20_000,
        currency: "PYG",
        balanceAfter: 30_000,
        referenceId: "topup-1",
        method: "CARD",
        createdAt: "2026-08-25T12:00:00.000Z",
      },
      replayed: false,
    };

    expect(
      assertTopUpResponseMatchesInput(topUp, { amount: 20_000, method: "CARD" }),
    ).toBe(topUp);
    expect(() =>
      assertTopUpResponseMatchesInput(topUp, {
        amount: 20_000,
        method: "BANK_TRANSFER",
      }),
    ).toThrow(ProductGatewayProtocolError);
  });
});
