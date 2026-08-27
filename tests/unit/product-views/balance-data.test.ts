import { describe, expect, it } from "vitest";

import {
  filterWalletMovements,
  parseWalletAmount,
  summarizeWalletMovements,
  walletAmountError,
} from "@/features/product/balance-data";
import type { WalletMovement } from "@/lib/gaming/types";

const now = new Date("2026-08-27T15:00:00.000Z").getTime();
const day = 86_400_000;

function movement(id: string, overrides: Partial<WalletMovement> = {}): WalletMovement {
  return {
    id,
    type: "TOPUP",
    amount: 50_000,
    currency: "PYG",
    balanceAfter: 150_000,
    referenceId: `QL-${id}`,
    method: "CARD",
    createdAt: new Date(now).toISOString(),
    ...overrides,
  };
}

describe("importes de la billetera", () => {
  it.each([
    ["10000", 10_000],
    ["10.000", 10_000],
    ["5.000.000", 5_000_000],
    [" 50.000   ", 50_000],
    ["0", 0],
  ])("interpreta %s como un importe entero de %s guaraníes", (value, amount) => {
    expect(parseWalletAmount(value as string)).toBe(amount);
  });

  it.each([
    "", " ", "10.5", "10,5", "10,000", "10.000,50", "10.000.00", "1000.000",
    "1e5", "0x10000", "-10000", "+10000", "Gs. 10.000", "10 000", "NaN", "Infinity",
    "9007199254740992",
  ])("rechaza %j sin transformarlo silenciosamente en otro monto", (value) => {
    expect(parseWalletAmount(value)).toBeNull();
  });

  it("distingue un formato inválido de un importe por debajo o encima de los límites", () => {
    expect(walletAmountError("10.5", "deposit", 0)).toContain("sin decimales");
    expect(walletAmountError("9.999", "deposit", 0)).toContain("mínimo");
    expect(walletAmountError("0", "deposit", 0)).toContain("mínimo");
    expect(walletAmountError("5.000.001", "deposit", 0)).toContain("máximo");
  });

  it("admite ambos límites para depósitos aunque la cuenta no tenga saldo", () => {
    expect(walletAmountError("10.000", "deposit", 0)).toBeNull();
    expect(walletAmountError("5.000.000", "deposit", 0)).toBeNull();
  });

  it("permite retirar el saldo exacto y bloquea un retiro que lo exceda", () => {
    expect(walletAmountError("50.000", "withdrawal", 50_000)).toBeNull();
    expect(walletAmountError("50.001", "withdrawal", 50_000)).toContain("saldo disponible");
    expect(walletAmountError("10.000", "withdrawal", 0)).toContain("saldo disponible");
    expect(walletAmountError("9.999", "withdrawal", 50_000)).toContain("mínimo");
    expect(walletAmountError("5.000.001", "withdrawal", 6_000_000)).toContain("máximo");
  });
});

describe("filtros del historial de saldo", () => {
  const history = [
    movement("old-card", { createdAt: new Date(now - 31 * day).toISOString() }),
    movement("withdraw-tigo", {
      type: "WITHDRAWAL", amount: -20_000, method: "TIGO", createdAt: new Date(now - day).toISOString(),
    }),
    movement("cash-legacy", { method: "PUNTO_RECARGA", createdAt: new Date(now - 10 * day).toISOString() }),
    movement("stake", { type: "STAKE", amount: -2_000, method: null, referenceId: null }),
    movement("cash-current", { method: "CASH_POINT", createdAt: new Date(now - 2 * day).toISOString() }),
    movement("prize", { type: "PRIZE", amount: 200_000, method: null }),
    movement("refund", { type: "REFUND", amount: 2_000, method: null }),
  ];

  it("ordena del más reciente al más antiguo sin modificar el historial original", () => {
    const original = history.map((entry) => ({ ...entry }));
    const frozen = Object.freeze(history.map((entry) => Object.freeze({ ...entry })));
    const filtered = filterWalletMovements(frozen);

    expect(filtered.map(({ id }) => id)).toEqual([
      "stake", "prize", "refund", "withdraw-tigo", "cash-current", "cash-legacy", "old-card",
    ]);
    expect(frozen).toEqual(original);
    expect(filtered).not.toBe(frozen);
  });

  it.each([
    ["TOPUP", ["cash-current", "cash-legacy", "old-card"]],
    ["WITHDRAWAL", ["withdraw-tigo"]],
    ["OTHER", ["stake", "prize", "refund"]],
  ] as const)("separa el filtro %s de los otros tipos de movimiento", (type, ids) => {
    expect(filterWalletMovements(history, { type }).map(({ id }) => id)).toEqual(ids);
  });

  it("agrupa los puntos de recarga anteriores y actuales bajo Efectivo", () => {
    expect(filterWalletMovements(history, { method: "CASH_POINT" }).map(({ id }) => id))
      .toEqual(["cash-current", "cash-legacy"]);
    expect(filterWalletMovements(history, { method: "TIGO" }).map(({ id }) => id))
      .toEqual(["withdraw-tigo"]);
  });

  it("combina tipo, canal, período y búsqueda en lugar de aplicar sólo el último filtro", () => {
    expect(filterWalletMovements(history, {
      type: "TOPUP", method: "CASH_POINT", period: "7D", query: "  EFECTÍVO  ",
    }, now).map(({ id }) => id)).toEqual(["cash-current"]);
    expect(filterWalletMovements(history, {
      type: "WITHDRAWAL", method: "CASH_POINT", period: "7D",
    }, now)).toEqual([]);
  });

  it("busca por tipo, canal, referencia e identificador sin distinguir mayúsculas ni acentos", () => {
    expect(filterWalletMovements(history, { query: "deposito" })).toHaveLength(3);
    expect(filterWalletMovements(history, { query: "tIgO" }).map(({ id }) => id))
      .toEqual(["withdraw-tigo"]);
    expect(filterWalletMovements(history, { query: "ql-cash-legacy" }).map(({ id }) => id))
      .toEqual(["cash-legacy"]);
    expect(filterWalletMovements(history, { query: "STAKE" }).map(({ id }) => id))
      .toEqual(["stake"]);
    expect(filterWalletMovements(history, { query: "referencia inexistente" })).toEqual([]);
  });

  it.each([
    ["7D", 7],
    ["30D", 30],
  ] as const)("incluye el límite exacto de %s y excluye lo anterior y las fechas inválidas", (period, days) => {
    const cutoff = now - days * day;
    const entries = [
      movement("before", { createdAt: new Date(cutoff - 1).toISOString() }),
      movement("boundary", { createdAt: new Date(cutoff).toISOString() }),
      movement("recent", { createdAt: new Date(now).toISOString() }),
      movement("invalid-date", { createdAt: "not-a-date" }),
    ];

    expect(filterWalletMovements(entries, { period }, now).map(({ id }) => id))
      .toEqual(["recent", "boundary"]);
  });

  it("muestra el estado vacío sin generar movimientos", () => {
    expect(filterWalletMovements([], { type: "TOPUP", period: "30D", query: "QR" }, now))
      .toEqual([]);
  });
});

describe("resumen de depósitos y retiros", () => {
  it("totaliza sólo entradas y salidas de saldo, sin confundir premios, jugadas o reintegros", () => {
    const entries = [
      movement("deposit-card", { amount: 50_000 }),
      movement("deposit-qr", { amount: 20_000, method: "QR" }),
      movement("withdrawal-tigo", { type: "WITHDRAWAL", amount: -15_000, method: "TIGO" }),
      movement("withdrawal-cash", { type: "WITHDRAWAL", amount: -10_000, method: "CASH_POINT" }),
      movement("stake", { type: "STAKE", amount: -500_000, method: null }),
      movement("prize", { type: "PRIZE", amount: 1_000_000, method: null }),
      movement("refund", { type: "REFUND", amount: 500_000, method: null }),
    ];

    expect(summarizeWalletMovements(entries)).toEqual({
      deposits: 70_000,
      withdrawals: 25_000,
      depositCount: 2,
      withdrawalCount: 2,
    });
  });

  it("inicia los importes y contadores en cero cuando no hay operaciones", () => {
    expect(summarizeWalletMovements([])).toEqual({
      deposits: 0,
      withdrawals: 0,
      depositCount: 0,
      withdrawalCount: 0,
    });
  });
});
