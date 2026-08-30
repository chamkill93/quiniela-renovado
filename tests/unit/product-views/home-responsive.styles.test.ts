import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postcss, { type AtRule, type Root, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

type Viewport = Readonly<{
  height: number;
  width: number;
}>;

const portraitViewports = [
  { width: 280, height: 653 },
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 384, height: 720 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
] as const satisfies readonly Viewport[];

const landscapeViewports = [
  { width: 568, height: 280 },
  { width: 844, height: 390 },
] as const satisfies readonly Viewport[];

function parseStylesheet(relativePath: string) {
  const path = fileURLToPath(new URL(relativePath, import.meta.url));
  return postcss.parse(readFileSync(path, "utf8"), { from: path });
}

const heroStyles = parseStylesheet("../../../src/features/product/home-hero.module.css");
const reelStyles = parseStylesheet("../../../src/features/product/hero-visual.module.css");
const sectionStyles = parseStylesheet("../../../src/features/product/home-sections.module.css");
const productStyles = parseStylesheet("../../../src/features/product/product.module.css");
const shellStyles = parseStylesheet("../../../src/app/globals.css");

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
  tree: Root,
  selector: string,
  property: string,
  viewport: Viewport,
) {
  let selected: { important: boolean; value: string } | undefined;
  tree.walkRules((rule) => {
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

function label(viewport: Viewport) {
  return `${viewport.width}x${viewport.height}`;
}

describe("Home responsive stylesheet cascade", () => {
  it.each(portraitViewports)("compacts the Hero, reel and CTA at $width px", (viewport) => {
    expect(declaration(heroStyles, ".hero", "min-height", viewport)).toBe("0");
    expect(declaration(heroStyles, ".hero", "grid-template-columns", viewport)).toBe("1fr");
    expect(compact(declaration(heroStyles, ".hero", "grid-template-areas", viewport)))
      .toBe('"copy""reel""actions"');
    expect(declaration(heroStyles, ".hero", "border-radius", viewport)).toBe("18px");
    expect(declaration(heroStyles, ".hero", "overflow", viewport)).toBe("hidden");
    expect(declaration(heroStyles, ".copy", "min-width", viewport)).toBe("0");
    expect(declaration(heroStyles, ".title > span", "white-space", viewport)).toBe("nowrap");
    expect(declaration(heroStyles, ".reelColumn", "padding", viewport)).toBe("0 6px 4px");
    expect(declaration(heroStyles, ".actions", "display", viewport)).toBe("grid");
    expect(declaration(heroStyles, ".actions", "grid-template-columns", viewport)).toBe("1fr");
    expect(declaration(heroStyles, ".primaryAction", "width", viewport)).toBe("100%");

    const veryNarrow = viewport.width <= 300;
    const narrow = viewport.width <= 360;
    expect(declaration(heroStyles, ".copy", "padding", viewport)).toBe(
      narrow ? "13px 12px 2px" : "14px 14px 2px",
    );
    expect(declaration(heroStyles, ".copy", "padding-inline", viewport)).toBe(
      veryNarrow ? "10px" : undefined,
    );
    expect(declaration(heroStyles, ".title", "font-size", viewport)).toBe(
      veryNarrow
        ? "1.75rem"
        : narrow
          ? "clamp(1.85rem, 9.3vw, 2.05rem)"
          : "clamp(2rem, 9vw, 2.45rem)",
    );
    expect(declaration(heroStyles, ".actions", "padding", viewport)).toBe(
      narrow ? "2px 12px 12px" : "2px 14px 14px",
    );
    expect(declaration(heroStyles, ".actions", "padding-inline", viewport)).toBe(
      veryNarrow ? "10px" : undefined,
    );
    expect(declaration(heroStyles, ".primaryAction", "min-height", viewport)).toBe(
      veryNarrow ? "40px" : "42px",
    );

    expect(declaration(reelStyles, ".visual", "min-width", viewport)).toBe("0");
    expect(declaration(reelStyles, ".visual", "aspect-ratio", viewport)).toBe("2162 / 727");
    expect(declaration(reelStyles, ".visual", "width", viewport)).toBe(
      veryNarrow ? "min(86%, 248px)" : "min(88%, 360px)",
    );
    expect(declaration(reelStyles, ".row", "font-size", viewport)).toBe(
      veryNarrow
        ? "clamp(27px, 17cqw, 48px)"
        : viewport.width <= 390
          ? "clamp(31px, 17cqw, 56px)"
          : "clamp(34px, 17cqw, 62px)",
    );
  });

  it.each(portraitViewports)("keeps Home cards in two columns and Mega compact at $width px", (viewport) => {
    expect(compact(declaration(sectionStyles, ".drawGrid", "grid-template-columns", viewport)))
      .toBe("repeat(2,minmax(0,1fr))");
    expect(declaration(sectionStyles, ".panel", "padding", viewport)).toBe("11px 10px 12px");
    expect(declaration(sectionStyles, ".drawCard", "width", viewport)).toBe("100%");
    expect(declaration(sectionStyles, ".drawCard", "min-width", viewport)).toBe("0");

    const below360 = viewport.width < 360;
    expect(declaration(sectionStyles, ".drawGrid", "gap", viewport)).toBe(below360 ? "6px" : "7px");
    expect(declaration(sectionStyles, ".drawCard", "min-height", viewport)).toBe(
      below360 ? "86px" : "90px",
    );
    expect(declaration(sectionStyles, ".drawCard", "padding", viewport)).toBe(
      below360 ? "6px" : "7px",
    );

    expect(declaration(sectionStyles, ".megaBanner", "grid-template-columns", viewport)).toBe("1fr");
    expect(declaration(sectionStyles, ".megaBanner", "min-width", viewport)).toBe("0");
    expect(declaration(sectionStyles, ".megaBanner", "min-height", viewport)).toBe(
      below360 ? "212px" : "230px",
    );
    expect(declaration(sectionStyles, ".megaBanner", "padding", viewport)).toBe(
      below360 ? "10px" : "11px",
    );
    expect(declaration(sectionStyles, ".megaLogo", "width", viewport)).toBe(
      below360 ? "72px" : "84px",
    );
    expect(declaration(sectionStyles, ".megaCta", "width", viewport)).toBe("100%");
    expect(declaration(sectionStyles, ".megaCta", "min-height", viewport)).toBe(
      below360 ? "42px" : "44px",
    );
  });

  it.each(portraitViewports)("keeps the mobile topbar and shell inside the fold at $width px", (viewport) => {
    expect(declaration(productStyles, ".homePage", "min-width", viewport)).toBe("0");
    expect(declaration(productStyles, ".homePage", "padding", viewport)).toBe("16px 0");
    expect(declaration(productStyles, ".homePage", "padding-top", viewport)).toBe("12px");
    expect(declaration(shellStyles, ".q-topbar", "min-width", viewport)).toBe("0");
    expect(declaration(shellStyles, ".q-topbar", "min-height", viewport)).toBe(
      viewport.width < 320 ? "4.2rem" : "4.6rem",
    );
    expect(declaration(shellStyles, ".q-topbar__heading", "min-width", viewport)).toBe("0");
    expect(declaration(shellStyles, ".q-topbar__heading", "flex", viewport)).toBe("0 1 auto");
    expect(declaration(shellStyles, ".q-topbar__heading", "flex-direction", viewport)).toBe("row");
    expect(declaration(shellStyles, ".q-topbar__heading", "align-items", viewport)).toBe("center");
    expect(declaration(shellStyles, ".q-topbar__mobile-brand", "display", viewport)).toBe("block");
    expect(declaration(shellStyles, ".q-topbar__mobile-brand", "min-width", viewport)).toBe("0");
    expect(declaration(shellStyles, ".q-topbar__context", "display", viewport)).toBe("contents");
    expect(declaration(shellStyles, ".q-topbar__title-row", "display", viewport)).toBe("contents");
    expect(declaration(shellStyles, ".q-topbar__eyebrow", "display", viewport)).toBe("none");
    expect(declaration(shellStyles, ".q-topbar__title", "display", viewport)).toBe("none");
    expect(declaration(shellStyles, ".q-topbar__actions", "min-width", viewport)).toBe("0");
    expect(declaration(shellStyles, ".q-shell-main", "min-width", viewport)).toBe("0");
    expect(declaration(shellStyles, ".q-shell-content", "min-width", viewport)).toBe("0");
    expect(declaration(shellStyles, ".q-balance__label", "display", viewport)).toBeUndefined();
    expect(declaration(shellStyles, ".q-topbar", "display", viewport)).toBe("grid");
    expect(declaration(shellStyles, ".q-topbar__heading", "width", viewport)).toBe("100%");
    expect(declaration(shellStyles, ".q-topbar__actions", "width", viewport)).toBe("100%");
    expect(declaration(shellStyles, ".q-balance", "margin-right", viewport)).toBe("auto");

    if (viewport.width < 320) {
      expect(declaration(shellStyles, ".q-topbar", "gap", viewport)).toBe(".25rem");
      expect(declaration(shellStyles, ".q-topbar", "padding", viewport)).toBe(".55rem .5rem");
      expect(declaration(shellStyles, ".q-logo--sm .q-logo__plate", "width", viewport)).toBe("4.45rem");
      expect(declaration(shellStyles, ".q-balance", "min-width", viewport)).toBe("4.9rem");
      expect(declaration(shellStyles, ".q-balance", "max-width", viewport)).toBe("5.25rem");
      expect(declaration(shellStyles, ".q-balance__icon", "width", viewport)).toBe("1.15rem");
      expect(declaration(shellStyles, ".q-icon-button", "width", viewport)).toBe("2rem");
      expect(declaration(shellStyles, ".q-shell-content", "padding", viewport)).toBe(".75rem .65rem 0");
    } else {
      expect(declaration(shellStyles, ".q-topbar", "padding", viewport)).toBe(".65rem .8rem");
      expect(declaration(shellStyles, ".q-balance", "min-width", viewport)).toBe(
        viewport.width <= 390 ? "5.65rem" : "6.35rem",
      );
      expect(declaration(shellStyles, ".q-balance", "max-width", viewport)).toBe(
        viewport.width <= 390 ? "6.2rem" : "7rem",
      );
      expect(declaration(shellStyles, ".q-balance__icon", "width", viewport)).toBe(
        viewport.width <= 390 ? "1.4rem" : "1.65rem",
      );
      expect(declaration(shellStyles, ".q-icon-button", "width", viewport)).toBe(
        viewport.width <= 390 ? "2.2rem" : "2.45rem",
      );
      expect(declaration(shellStyles, ".q-shell-content", "padding", viewport)).toBe("1rem .85rem 0");
    }
  });

  it.each(landscapeViewports)("uses the low-landscape Hero and Home cascade at $width x $height", (viewport) => {
    expect(declaration(productStyles, ".homePage", "padding", viewport)).toBe("16px 0");
    expect(declaration(productStyles, ".homePage", "padding-top", viewport)).toBe("10px");
    expect(declaration(heroStyles, ".hero", "min-height", viewport)).toBe("188px");
    expect(compact(declaration(heroStyles, ".hero", "grid-template-columns", viewport)))
      .toBe("minmax(280px,0.82fr)minmax(0,1.4fr)");
    expect(compact(declaration(heroStyles, ".hero", "grid-template-areas", viewport)))
      .toBe('"copyreel""actionsreel"');
    expect(declaration(heroStyles, ".copy", "padding", viewport)).toBe("16px 0 4px 22px");
    expect(declaration(heroStyles, ".title", "font-size", viewport)).toBe("clamp(2.15rem, 4.8vw, 3.15rem)");
    expect(declaration(heroStyles, ".reelColumn", "padding", viewport)).toBe("4px 12px 4px 0");
    expect(declaration(heroStyles, ".actions", "padding", viewport)).toBe("3px 0 16px 22px");
    expect(declaration(reelStyles, ".visual", "width", viewport)).toBe("min(90%, 440px)");

    expect(compact(declaration(sectionStyles, ".drawGrid", "grid-template-columns", viewport)))
      .toBe("repeat(2,minmax(0,1fr))");
    expect(declaration(sectionStyles, ".sections", "gap", viewport)).toBe("8px");
    expect(declaration(sectionStyles, ".sections", "margin-top", viewport)).toBe("8px");
    expect(declaration(sectionStyles, ".panel", "padding", viewport)).toBe("11px 12px 12px");
    expect(declaration(sectionStyles, ".megaBanner", "min-height", viewport)).toBe("168px");
    expect(declaration(sectionStyles, ".megaBanner", "grid-template-columns", viewport))
      .toBe("minmax(230px, 1fr) auto");
    expect(declaration(sectionStyles, ".megaBanner", "grid-template-rows", viewport)).toBe("1fr");
    expect(declaration(sectionStyles, ".megaLogo", "width", viewport)).toBe("92px");
    expect(declaration(sectionStyles, ".megaCta", "width", viewport)).toBe("auto");
    expect(declaration(sectionStyles, ".megaCta", "min-height", viewport)).toBe("44px");

    expect(declaration(shellStyles, ".q-topbar", "min-height", viewport)).toBe("4.6rem");
    expect(declaration(shellStyles, ".q-topbar", "padding", viewport)).toBe(".65rem .8rem");
    expect(declaration(shellStyles, ".q-shell-content", "padding", viewport)).toBe("1rem .85rem 0");
  });

  it("requires both the height and landscape orientation for the low-landscape overrides", () => {
    const portrait = { width: 568, height: 700 };
    const tallLandscape = { width: 844, height: 700 };

    expect(declaration(heroStyles, ".hero", "grid-template-columns", portrait)).toBe("1fr");
    expect(declaration(sectionStyles, ".megaBanner", "min-height", portrait)).toBe("270px");
    expect(declaration(heroStyles, ".hero", "grid-template-columns", tallLandscape)).toBe("1fr");
    expect(declaration(sectionStyles, ".megaBanner", "min-height", tallLandscape)).toBe("170px");
  });

  it("covers every requested responsive viewport", () => {
    expect([...portraitViewports, ...landscapeViewports].map(label)).toEqual([
      "280x653",
      "320x568",
      "360x640",
      "384x720",
      "412x915",
      "430x932",
      "568x280",
      "844x390",
    ]);
  });
});
