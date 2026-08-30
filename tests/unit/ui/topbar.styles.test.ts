import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postcss, { type AtRule, type Root, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

type Viewport = Readonly<{ height: number; width: number }>;

const stylesheetPath = fileURLToPath(new URL("../../../src/app/globals.css", import.meta.url));
const stylesheet = postcss.parse(readFileSync(stylesheetPath, "utf8"), {
  from: stylesheetPath,
});

function mediaQueryMatches(query: string, viewport: Viewport) {
  for (const match of query.matchAll(/\(\s*(max|min)-(width|height)\s*:\s*(\d+(?:\.\d+)?)px\s*\)/g)) {
    const dimension = match[2] === "width" ? viewport.width : viewport.height;
    const limit = Number(match[3]);
    if (match[1] === "max" ? dimension > limit : dimension < limit) return false;
  }

  const orientation = viewport.width > viewport.height ? "landscape" : "portrait";
  const orientationMatch = query.match(/\(\s*orientation\s*:\s*(landscape|portrait)\s*\)/);
  if (orientationMatch && orientationMatch[1] !== orientation) return false;
  if (/\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/.test(query)) return false;
  if (/\(\s*(?:hover\s*:\s*hover|pointer\s*:\s*fine)\s*\)/.test(query)) return false;
  return true;
}

function applies(rule: Rule, viewport: Viewport) {
  let parent: Rule["parent"] | Root["parent"] = rule.parent;
  while (parent) {
    if (parent.type === "atrule" && (parent as AtRule).name === "media") {
      const alternatives = (parent as AtRule).params.split(",");
      if (!alternatives.some((query) => mediaQueryMatches(query, viewport))) return false;
    }
    parent = parent.parent;
  }
  return true;
}

function declaration(selector: string, property: string, viewport: Viewport) {
  let selected: { important: boolean; value: string } | undefined;
  stylesheet.walkRules((rule) => {
    if (!applies(rule, viewport)) return;
    if (!rule.selector.split(",").some((candidate) => candidate.trim() === selector)) return;
    for (const node of rule.nodes ?? []) {
      if (node.type !== "decl" || node.prop !== property) continue;
      if (selected?.important && !node.important) continue;
      selected = { important: Boolean(node.important), value: node.value };
    }
  });
  return selected?.value;
}

describe("topbar stylesheet contract", () => {
  it.each([
    { width: 980, height: 800 },
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
  ] as const)("keeps LIVE inline with the title at desktop width $width", (viewport) => {
    expect(declaration(".q-topbar__title-row", "display", viewport)).toBe("flex");
    expect(declaration(".q-topbar__title-row", "align-items", viewport)).toBe("center");
    expect(declaration(".q-topbar__title-row", "min-width", viewport)).toBe("0");
    expect(declaration(".q-topbar__status", "flex", viewport)).toBe("0 0 auto");
    expect(declaration(".q-topbar__context", "display", viewport)).toBeUndefined();
    expect(declaration(".q-topbar__title", "display", viewport)).toBeUndefined();
  });

  it("visually distinguishes the amount-only balance and support affordances", () => {
    const viewport = { width: 1366, height: 768 };
    expect(declaration(".q-balance", "display", viewport)).toBe("inline-flex");
    expect(declaration(".q-balance", "border", viewport)).toContain("var(--q-red)");
    expect(declaration(".q-balance", "background", viewport)).toContain("radial-gradient");
    expect(declaration(".q-balance", "box-shadow", viewport)).toContain("rgb(227 6 19 / 7%)");
    expect(declaration(".q-balance__icon", "display", viewport)).toBe("grid");
    expect(declaration(".q-balance__icon", "color", viewport)).toBe("var(--q-red-soft)");
    expect(declaration(".q-balance__value", "font-variant-numeric", viewport)).toBe("tabular-nums");
    expect(Number(declaration(".q-balance__value", "font-weight", viewport))).toBeGreaterThanOrEqual(900);
    expect(declaration(".q-support-button", "border-color", viewport)).toContain("var(--q-red)");
    expect(declaration(".q-support-button", "color", viewport)).toBe("var(--q-red-soft)");
  });

  it.each([
    { width: 280, height: 653, balanceMin: "5.4rem", balanceMax: "8.5rem", toolSize: "2rem" },
    { width: 320, height: 568, balanceMin: "5.4rem", balanceMax: "8.5rem", toolSize: "2.15rem" },
    { width: 390, height: 844, balanceMin: "5.4rem", balanceMax: "8.5rem", toolSize: "2.15rem" },
    { width: 430, height: 932, balanceMin: "5.4rem", balanceMax: "8.5rem", toolSize: "2.15rem" },
    { width: 479, height: 932, balanceMin: "5.4rem", balanceMax: "8.5rem", toolSize: "2.15rem" },
    { width: 480, height: 932, balanceMin: "5.4rem", balanceMax: "8.5rem", toolSize: "2.15rem" },
    { width: 639, height: 932, balanceMin: "5.4rem", balanceMax: "8.5rem", toolSize: "2.15rem" },
    { width: 768, height: 1024, balanceMin: "6.9rem", balanceMax: undefined, toolSize: "2.75rem" },
    { width: 979, height: 1024, balanceMin: "6.9rem", balanceMax: undefined, toolSize: "2.75rem" },
  ] as const)("preserves the compact mobile topbar controls at $width px", ({
    width,
    height,
    balanceMin,
    balanceMax,
    toolSize,
  }) => {
    const viewport = { width, height };
    expect(declaration(".q-topbar__heading", "flex-direction", viewport)).toBe("row");
    expect(declaration(".q-topbar__heading", "align-items", viewport)).toBe("center");
    expect(declaration(".q-topbar__context", "display", viewport)).toBe("contents");
    expect(declaration(".q-topbar__title-row", "display", viewport)).toBe("contents");
    expect(declaration(".q-topbar__eyebrow", "display", viewport)).toBe("none");
    expect(declaration(".q-topbar__title", "display", viewport)).toBe("none");
    expect(declaration(".q-balance", "min-width", viewport)).toBe(balanceMin);
    expect(declaration(".q-balance", "max-width", viewport)).toBe(balanceMax);
    expect(declaration(".q-icon-button", "width", viewport)).toBe(toolSize);
    expect(declaration(".q-icon-button", "height", viewport)).toBe(toolSize);
  });

  it.each([
    { width: 280, height: 653 },
    { width: 320, height: 568 },
    { width: 359, height: 800 },
  ] as const)("keeps the balance beside the identity in the narrow two-row header at $width px", (viewport) => {
    expect(declaration(".q-topbar", "display", viewport)).toBe("grid");
    expect(declaration(".q-topbar", "grid-template-columns", viewport))
      .toBe("minmax(0, 1fr) max-content");
    expect(declaration(".q-topbar", "grid-template-rows", viewport)).toBe("auto auto");
    expect(declaration(".q-topbar__heading", "width", viewport)).toBe("100%");
    expect(declaration(".q-topbar__heading", "grid-column", viewport)).toBe("1");
    expect(declaration(".q-topbar__heading", "grid-row", viewport)).toBe("1 / 3");
    expect(declaration(".q-topbar__actions", "display", viewport)).toBe("contents");
    expect(declaration(".q-balance", "grid-column", viewport)).toBe("2");
    expect(declaration(".q-balance", "grid-row", viewport)).toBe("1");
    expect(declaration(".q-balance", "justify-self", viewport)).toBe("end");
    expect(declaration(".q-balance__value", "overflow", viewport)).toBe("hidden");
    expect(declaration(".q-balance__value", "text-overflow", viewport)).toBe("ellipsis");
    expect(declaration(".q-topbar__utilities", "grid-column", viewport)).toBe("2");
    expect(declaration(".q-topbar__utilities", "grid-row", viewport)).toBe("2");
    expect(declaration(".q-topbar__utilities", "justify-self", viewport)).toBe("end");
  });

  it.each([
    { width: 280, height: 653 },
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 480, height: 932 },
    { width: 639, height: 932 },
  ] as const)("keeps long mobile balances from compressing the brand at $width px", (viewport) => {
    expect(declaration(".q-topbar__heading", "flex", viewport)).toBe("0 0 auto");
    expect(declaration(".q-topbar__mobile-brand", "flex", viewport)).toBe("0 0 auto");
    expect(declaration(".q-topbar__actions", "flex", viewport)).toBe("1 1 auto");
    expect(declaration(".q-balance", "min-width", viewport)).toBe("5.4rem");
    expect(declaration(".q-balance", "max-width", viewport)).toBe("8.5rem");
    expect(declaration(".q-balance__value", "overflow", viewport)).toBe("hidden");
    expect(declaration(".q-balance__value", "text-overflow", viewport)).toBe("ellipsis");
  });

  it.each([
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 480, height: 932 },
    { width: 639, height: 932 },
    { width: 640, height: 932 },
    { width: 768, height: 1024 },
    { width: 979, height: 1024 },
  ] as const)("keeps the single-row mobile header when $width px has enough room", (viewport) => {
    expect(declaration(".q-topbar", "display", viewport)).toBe("flex");
    expect(declaration(".q-topbar__heading", "flex-direction", viewport)).toBe("row");
    expect(declaration(".q-topbar__actions", "display", viewport)).toBe("flex");
    expect(declaration(".q-topbar__utilities", "display", viewport)).toBe("flex");
    expect(declaration(".q-balance", "grid-column", viewport)).toBeUndefined();
  });
});
