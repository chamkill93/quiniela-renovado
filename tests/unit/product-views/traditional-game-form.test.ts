import { describe, expect, it, vi } from "vitest";

import {
  buildTraditionalPlayInput,
  createTraditionalDraft,
  getRedoblonaRanges,
  getTraditionalPositionLabel,
  getTraditionalPositionRange,
  isValidInvertNumber,
  normalizeTraditionalNumber,
  randomizeTraditionalDraft,
  validateTraditionalDraft,
} from "@/features/product/traditional-game-form";
import { TRADITIONAL_GAMES } from "@/lib/gaming/catalog";
import { traditionalPlayRequestSchema } from "@/lib/gaming/schemas";
import { getTraditionalStakeTotals } from "@/lib/gaming/traditional-stake";
import type { TraditionalGameDefinition } from "@/lib/gaming/types";
import type { TraditionalGameId } from "@/lib/product/catalog";

function definition(gameId: TraditionalGameId): TraditionalGameDefinition {
  const game = TRADITIONAL_GAMES.find((item) => item.id === gameId);
  if (!game) throw new Error(`Missing fixture: ${gameId}`);
  return game;
}

function mockRandom(...values: number[]) {
  let index = 0;
  return vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation((array) => {
    if (!(array instanceof Uint32Array)) throw new Error("Expected a Uint32Array");
    const value = values[index++];
    if (value === undefined) throw new Error("Unexpected random request");
    array[0] = value;
    return array;
  });
}

describe("borrador de apuestas tradicionales", () => {
  it("suma únicamente las denominaciones habilitadas sin superar 10.000 por sorteo", () => {
    expect(getTraditionalStakeTotals([500, 1_000, 2_000, 5_000, 10_000])).toEqual(Array.from({ length: 20 }, (_, index) => (index + 1) * 500));
    expect(getTraditionalStakeTotals([2_000, 7_000])).toEqual([2_000, 4_000, 6_000, 7_000, 8_000, 9_000, 10_000]);
    expect(getTraditionalStakeTotals([5_000, 7_000])).toEqual([5_000, 7_000, 10_000]);
    expect(getTraditionalStakeTotals([0, -500, 499, 750, 20_000, 50_000, NaN])).toEqual([]);
  });

  it("empieza sin números preseleccionados y permite Invertida desde la primera posición", () => {
    for (const gameId of ["head", "prizes", "invert", "redoblona"] as const) {
      expect(createTraditionalDraft(gameId)).toEqual({
        number: "",
        position: gameId === "invert" ? 1 : 2,
        initialNumber: "",
        initialUntil: 1,
        redoblonaNumber: "",
        redoblonaUntil: 7,
      });
    }
  });

  it("completa ceros a la izquierda sin convertir un campo vacío en una selección", () => {
    for (const value of ["", " ", "abc"]) {
      expect(normalizeTraditionalNumber(value, 3)).toBe("");
      expect(normalizeTraditionalNumber(value, 2)).toBe("");
    }
    expect(normalizeTraditionalNumber("7", 3)).toBe("007");
    expect(normalizeTraditionalNumber("07", 3)).toBe("007");
    expect(normalizeTraditionalNumber("007", 3)).toBe("007");
    expect(normalizeTraditionalNumber("0", 2)).toBe("00");
    expect(normalizeTraditionalNumber("7", 2)).toBe("07");
    expect(normalizeTraditionalNumber("1234", 3)).toBe("123");
  });

  it.each(["head", "prizes"] as const)(
    "valida 001–999 para %s y acepta números que se completarán al enviar",
    (gameId) => {
      const draft = createTraditionalDraft(gameId);
      for (const number of ["1", "7", "07", "001", "999"]) {
        expect(validateTraditionalDraft(gameId, { ...draft, number }, definition(gameId))).toEqual({});
      }
      for (const number of ["", "0", "00", "000", "1000", "-1", "1.5", "7a", " 7 "]) {
        expect(validateTraditionalDraft(gameId, { ...draft, number }, definition(gameId)).number).toBeTruthy();
      }
    },
  );

  it("acepta Invertida sólo cuando el número normalizado tiene tres cifras distintas", () => {
    const draft = createTraditionalDraft("invert");
    for (const number of ["12", "012", "102", "120", "987"]) {
      expect(validateTraditionalDraft("invert", { ...draft, number }, definition("invert"))).toEqual({});
      expect(isValidInvertNumber(normalizeTraditionalNumber(number, 3))).toBe(true);
    }
    for (const number of ["", "0", "1", "7", "00", "01", "000", "001", "007", "011", "101", "112", "777", "1000"]) {
      expect(validateTraditionalDraft("invert", { ...draft, number }, definition("invert")).number)
        .toMatch(/001.*999.*tres cifras distintas|001 y 999/);
    }
  });

  it("valida dos números de dos cifras y los alcances de Redoblona", () => {
    const draft = createTraditionalDraft("redoblona");
    expect(validateTraditionalDraft("redoblona", draft, definition("redoblona"))).toEqual({
      initialNumber: expect.any(String),
      redoblonaNumber: expect.any(String),
    });
    for (const initialNumber of ["00", "05", "35", "99"]) {
      expect(validateTraditionalDraft("redoblona", {
        ...draft, initialNumber, redoblonaNumber: "00",
      }, definition("redoblona"))).toEqual({});
    }
    for (const redoblonaNumber of ["", "0", "000", "100", "-1", "7a"]) {
      expect(validateTraditionalDraft("redoblona", {
        ...draft, initialNumber: "35", redoblonaNumber,
      }, definition("redoblona")).redoblonaNumber).toBeTruthy();
    }
    expect(validateTraditionalDraft("redoblona", {
      ...draft, initialNumber: "7", redoblonaNumber: "00",
    }, definition("redoblona")).initialNumber).toBeTruthy();
    expect(validateTraditionalDraft("redoblona", {
      ...draft, initialNumber: "35", redoblonaNumber: "72", initialUntil: 8, redoblonaUntil: 7,
    }, definition("redoblona")).redoblonaUntil).toMatch(/igual o mayor/i);
  });

  it("usa el rango recibido y rechaza posiciones no enteras o fuera de rango", () => {
    const remoteDefinition: TraditionalGameDefinition = {
      ...definition("prizes"),
      selection: { kind: "THREE_DIGIT", position: { min: 4, max: 8 } },
    };
    const draft = { ...createTraditionalDraft("prizes"), number: "123" };
    expect(getTraditionalPositionRange(remoteDefinition)).toEqual({ min: 4, max: 8 });
    for (const position of [4, 6, 8]) {
      expect(validateTraditionalDraft("prizes", { ...draft, position }, remoteDefinition)).toEqual({});
    }
    for (const position of [1, 2, 9, 14, 4.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateTraditionalDraft("prizes", { ...draft, position }, remoteDefinition).position).toBeTruthy();
    }
  });

  it("no inventa posiciones si el catálogo no las informa ni las exige para Cabeza", () => {
    const withoutPositions: TraditionalGameDefinition = {
      ...definition("prizes"),
      selection: { kind: "THREE_DIGIT", position: null },
    };
    expect(getTraditionalPositionRange(withoutPositions)).toBeNull();
    expect(validateTraditionalDraft("prizes", {
      ...createTraditionalDraft("prizes"), number: "123",
    }, withoutPositions).position).toBeTruthy();
    expect(validateTraditionalDraft("head", {
      ...createTraditionalDraft("head"), number: "123", position: Number.NaN,
    }, definition("head"))).toEqual({});
    expect(getTraditionalPositionRange(definition("redoblona"))).toBeNull();
    expect(getRedoblonaRanges(definition("redoblona"))).toEqual({
      initialUntil: { min: 1, max: 14 },
      redoblonaUntil: { min: 7, max: 14 },
    });
  });

  it.each(["head", "prizes", "invert", "redoblona"] as const)(
    "construye el contrato de %s con ceros, sin campos ajenos ni mutar el borrador",
    (gameId) => {
      const draft = Object.freeze({
        ...createTraditionalDraft(gameId), number: gameId === "invert" ? "12" : "7", initialNumber: "5", redoblonaNumber: "0",
      });
      const request = buildTraditionalPlayInput(gameId, 5_000, "early", draft);
      expect(request).toEqual({
        gameId,
        amount: 5_000,
        drawId: "early",
        selection: gameId === "redoblona"
          ? { initialNumber: "05", initialUntil: 1, redoblonaNumber: "00", redoblonaUntil: 7 }
          : gameId === "head"
            ? { number: "007" }
            : { number: gameId === "invert" ? "012" : "007", position: gameId === "invert" ? 1 : 2 },
      });
      expect(traditionalPlayRequestSchema.parse(request)).toEqual(request);
      expect(draft.number).toBe(gameId === "invert" ? "12" : "7");
    },
  );

  it("conserva los campos vacíos al construir la solicitud para que no sean apuestas implícitas", () => {
    expect(buildTraditionalPlayInput("head", 500, "early", createTraditionalDraft("head")).selection)
      .toEqual({ number: "" });
    expect(buildTraditionalPlayInput("redoblona", 500, "early", createTraditionalDraft("redoblona")).selection)
      .toEqual({ initialNumber: "", initialUntil: 1, redoblonaNumber: "", redoblonaUntil: 7 });
  });

  it("explica la postura sin agregar reglas de pagos o rangos de aciertos", () => {
    expect(getTraditionalPositionLabel("head", 2)).toBe("1.ª posición");
    expect(getTraditionalPositionLabel("prizes", 8)).toBe("Hasta la posición 8");
    expect(getTraditionalPositionLabel("invert", 1)).toBe("Hasta la posición 1");
  });
});

describe("selección tradicional al azar", () => {
  it.each(["head", "prizes"] as const)("respeta ambos extremos de 001–999 para %s", (gameId) => {
    const random = mockRandom(0, 998);
    const draft = createTraditionalDraft(gameId);
    expect(randomizeTraditionalDraft(gameId, draft).number).toBe("001");
    expect(randomizeTraditionalDraft(gameId, draft).number).toBe("999");
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("genera Invertidas de tres cifras distintas y evita repetir la selección anterior", () => {
    const random = mockRandom(0, 719, 0, 718);
    const draft = createTraditionalDraft("invert");
    expect(randomizeTraditionalDraft("invert", draft).number).toBe("012");
    expect(randomizeTraditionalDraft("invert", draft).number).toBe("987");
    expect(randomizeTraditionalDraft("invert", { ...draft, number: "12" }).number).toBe("013");
    expect(randomizeTraditionalDraft("invert", { ...draft, number: "987" }).number).toBe("986");
    expect(random).toHaveBeenCalledTimes(4);
  });

  it("incluye 00 y 99 en ambos números y conserva los dos alcances de Redoblona", () => {
    mockRandom(0, 0, 99, 99);
    const draft = Object.freeze({
      ...createTraditionalDraft("redoblona"), number: "123", initialUntil: 6, redoblonaUntil: 12,
    });
    expect(randomizeTraditionalDraft("redoblona", draft)).toEqual({
      ...draft, initialNumber: "00", redoblonaNumber: "00",
    });
    expect(randomizeTraditionalDraft("redoblona", draft)).toEqual({
      ...draft, initialNumber: "99", redoblonaNumber: "99",
    });
  });

  it("excluye el número previo incluso si todavía no tiene los ceros a la izquierda", () => {
    mockRandom(0, 6, 997);
    const draft = Object.freeze({
      ...createTraditionalDraft("prizes"), number: "001", initialNumber: "07", redoblonaNumber: "42", position: 9,
    });
    expect(randomizeTraditionalDraft("prizes", draft)).toEqual({
      ...draft, number: "002",
    });
    expect(randomizeTraditionalDraft("prizes", { ...draft, number: "7" }).number).toBe("008");
    expect(randomizeTraditionalDraft("prizes", { ...draft, number: "999" }).number).toBe("998");
  });

  it("renueva ambos números de Redoblona sin repetir los anteriores", () => {
    mockRandom(0, 0, 98, 98);
    const draft = createTraditionalDraft("redoblona");
    expect(randomizeTraditionalDraft("redoblona", { ...draft, initialNumber: "1", redoblonaNumber: "0" }))
      .toMatchObject({ initialNumber: "00", redoblonaNumber: "01" });
    expect(randomizeTraditionalDraft("redoblona", { ...draft, initialNumber: "99", redoblonaNumber: "99" }))
      .toMatchObject({ initialNumber: "98", redoblonaNumber: "98" });
  });

  it("descarta la cola incompleta de 32 bits para no introducir sesgo al aplicar módulo", () => {
    const random = mockRandom(2 ** 32 - 1, 0, 0, 2 ** 32 - 1, 99);
    expect(randomizeTraditionalDraft("head", createTraditionalDraft("head")).number).toBe("001");
    expect(randomizeTraditionalDraft("redoblona", createTraditionalDraft("redoblona")))
      .toMatchObject({ initialNumber: "00", redoblonaNumber: "99" });
    expect(random).toHaveBeenCalledTimes(5);
  });
});
