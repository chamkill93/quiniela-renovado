import { describe, expect, it } from "vitest";

import {
  ALL_GAME_RULES,
  INSTANT_RULES,
  TRADITIONAL_RULES,
} from "@/features/product/rules-page-data";

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
});
