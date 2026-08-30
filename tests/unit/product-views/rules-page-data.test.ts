import { describe, expect, it } from "vitest";

import {
  ALL_GAME_RULES,
  INSTANT_RULES,
  MEGA_LOTO_RULE,
  selectEnabledGameRules,
  TRADITIONAL_RULES,
  type RuleGameCard,
} from "@/features/product/rules-page-data";
import { MEGA_LOTO_URL } from "@/features/product/product-links";
import { buildGamingCatalog } from "@/lib/gaming/catalog";

const currentCatalog = () => buildGamingCatalog(
  "REFUND", new Date("2026-08-26T10:00:00.000Z"), ["sapyaite"],
);

function publicText(rule: RuleGameCard) {
  return [
    rule.title, rule.copy,
    ...rule.facts.flatMap((fact) => [fact.label, fact.value]),
    ...rule.instructions, ...rule.conditions, rule.example,
  ].join(" ");
}

describe("rules page data", () => {
  it("defines four traditional games, only Sapy’aite as instant, and one external Mega Loto", () => {
    expect(TRADITIONAL_RULES.map((rule) => rule.id)).toEqual(["head", "prizes", "invert", "redoblona"]);
    expect(INSTANT_RULES.map((rule) => rule.id)).toEqual(["sapyaite"]);
    expect(MEGA_LOTO_RULE.id).toBe("megaloto");
    expect(ALL_GAME_RULES).toEqual([...TRADITIONAL_RULES, ...INSTANT_RULES, MEGA_LOTO_RULE]);
    expect(ALL_GAME_RULES).toHaveLength(6);
    expect(new Set(ALL_GAME_RULES.map((rule) => rule.id)).size).toBe(6);
    expect(TRADITIONAL_RULES.every((rule) => rule.family === "traditional")).toBe(true);
    expect(INSTANT_RULES[0].family).toBe("instant");
    expect(MEGA_LOTO_RULE.family).toBe("external");
  });

  it("preserves canonical local game routes and directs Mega Loto to its official external site", () => {
    expect(TRADITIONAL_RULES.map((rule) => rule.href)).toEqual([
      "/quinielas/head", "/quinielas/prizes", "/quinielas/invert", "/quinielas/redoblona",
    ]);
    expect(INSTANT_RULES[0].href).toBe("/quinielas/sapyaite");
    expect(MEGA_LOTO_RULE.href).toBe(MEGA_LOTO_URL);
    expect(ALL_GAME_RULES.some((rule) => String(rule.href) === "/quinielas/megaloto")).toBe(false);
  });

  it("provides two useful facts, at least four steps, three conditions and an example for every game", () => {
    for (const rule of ALL_GAME_RULES) {
      expect(rule.copy.trim().length).toBeGreaterThan(10);
      expect(rule.facts).toHaveLength(2);
      for (const fact of rule.facts) {
        expect(fact.label.trim().length).toBeGreaterThan(0);
        expect(fact.value.trim().length).toBeGreaterThan(0);
      }
      expect(rule.instructions.length).toBeGreaterThanOrEqual(4);
      expect(rule.conditions.length).toBeGreaterThanOrEqual(3);
      for (const detail of [...rule.instructions, ...rule.conditions]) {
        expect(detail.trim().length).toBeGreaterThan(0);
      }
      expect(rule.example.trim().length).toBeGreaterThan(10);
      expect(rule).not.toHaveProperty("payout");
      expect(rule).not.toHaveProperty("calculation");
    }
  });

  it("retains the local number ranges and each traditional game's posture limits", () => {
    for (const rule of TRADITIONAL_RULES.filter((item) => item.id !== "redoblona")) {
      expect(publicText(rule)).toMatch(/\b001\s*(?:a|al|y|hasta|–|-)\s*999\b/);
    }
    expect(publicText(TRADITIONAL_RULES.find((rule) => rule.id === "prizes")!))
      .toMatch(/\b2\s*(?:a|al|y|hasta|–|-)\s*14\b/);
    expect(publicText(TRADITIONAL_RULES.find((rule) => rule.id === "invert")!))
      .toMatch(/\b1\s*(?:a|al|y|hasta|–|-)\s*14\b/);
  });

  it("explains Sapy’aite independently with 000–999 and three exact digits in the same order", () => {
    const text = publicText(INSTANT_RULES[0]);
    expect(text).toMatch(/\b000\s*(?:a|al|y|hasta|–|-)\s*999\b/);
    expect(text).toMatch(/tres cifras|3 cifras/i);
    expect(text).toMatch(/mismo orden|orden exacto/i);
    expect(text).toMatch(/instantáne|al instante|sin esperar/i);
    expect(text).not.toMatch(/A la Cabeza|paridad|\bPAR\b|\bIMPAR\b/i);
  });

  it("requires three distinct digits and exactly six orders for Invertida", () => {
    const text = publicText(TRADITIONAL_RULES.find((rule) => rule.id === "invert")!);
    expect(text).toMatch(/tres cifras (?:diferentes|distintas)/i);
    expect(text).toMatch(/exactamente seis órdenes|seis órdenes posibles/i);
    for (const order of ["123", "132", "213", "231", "312", "321"]) {
      expect(text).toContain(order);
    }
    expect(text).toMatch(/no se admiten cifras repetidas|cifras repetidas.+fuera/i);
    expect(text).not.toMatch(/dos cifras iguales generan tres|tres cifras iguales generan uno/i);
  });

  it("describes both Redoblona selections and requires both conditions for a successful result", () => {
    const text = publicText(TRADITIONAL_RULES.find((rule) => rule.id === "redoblona")!);
    expect(text).toMatch(/dos números de dos cifras|2 cifras \+ 2 cifras/i);
    expect(text).toMatch(/inicial 1.?14/i);
    expect(text).toMatch(/redoblona 7.?14/i);
    expect(text).toMatch(/ambos|las dos|dos aciertos|dos coincidencias/i);
    expect(text).toMatch(/posición 2 a la 8/i);
  });

  it("describes the external six-number Mega Loto rules instead of the legacy local 1–45 game", () => {
    const text = publicText(MEGA_LOTO_RULE);
    expect(text).toMatch(/(?:6|seis)\s+números/i);
    expect(text).toMatch(/distintos|diferentes|sin repetir|no se repiten/i);
    expect(text).toMatch(/\b1\s*(?:a|al|y|hasta|–|-)\s*40\b/);
    expect(text).not.toMatch(/\b1\s*(?:a|al|y|hasta|–|-)\s*45\b/);
    expect(MEGA_LOTO_RULE.href).toBe(MEGA_LOTO_URL);
  });

  it("filters enabled local IDs while always retaining the external rule for a known catalog", () => {
    const catalog = currentCatalog();
    const enabled = selectEnabledGameRules(catalog);
    expect(enabled.traditional).toEqual(TRADITIONAL_RULES);
    expect(enabled.instant).toEqual(INSTANT_RULES);
    expect(enabled.external).toEqual([MEGA_LOTO_RULE]);
    expect(selectEnabledGameRules({ ...catalog, traditional: [], instant: [] }))
      .toEqual({ traditional: [], instant: [], external: [MEGA_LOTO_RULE] });

    const restricted = selectEnabledGameRules({
      ...catalog,
      traditional: catalog.traditional.filter((game) => game.id === "prizes" || game.id === "redoblona"),
      instant: [],
    });
    expect(restricted.traditional.map((rule) => rule.id)).toEqual(["prizes", "redoblona"]);
    expect(restricted.instant).toEqual([]);
    expect(restricted.external).toEqual([MEGA_LOTO_RULE]);
  });

  it("ignores all other instant games and does not duplicate the legacy traditional Mega Loto or Sapy’aite", () => {
    const catalog = buildGamingCatalog("REFUND", new Date("2026-08-26T10:00:00.000Z"));
    expect(catalog.instant.length).toBeGreaterThan(1);
    const enabled = selectEnabledGameRules(catalog);
    expect(enabled.instant.map((rule) => rule.id)).toEqual(["sapyaite"]);
    expect([...enabled.traditional, ...enabled.instant, ...enabled.external]).toHaveLength(6);

    const legacyOnly = selectEnabledGameRules({
      ...catalog,
      traditional: catalog.traditional.filter((game) => game.id === "megaloto" || game.id === "sapyaite-traditional"),
      instant: catalog.instant.filter((game) => game.id !== "sapyaite"),
    });
    expect(legacyOnly).toEqual({ traditional: [], instant: [], external: [MEGA_LOTO_RULE] });
  });

  it("keeps canonical ordering without duplicate cards and leaves the supplied catalog unchanged", () => {
    const catalog = currentCatalog();
    const reordered = {
      ...catalog,
      traditional: [...catalog.traditional].reverse().concat(catalog.traditional[0]),
      instant: [...catalog.instant, ...catalog.instant],
    };
    const original = structuredClone(reordered);
    const enabled = selectEnabledGameRules(reordered);
    expect(enabled.traditional.map((rule) => rule.id)).toEqual(["head", "prizes", "invert", "redoblona"]);
    expect(enabled.instant.map((rule) => rule.id)).toEqual(["sapyaite"]);
    expect(enabled.external).toEqual([MEGA_LOTO_RULE]);
    expect(reordered).toEqual(original);
  });

  it("does not derive public rules or financial examples from amounts and payout configuration", () => {
    const catalog = currentCatalog();
    const changed = {
      ...catalog,
      amounts: [0, -500, Number.NaN, Number.POSITIVE_INFINITY, 2_000],
      instant: catalog.instant.map((game) => ({
        ...game,
        payout: { prototype: true as const, kind: "MULTIPLIER" as const, winMultiplier: 800 },
      })),
    };
    expect(selectEnabledGameRules(changed)).toEqual(selectEnabledGameRules(catalog));
  });

  it("keeps every game's instructions free of payouts, implementation notes and comparisons to other games", () => {
    for (const rule of ALL_GAME_RULES) {
      const text = publicText(rule);
      expect(text).not.toMatch(/×|multiplicador|cuánto paga|calculadora|premio total|tabla de pagos|\bGs\./i);
      expect(text).not.toMatch(/pdf|art[ií]culo|reglamento|vista previa|formulario actual|backoffice|proveedor|codexa/i);
      if (rule.id !== "head") expect(text).not.toMatch(/A la Cabeza/i);
      if (rule.id !== "sapyaite") expect(text).not.toMatch(/Sapy[’']?aite/i);
    }
    expect(JSON.stringify(ALL_GAME_RULES)).not.toMatch(/"payout"|"calculation"|sourceLabel/);
  });
});
