import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postcss, { type AtRule, type Root, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

type Viewport = Readonly<{
  height: number;
  width: number;
}>;

const stylesheetPath = fileURLToPath(new URL("../../../src/app/globals.css", import.meta.url));
const stylesheet = postcss.parse(readFileSync(stylesheetPath, "utf8"), { from: stylesheetPath });

const portraitViewports = [
  { width: 280, height: 653 },
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 384, height: 854 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
] as const satisfies readonly Viewport[];

const shortLandscapes = [
  { width: 430, height: 280 },
  { width: 568, height: 280 },
  { width: 844, height: 390 },
] as const satisfies readonly Viewport[];

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

function declaration(
  selector: string,
  property: string,
  viewport: Viewport,
) {
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

function compact(value: string | undefined) {
  return value?.replace(/\s/g, "");
}

function expectFloatingCapsule(
  viewport: Viewport,
  expectedWidth = "min(100%, 32rem)",
) {
  expect(declaration(".mobileNav", "display", viewport)).toBe("block");
  expect(declaration(".mobileNav", "position", viewport)).toBe("fixed");
  expect(declaration(".mobileNav", "z-index", viewport)).toBe("var(--q-z-bottom-nav)");
  expect(declaration(".mobileNav", "min-height", viewport)).toBe("0");
  expect(declaration(".mobileNav", "background", viewport)).toBe("transparent");
  expect(declaration(".mobileNav", "box-shadow", viewport)).toBe("none");
  expect(declaration(".mobileNav", "pointer-events", viewport)).toBe("none");

  expect(declaration(".mobileNavInner", "display", viewport)).toBe("grid");
  expect(declaration(".mobileNavInner", "width", viewport)).toBe(expectedWidth);
  expect(declaration(".mobileNavInner", "min-width", viewport)).toBe("0");
  expect(declaration(".mobileNavInner", "overflow", viewport)).toBe("visible");
  expect(declaration(".mobileNavInner", "margin-inline", viewport)).toBe("auto");
  expect(declaration(".mobileNavInner", "border", viewport)).toBe("1px solid rgb(91 103 120 / 72%)");
  expect(declaration(".mobileNavInner", "border-radius", viewport)).toBe("999px");
  expect(declaration(".mobileNavInner", "background", viewport)).toContain("linear-gradient");
  expect(declaration(".mobileNavInner", "background", viewport)).not.toBe("transparent");
  expect(declaration(".mobileNavInner", "box-shadow", viewport)).toContain("0 12px 34px");
  expect(declaration(".mobileNavInner", "box-shadow", viewport)).not.toBe("none");
  expect(declaration(".mobileNavInner", "pointer-events", viewport)).toBe("auto");
  expect(declaration(".mobileNavInner", "backdrop-filter", viewport)).toBe("blur(22px) saturate(1.12)");
}

function expectSafeAreaInsets(
  viewport: Viewport,
  horizontalInset: string,
  bottomInset: string,
) {
  expect(compact(declaration(".mobileNav", "left", viewport)))
    .toBe(`calc(${horizontalInset}+env(safe-area-inset-left))`);
  expect(compact(declaration(".mobileNav", "right", viewport)))
    .toBe(`calc(${horizontalInset}+env(safe-area-inset-right))`);
  expect(compact(declaration(".mobileNav", "bottom", viewport)))
    .toBe(`calc(${bottomInset}+env(safe-area-inset-bottom))`);
}

function expectFiveDestinations(viewport: Viewport, centerMinimum: string) {
  expect(compact(declaration(".mobileNavInner", "grid-template-columns", viewport))).toBe(
    `repeat(2,minmax(0,1fr))minmax(${centerMinimum},1fr)repeat(2,minmax(0,1fr))`,
  );
  for (const selector of [".mobileNavLink", ".mobileNavAction"]) {
    expect(Number.parseFloat(declaration(selector, "min-height", viewport)!)).toBeGreaterThanOrEqual(44);
    expect(declaration(selector, "min-width", viewport)).toBe("0");
    expect(declaration(selector, "border-radius", viewport)).toBe("999px");
  }
  expect(declaration(".mobileNavLabel", "overflow", viewport)).toBe("hidden");
  expect(declaration(".mobileNavLabel", "min-height", viewport)).toBe("1.2em");
  expect(declaration(".mobileNavLabel", "line-height", viewport)).toBe("1.2");
  expect(declaration(".mobileNavLabel", "white-space", viewport)).toBe("nowrap");
}

function expectFourDecorativeSeparators(viewport: Viewport, top: string, height: string) {
  for (const selector of [
    ".mobileNavLink:not(:last-child)::after",
    ".mobileNavAction::after",
  ]) {
    expect(declaration(selector, "content", viewport)).toBe('""');
    expect(declaration(selector, "position", viewport)).toBe("absolute");
    expect(declaration(selector, "width", viewport)).toBe("1px");
    expect(declaration(selector, "height", viewport)).toBe(height);
    expect(declaration(selector, "top", viewport)).toBe(top);
    expect(declaration(selector, "right", viewport)).toBe("0");
    expect(declaration(selector, "background", viewport)).toContain("linear-gradient");
    expect(declaration(selector, "pointer-events", viewport)).toBe("none");
  }
}

describe("mobile navigation floating-pill stylesheet", () => {
  it.each(portraitViewports)("floats a safe-area capsule at $width px", (viewport) => {
    expectFloatingCapsule(viewport);

    const under320 = viewport.width < 320;
    const under391 = viewport.width <= 390;
    expectSafeAreaInsets(
      viewport,
      under320 ? ".25rem" : under391 ? ".375rem" : ".5rem",
      under320 ? ".3rem" : under391 ? ".375rem" : ".45rem",
    );
    expect(declaration(":root", "--q-bottom-nav-height", viewport)).toBe(
      under320 ? "4.95rem" : "clamp(5.2rem, 21.5vw, 5.75rem)",
    );
    expect(declaration(".mobileNavInner", "height", viewport)).toBe(
      under320 ? "4.1rem" : "clamp(4.2rem, 19vw, 4.75rem)",
    );
    expectFiveDestinations(viewport, under320 ? "3.15rem" : "3.4rem");
    expectFourDecorativeSeparators(
      viewport,
      under320 ? "1.08rem" : "1.28rem",
      under320 ? "1.55rem" : "1.7rem",
    );
  });

  it.each(shortLandscapes)("uses the compact low-landscape cascade at $width x $height", (viewport) => {
    expectFloatingCapsule(viewport, "min(100%, 48rem)");
    expectSafeAreaInsets(viewport, ".5rem", ".3rem");
    expect(declaration(":root", "--q-bottom-nav-height", viewport)).toBe("4.75rem");
    expect(declaration(".mobileNavInner", "height", viewport)).toBe("3.95rem");
    expectFiveDestinations(viewport, "3.4rem");
    expect(declaration(".mobileNavLink", "font-size", viewport)).toBe(".55rem");
    expect(declaration(".mobileNavIcon", "width", viewport)).toBe("1.2rem");
    expectFourDecorativeSeparators(viewport, "1.05rem", "1.5rem");
    expect(declaration(".mobileNavActionDisc", "top", viewport)).toBe("-.72rem");
    expect(declaration(".mobileNavActionDisc", "width", viewport)).toBe("3.2rem");
    expect(declaration(".mobileNavActionDisc", "height", viewport)).toBe("3.2rem");
  });

  it.each([...portraitViewports, ...shortLandscapes])("uses red for the active destination at $width x $height", (viewport) => {
    expect(declaration(".mobileNavLink", "color", viewport)).toBe("#cbd2dc");
    expect(declaration('.mobileNavLink[aria-current="page"]', "color", viewport)).toBe("#ff4656");
    expect(declaration('.mobileNavLink[aria-current="page"]::before', "opacity", viewport)).toBe("1");
    expect(declaration(".mobileNavLink::before", "background", viewport)).toContain("#ff0b26");
  });

  it.each([...portraitViewports, ...shortLandscapes])("keeps the elevated Jugar disc circular, ringed and focusable at $width x $height", (viewport) => {
    const isShortLandscape = viewport.width > viewport.height;
    const expectedSize = isShortLandscape
      ? "3.2rem"
      : viewport.width < 320
        ? "3.125rem"
        : "clamp(3.375rem, 15.5vw, 3.625rem)";
    expect(declaration(".mobileNavAction", "z-index", viewport)).toBe("2");
    expect(declaration(".mobileNavActionDisc", "position", viewport)).toBe("absolute");
    expect(declaration(".mobileNavActionDisc", "width", viewport)).toBe(expectedSize);
    expect(declaration(".mobileNavActionDisc", "height", viewport)).toBe(expectedSize);
    expect(Number.parseFloat(declaration(".mobileNavActionDisc", "top", viewport)!))
      .toBeLessThanOrEqual(-0.7);
    expect(declaration(".mobileNavActionDisc", "border", viewport)).toBe("2px solid rgb(255 225 229 / 88%)");
    expect(declaration(".mobileNavActionDisc", "border-radius", viewport)).toBe("var(--q-circle)");
    expect(declaration(".mobileNavActionDisc", "box-shadow", viewport)).toContain("0 0 24px");

    expect(declaration(".mobileNavActionDisc::before", "content", viewport)).toBe('""');
    expect(declaration(".mobileNavActionDisc::before", "inset", viewport)).toBe(".3rem");
    expect(declaration(".mobileNavActionDisc::before", "border-radius", viewport)).toBe("inherit");
    expect(declaration(".mobileNavActionDisc::after", "content", viewport)).toBe('""');
    expect(declaration(".mobileNavActionDisc::after", "inset", viewport)).toBe("-.27rem");
    expect(declaration(".mobileNavActionDisc::after", "border-radius", viewport)).toBe("inherit");
    expect(declaration(".mobileNavActionDisc::after", "box-shadow", viewport)).toContain("0 0 13px");

    expect(declaration(".mobileNavAction:focus-visible", "outline", viewport)).toBe("0");
    expect(declaration(".mobileNavAction:focus-visible .mobileNavActionDisc", "outline", viewport))
      .toBe("2px solid #fff");
    expect(declaration(".mobileNavAction:focus-visible .mobileNavActionDisc", "outline-offset", viewport))
      .toBe("4px");
  });

  it.each([...portraitViewports, ...shortLandscapes])("reserves footer and toast space above the fixed capsule at $width x $height", (viewport) => {
    expect(compact(declaration(".q-site-footer", "padding-bottom", viewport))).toBe(
      "calc(var(--q-bottom-nav-height)+env(safe-area-inset-bottom)+1rem)",
    );
    expect(compact(declaration(".q-toast-region", "bottom", viewport))).toBe(
      "calc(var(--q-bottom-nav-height)+env(safe-area-inset-bottom)+.75rem)",
    );
  });

  it.each([
    { width: 980, height: 800 },
    { width: 1440, height: 900 },
  ] as const)("keeps the mobile navigation hidden at desktop width $width", (viewport) => {
    expect(declaration(".mobileNav", "display", viewport)).toBe("none");
    expect(declaration(".mobileNavInner", "border", viewport)).toBeUndefined();
  });
});
