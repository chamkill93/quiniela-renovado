import { describe, expect, it } from "vitest";

import {
  ALL_GAME_RULES,
  INSTANT_RULES,
  selectEnabledGameRules,
  TRADITIONAL_RULES,
} from "@/features/product/rules-page-data";
import { buildGamingCatalog } from "@/lib/gaming/catalog";

describe("rules page data", () => {
  it("publica exactamente cuatro reglas tradicionales y nueve instantáneas", () => {
    expect(TRADITIONAL_RULES).toHaveLength(4);
    expect(INSTANT_RULES).toHaveLength(9);
    expect(ALL_GAME_RULES).toHaveLength(13);
  });

  it("dirige cada regla a su juego canónico", () => {
    expect(TRADITIONAL_RULES.map((rule) => rule.href)).toEqual([
      "/quinielas/head",
      "/quinielas/prizes",
      "/quinielas/invert",
      "/quinielas/redoblona",
    ]);
    expect(INSTANT_RULES.map((rule) => rule.href)).toEqual([
      "/instantaneas/sapyaite",
      "/instantaneas/poa",
      "/instantaneas/pyae",
      "/instantaneas/petei",
      "/instantaneas/mokoi",
      "/instantaneas/mbohapy",
      "/instantaneas/poa5",
      "/instantaneas/poa10",
      "/instantaneas/racha5",
    ]);
  });

  it("no repite IDs ni incluye juegos tradicionales retirados", () => {
    const ids = ALL_GAME_RULES.map((rule) => rule.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("sapyaite-traditional");
    expect(ids).not.toContain("megaloto");
  });

  it("aclara que el resultado 500 de Pya’e depende de configuración", () => {
    const pyaeRule = INSTANT_RULES.find((rule) => rule.id === "pyae");

    expect(pyaeRule?.copy).toContain("500");
    expect(pyaeRule?.copy).toContain("configuración");
  });

  it("explica Sapy’aite como una elección exacta entre 000 y 999", () => {
    const sapyaiteRule = INSTANT_RULES.find((rule) => rule.id === "sapyaite");

    expect(sapyaiteRule).toMatchObject({
      tagline: "3 cifras exactas · resultado inmediato",
      copy: "Elegí un número completo de 000 a 999.",
    });
    expect(sapyaiteRule?.instructions[0]).toContain("000 a 999");
    expect(sapyaiteRule?.winCondition).toContain("mismo orden");
    expect(sapyaiteRule?.example).toContain("007");
    expect(sapyaiteRule?.example).not.toMatch(/PAR|IMPAR|paridad/i);
  });

  it("explica acciones, forma de ganar y ejemplo para cada juego", () => {
    for (const rule of ALL_GAME_RULES) {
      expect(rule.tagline.length).toBeGreaterThan(0);
      expect(rule.instructions.length).toBeGreaterThanOrEqual(4);
      expect(rule.winCondition.length).toBeGreaterThan(20);
      expect(rule.example.length).toBeGreaterThan(20);
    }
  });

  it("muestra únicamente las reglas habilitadas por el catálogo", () => {
    const catalog = buildGamingCatalog(
      "REFUND",
      new Date("2026-08-26T10:00:00.000Z"),
      ["sapyaite"],
    );

    const enabled = selectEnabledGameRules(catalog);

    expect(enabled.traditional.map((rule) => rule.id)).toEqual([
      "head",
      "prizes",
      "invert",
      "redoblona",
    ]);
    expect(enabled.instant.map((rule) => rule.id)).toEqual(["sapyaite"]);
  });

  it("calcula el ejemplo de premio instantáneo desde el catálogo habilitado", () => {
    const catalog = buildGamingCatalog(
      "REFUND",
      new Date("2026-08-26T10:00:00.000Z"),
      ["sapyaite"],
    );

    const enabled = selectEnabledGameRules(catalog);
    const payout = enabled.instant[0]?.payout;

    expect(payout).toMatchObject({
      headline: "Premio total actual: 700× el importe",
      source: "catalog-preview",
    });
    expect(payout?.detail).toContain("Gs. 500");
    expect(payout?.detail).toContain("Gs. 350.000");
    expect(payout?.detail).toContain("ganancia neta es Gs. 349.500");
  });

  it("no inventa un multiplicador para las quinielas tradicionales", () => {
    const catalog = buildGamingCatalog(
      "REFUND",
      new Date("2026-08-26T10:00:00.000Z"),
      ["sapyaite"],
    );

    const enabled = selectEnabledGameRules(catalog);

    for (const rule of enabled.traditional) {
      expect(rule.payout).toMatchObject({
        headline: "Premio según tabla oficial vigente",
        source: "official",
      });
      expect(rule.payout.note).toContain("todavía no publica");
    }
  });
});
