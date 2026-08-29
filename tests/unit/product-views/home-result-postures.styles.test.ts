import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postcss, { type AtRule, type Root, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const stylesheetPath = fileURLToPath(new URL(
  "../../../src/features/product/home-sections.module.css",
  import.meta.url,
));
const stylesheetText = readFileSync(stylesheetPath, "utf8");
const stylesheet = postcss.parse(stylesheetText, { from: stylesheetPath });
type MotionPreference = "no-preference" | "reduce";
type Theme = "dark" | "light";

function applies(rule: Rule, width: number, motion: MotionPreference) {
  let parent: Rule["parent"] | Root["parent"] = rule.parent;
  while (parent) {
    if (parent.type === "atrule" && (parent as AtRule).name === "media") {
      const media = parent as AtRule;
      for (const match of media.params.matchAll(/\(\s*(max|min)-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)/g)) {
        const limit = Number(match[2]);
        if (match[1] === "max" ? width > limit : width < limit) return false;
      }
      const motionMatch = media.params.match(/\(\s*prefers-reduced-motion\s*:\s*(reduce|no-preference)\s*\)/);
      if (motionMatch && motionMatch[1] !== motion) return false;
    }
    parent = parent.parent;
  }
  return true;
}

function declaration(
  tree: Root,
  className: string,
  property: string,
  width: number,
  motion: MotionPreference = "no-preference",
  selectorFragment?: string,
  theme: Theme = "dark",
) {
  const subject = new RegExp("\\." + className + "(?:\\[[^\\]]*\\])*$");
  let selected: { value: string; important: boolean } | undefined;
  tree.walkRules((rule) => {
    if (!applies(rule, width, motion)) return;
    const selectorTheme = rule.selector.match(/data-theme\s*=\s*["'](dark|light)["']/)?.[1];
    if (selectorTheme && selectorTheme !== theme) return;
    if (!rule.selector.split(",").some((selector) => subject.test(selector.trim()))) return;
    if (selectorFragment && !rule.selector.includes(selectorFragment)) return;
    for (const node of rule.nodes ?? []) {
      if (node.type !== "decl" || node.prop !== property) continue;
      if (selected?.important && !node.important) continue;
      selected = { value: node.value, important: Boolean(node.important) };
    }
  });
  return selected?.value;
}

function keyframeDeclaration(frame: string, property: string) {
  let keyframes: AtRule | undefined;
  stylesheet.walkAtRules("keyframes", (rule) => {
    if (rule.params === "resultBallGather") keyframes = rule;
  });
  let value: string | undefined;
  keyframes?.walkRules((rule) => {
    if (rule.selector !== frame) return;
    for (const node of rule.nodes ?? []) {
      if (node.type === "decl" && node.prop === property) value = node.value;
    }
  });
  return value;
}

function compact(value: string | undefined) {
  return value?.replace(/\s/g, "");
}

function overflowX(width: number) {
  return declaration(stylesheet, "resultBalls", "overflow-x", width)
    ?? declaration(stylesheet, "resultBalls", "overflow", width)?.split(/\s+/)[0];
}

describe("Home latest-result balls stylesheet", () => {
  it("keeps result items and loading placeholders circular", () => {
    for (const className of ["resultBall", "resultBallSkeleton"]) {
      expect(declaration(stylesheet, className, "width", 1440)).toBe("100%");
      expect(declaration(stylesheet, className, "aspect-ratio", 1440)).toBe("1");
      expect(declaration(stylesheet, className, "border-radius", 1440)).toBe("50%");
      expect(declaration(stylesheet, className, "max-width", 1440)).toBe("78px");
    }
    expect(declaration(stylesheet, "resultBall", "display", 1440)).toBe("grid");
    expect(declaration(stylesheet, "resultBall", "place-items", 1440)).toBe("center");
  });

  it("lays out all 14 balls in one left-to-right row on wide screens", () => {
    expect(compact(declaration(stylesheet, "resultBalls", "grid-template-columns", 1440)))
      .toBe("repeat(14,minmax(0,1fr))");
    expect(declaration(stylesheet, "resultBalls", "direction", 1440)).toBe("ltr");
    expect(overflowX(1440)).toBe("hidden");
  });

  it.each([
    [1279, 7],
    [768, 7],
    [767, 5],
    [430, 5],
    [412, 5],
    [384, 5],
    [360, 5],
    [359, 4],
    [320, 4],
    [280, 4],
  ] as const)("uses the responsive cluster at %ipx with %i columns and no horizontal scroller", (width, columns) => {
    expect(compact(declaration(stylesheet, "resultBalls", "grid-template-columns", width)))
      .toBe("repeat(" + columns + ",minmax(0,1fr))");
    expect(declaration(stylesheet, "resultBalls", "direction", width)).toBe("ltr");
    expect(overflowX(width)).toBe("hidden");
    expect(declaration(stylesheet, "resultBalls", "grid-auto-flow", width)).not.toBe("column");
    if (width <= 767) {
      expect(declaration(stylesheet, "resultBallPosture", "white-space", width)).toBe("nowrap");
      expect(declaration(stylesheet, "resultBallPosture", "text-overflow", width)).toBe("ellipsis");
    }
  });

  it("uses the inverse entry index as a positive stagger without reversing layout", () => {
    const animation = declaration(stylesheet, "resultBall", "animation", 1440);
    expect(animation).toMatch(/^resultBallGather\s+440ms\b/);
    expect(animation).toContain("both");
    expect(compact(declaration(stylesheet, "resultBall", "animation-delay", 1440)))
      .toBe("calc(var(--result-entry-index)*45ms)");
    expect(declaration(stylesheet, "resultBall", "opacity", 1440)).toBe("0");
    expect(declaration(stylesheet, "resultBalls", "direction", 1440)).toBe("ltr");
    expect(declaration(stylesheet, "resultBall", "order", 1440)).toBeUndefined();

    expect(keyframeDeclaration("0%", "opacity")).toBe("0");
    expect(keyframeDeclaration("100%", "opacity")).toBe("1");
    expect(keyframeDeclaration("100%", "transform")).toBe("none");
  });

  it("shows the final state immediately when reduced motion is requested", () => {
    for (const width of [320, 1024, 1440]) {
      expect(declaration(stylesheet, "resultBall", "animation", width, "reduce")).toBe("none");
      expect(declaration(stylesheet, "resultBall", "opacity", width, "reduce")).toBe("1");
      expect(declaration(stylesheet, "resultBall", "transform", width, "reduce")).toBe("none");
      expect(declaration(stylesheet, "resultBallSkeleton", "animation", width, "reduce")).toBe("none");
    }
  });

  it("retains distinct podium accents and a visible decorative rank icon", () => {
    const palettes = {
      dark: ["#e8b742", "#aebdce", "#cc814c"],
      light: ["#b98410", "#71839b", "#a15e36"],
    } as const;
    for (const theme of ["dark", "light"] as const) {
      const accents = [1, 2, 3].map((position) => declaration(
        stylesheet,
        "resultBall",
        "--result-accent",
        390,
        "no-preference",
        '[data-position="' + position + '"]',
        theme,
      ));
      expect(accents).toEqual(palettes[theme]);
      expect(new Set(accents).size).toBe(3);
    }
    expect(declaration(
      stylesheet,
      "resultRankIcon",
      "position",
      390,
      "no-preference",
      ".resultBall .resultRankIcon",
    )).toBe("absolute");
    expect(declaration(
      stylesheet,
      "resultRankIcon",
      "color",
      390,
      "no-preference",
      ".resultBall .resultRankIcon",
    )).toBe("var(--result-rank-ink)");
  });
});
