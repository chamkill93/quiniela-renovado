import { describe, expect, it } from "vitest";

import {
  instantPlayRequestSchema,
  traditionalPlayRequestSchema,
  walletTopupRequestSchema,
} from "../../../src/lib/gaming/schemas";

describe("server-side gaming schemas", () => {
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

  it("validates wallet top-ups on the server", () => {
    expect(
      walletTopupRequestSchema.parse({ amount: 50_000, method: "CARD" }),
    ).toEqual({ amount: 50_000, method: "CARD" });

    expect(() =>
      walletTopupRequestSchema.parse({ amount: 75_000, method: "CARD" }),
    ).toThrow();
    expect(() =>
      walletTopupRequestSchema.parse({ amount: 50_000, method: "CRYPTO" }),
    ).toThrow();
  });
});
