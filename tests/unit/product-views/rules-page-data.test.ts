import { describe, expect, it } from "vitest";

import {
  ALL_GAME_RULES,
  INSTANT_RULES,
  selectEnabledGameRules,
  TRADITIONAL_RULES,
} from "@/features/product/rules-page-data";
import { buildGamingCatalog } from "@/lib/gaming/catalog";

const currentCatalog = () => buildGamingCatalog(
  "REFUND", new Date("2026-08-26T10:00:00.000Z"), ["sapyaite"],
);

describe("rules page data", () => {
  it("conserva cuatro modalidades y nueve instantáneas sin duplicados", () => {
    expect(TRADITIONAL_RULES).toHaveLength(4);
    expect(INSTANT_RULES).toHaveLength(9);
    expect(ALL_GAME_RULES).toHaveLength(13);
    expect(new Set(ALL_GAME_RULES.map((rule) => rule.id)).size).toBe(13);
  });

  it("dirige cada regla a su juego canónico", () => {
    expect(TRADITIONAL_RULES.map((rule) => rule.href)).toEqual([
      "/quinielas/head", "/quinielas/prizes", "/quinielas/invert", "/quinielas/redoblona",
    ]);
    expect(INSTANT_RULES.map((rule) => rule.href)).toEqual([
      "/quinielas/sapyaite", "/instantaneas/poa", "/instantaneas/pyae",
      "/instantaneas/petei", "/instantaneas/mokoi", "/instantaneas/mbohapy",
      "/instantaneas/poa5", "/instantaneas/poa10", "/instantaneas/racha5",
    ]);
  });

  it("explica Sapy’aite como A la Cabeza instantáneo con tres cifras exactas", () => {
    const rule = INSTANT_RULES.find((item) => item.id === "sapyaite")!;
    expect(rule.copy).toBe("Como A la Cabeza, pero instantáneo: acertá las tres cifras exactas.");
    expect(rule.instructions[0]).toContain("000 a 999");
    expect(rule.instructions[1]).toContain("mismo orden");
    expect(rule.instructions[1]).toContain("No tenés que esperar un sorteo");
    expect(JSON.stringify(rule)).not.toMatch(/paridad|PAR|IMPAR/);
  });

  it("limita cada explicación a una frase y dos pasos breves", () => {
    for (const rule of ALL_GAME_RULES) {
      expect(rule.copy.length).toBeGreaterThan(10);
      expect(rule.copy.length).toBeLessThan(100);
      expect(rule.instructions).toHaveLength(2);
      expect(rule.instructions.join(" ").length).toBeLessThan(200);
    }
  });

  it("mantiene la salvedad del resultado neutral de Pya’e en el detalle", () => {
    const rule = INSTANT_RULES.find((item) => item.id === "pyae")!;
    expect(rule.copy).toContain("500");
    expect(rule.instructions.join(" ")).toContain("configuración vigente");
  });

  it("describe Redoblona según las selecciones actuales del formulario", () => {
    const rule = TRADITIONAL_RULES.find((item) => item.id === "redoblona")!;
    expect(rule.copy).toContain("cabeza de tres cifras");
    expect(rule.copy).toContain("terminación de dos");
    expect(rule.instructions.join(" ")).toContain("posición de 2 a 14");
  });

  it("muestra únicamente los juegos habilitados por el catálogo", () => {
    const catalog = currentCatalog();
    const enabled = selectEnabledGameRules(catalog);
    expect(enabled.traditional.map((rule) => rule.id)).toEqual(["head", "prizes", "invert", "redoblona"]);
    expect(enabled.instant.map((rule) => rule.id)).toEqual(["sapyaite"]);
    expect(selectEnabledGameRules({ ...catalog, traditional: [], instant: [] }))
      .toEqual({ traditional: [], instant: [] });
  });

  it("muestra el 700 configurado de Sapy’aite y un ejemplo de premio total", () => {
    expect(selectEnabledGameRules(currentCatalog()).instant[0].payout).toEqual({
      headline: "700× el importe",
      detail: "Si acertás con Gs. 500, el premio total es Gs. 350.000.",
      available: true,
      reference: false,
      calculation: { kind: "FIXED", multiplier: 700 },
    });
  });

  it("toma el multiplicador y el importe de ejemplo del catálogo, sin fijarlos en el texto", () => {
    const catalog = currentCatalog();
    const game = catalog.instant[0];
    const changed = selectEnabledGameRules({
      ...catalog,
      amounts: [2_000, 1_000],
      instant: [{ ...game, payout: { prototype: true, kind: "MULTIPLIER", winMultiplier: 800 } }],
    });
    expect(changed.instant[0].payout.headline).toBe("800× el importe");
    expect(changed.traditional[0].payout.headline).toBe("800× el importe");
    expect(changed.instant[0].payout.detail).toBe("Si acertás con Gs. 1.000, el premio total es Gs. 800.000.");
  });

  it("no inventa importes de ejemplo si el catálogo no tiene montos válidos", () => {
    const result = selectEnabledGameRules({ ...currentCatalog(), amounts: [0, -500, NaN, Infinity] });
    expect(result.instant[0].payout.detail).toBe("Si acertás, el premio total es tu importe × 700.");
  });

  it("asigna referencias separadas de la liquidación real a las cuatro modalidades", () => {
    const catalog = currentCatalog();
    const original = structuredClone(catalog);
    const rules = selectEnabledGameRules(catalog).traditional;
    expect(rules.map((rule) => rule.payout.headline)).toEqual([
      "700× el importe", "700× ÷ postura", "700× ÷ combinaciones ÷ postura", "700× · 80× ÷ postura",
    ]);
    expect(rules.every((rule) => rule.payout.reference)).toBe(true);
    expect(rules.map((rule) => rule.payout.calculation.kind)).toEqual(["FIXED", "POSITION", "PERMUTATIONS", "REDOBLONA"]);
    expect(catalog).toEqual(original);
  });

  it("conserva los pagos por cantidad de aciertos si se habilitan esos juegos", () => {
    const catalog = buildGamingCatalog("REFUND", new Date("2026-08-26T10:00:00.000Z"), ["poa5"]);
    const payout = selectEnabledGameRules(catalog).instant[0].payout;
    expect(payout.headline).toBe("Multiplicador según aciertos");
    expect(payout.rows).toEqual([
      { label: "1 acierto", value: "60×" },
      { label: "2 aciertos", value: "500×" },
      { label: "3 aciertos", value: "5.000×" },
    ]);
  });

  it("no incluye referencias documentales ni vocabulario de implementación en el contenido público", () => {
    const catalog = buildGamingCatalog("REFUND", new Date("2026-08-26T10:00:00.000Z"));
    const publicCopy = JSON.stringify(selectEnabledGameRules(catalog));
    expect(publicCopy).not.toMatch(/pdf|art[ií]culo|reglamento|vista previa|formulario actual|backoffice|proveedor|codexa/i);
    expect(publicCopy).not.toContain("sourceLabel");
  });
});
