import { describe, expect, it } from "vitest";

import {
  instantPlayRequestSchema,
  traditionalPlayRequestSchema,
  walletTopupRequestSchema,
  walletWithdrawalRequestSchema,
} from "../../../src/lib/gaming/schemas";

describe("server-side gaming schemas", () => {
  it.each(["head", "prizes", "invert", "redoblona"])("accepts additive stakes up to 10,000 for %s and rejects higher amounts", (gameId) => {
    const selection = gameId === "redoblona"
      ? { head: "123", redoblona: "45", position: 2 }
      : { number: "123", ...(gameId === "head" ? {} : { position: 2 }) };
    for (const amount of [500, 1_500, 3_500, 9_500, 10_000]) {
      expect(traditionalPlayRequestSchema.parse({ gameId, drawId: "early", amount, selection }).amount).toBe(amount);
    }
    for (const amount of [0, -500, 499, 750, 1_000.5, 10_001, 10_500, 20_000, 50_000, Infinity, NaN, "1000"]) {
      expect(() => traditionalPlayRequestSchema.parse({ gameId, drawId: "early", amount, selection })).toThrow();
    }
  });

  it("preserves the existing instant-game denominations", () => {
    expect(instantPlayRequestSchema.parse({ gameId: "sapyaite", selection: "123", amount: 20_000 }).amount).toBe(20_000);
    expect(() => instantPlayRequestSchema.parse({ gameId: "sapyaite", selection: "123", amount: 1_500 })).toThrow();
  });

  it("accepts canonical padded selections", () => {
    for (const selection of ["000", "007", "999"]) {
      expect(
        instantPlayRequestSchema.parse({
          gameId: "sapyaite",
          amount: 500,
          selection,
        }),
      ).toMatchObject({ gameId: "sapyaite", selection });
    }

    expect(
      instantPlayRequestSchema.parse({
        gameId: "mokoi",
        amount: 500,
        selection: "04",
      }),
    ).toMatchObject({ selection: "04" });

    expect(
      traditionalPlayRequestSchema.parse({
        gameId: "redoblona",
        amount: 1_000,
        drawId: "early",
        selection: { head: "007", redoblona: "00", position: 2 },
      }),
    ).toMatchObject({ gameId: "redoblona" });
  });

  it("rejects parity and malformed selections for exact Sapy’aite", () => {
    for (const selection of ["PAR", "IMPAR", "00", "1000", "7A7"]) {
      expect(() =>
        instantPlayRequestSchema.parse({
          gameId: "sapyaite",
          amount: 500,
          selection,
        }),
      ).toThrow();
    }
  });

  it("rejects 000 and repeated multi-game numbers", () => {
    expect(() =>
      instantPlayRequestSchema.parse({
        gameId: "mbohapy",
        amount: 500,
        selection: "000",
      }),
    ).toThrow();

    expect(() =>
      instantPlayRequestSchema.parse({
        gameId: "poa5",
        amount: 500,
        selection: { numbers: ["001", "001", "002"] },
      }),
    ).toThrow();
  });

  it("rejects repeated Megaloto numbers and unsupported amounts", () => {
    expect(() =>
      traditionalPlayRequestSchema.parse({
        gameId: "megaloto",
        amount: 750,
        drawId: "early",
        selection: {
          numbers: [1, 2, 3, 4, 5, 5],
          modality: "MEGA_POZO",
        },
      }),
    ).toThrow();
  });

  describe.each([
    { operation: "top-up", schema: walletTopupRequestSchema },
    { operation: "withdrawal", schema: walletWithdrawalRequestSchema },
  ])("wallet $operation", ({ schema }) => {
    it.each(["CARD", "QR", "CASH_POINT", "TIGO", "CLARO", "PERSONAL", "BANK_TRANSFER", "PUNTO_RECARGA"])(
      "accepts %s without payment credentials",
      (method) => {
        expect(schema.parse({ amount: 75_000, method })).toEqual({ amount: 75_000, method });
      },
    );

    it.each([10_000, 10_001, 75_000, 5_000_000])("accepts the integer amount %i", (amount) => {
      expect(schema.parse({ amount, method: "QR" }).amount).toBe(amount);
    });

    it.each([0, -10_000, 9_999, 10_000.5, 5_000_001, Infinity, NaN, "50000", null])(
      "rejects an invalid amount: %j",
      (amount) => {
        expect(() => schema.parse({ amount, method: "CARD" })).toThrow();
      },
    );

    it("rejects unknown channels and extraneous payment data", () => {
      expect(() => schema.parse({ amount: 50_000, method: "CRYPTO" })).toThrow();
      expect(() => schema.parse({ amount: 50_000, method: "CARD", cardNumber: "not-collected" })).toThrow();
      expect(() => schema.parse({ amount: 50_000, method: "TIGO", phone: "not-collected" })).toThrow();
    });
  });
});
