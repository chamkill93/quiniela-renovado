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
const carouselComponentPath = fileURLToPath(new URL(
  "../../../src/features/product/home-latest-results-carousel.tsx",
  import.meta.url,
));
const carouselComponentText = readFileSync(carouselComponentPath, "utf8");
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

function exactDeclaration(
  tree: Root,
  selector: string,
  property: string,
  width: number,
  motion: MotionPreference = "no-preference",
  theme: Theme = "dark",
) {
  let selected: { value: string; important: boolean } | undefined;
  tree.walkRules((rule) => {
    if (!applies(rule, width, motion)) return;
    const selectorTheme = rule.selector.match(/data-theme\s*=\s*["'](dark|light)["']/)?.[1];
    if (selectorTheme && selectorTheme !== theme) return;
    if (!rule.selector.split(",").some((candidate) => candidate.trim() === selector)) return;
    for (const node of rule.nodes ?? []) {
      if (node.type !== "decl" || node.prop !== property) continue;
      if (selected?.important && !node.important) continue;
      selected = { value: node.value, important: Boolean(node.important) };
    }
  });
  return selected?.value;
}

function compact(value: string | undefined) {
  return value?.replace(/\s/g, "");
}

function overflowX(width: number) {
  return declaration(stylesheet, "resultBalls", "overflow-x", width)
    ?? declaration(stylesheet, "resultBalls", "overflow", width)?.split(/\s+/)[0];
}

describe("Home latest-result balls stylesheet", () => {
  it.each([
    1920,
    1440,
    1366,
    1024,
    768,
    430,
    390,
    360,
  ] as const)("keeps one horizontally scrollable flex row at %ipx", (width) => {
    expect(exactDeclaration(stylesheet, ".resultBalls", "display", width)).toBe("flex");
    expect(exactDeclaration(stylesheet, ".resultBalls", "align-items", width)).toBe("flex-end");
    expect(exactDeclaration(stylesheet, ".resultBalls", "flex-wrap", width) ?? "nowrap").toBe("nowrap");
    expect(exactDeclaration(stylesheet, ".resultBalls", "direction", width)).toBe("ltr");
    expect(overflowX(width)).toBe("auto");
    expect(exactDeclaration(stylesheet, ".resultBalls", "overflow-y", width)).toBe("hidden");
    expect(exactDeclaration(stylesheet, ".resultBalls", "scroll-snap-type", width)).toBe("x mandatory");
    expect(exactDeclaration(stylesheet, ".resultBalls", "scrollbar-width", width)).toBe("none");
    expect(exactDeclaration(stylesheet, ".resultBalls", "-webkit-overflow-scrolling", width)).toBe("touch");
    expect(exactDeclaration(stylesheet, ".resultBall", "scroll-snap-align", width)).toBe("start");
  });

  it("hides both native scrollbar implementations", () => {
    expect(declaration(stylesheet, "resultBalls", "scrollbar-color", 1440))
      .toBe("transparent transparent");
    expect(exactDeclaration(stylesheet, ".resultBalls::-webkit-scrollbar", "display", 1440))
      .toBe("none");
    expect(exactDeclaration(stylesheet, ".resultBalls::-webkit-scrollbar", "width", 1440))
      .toBe("0");
    expect(exactDeclaration(stylesheet, ".resultBalls::-webkit-scrollbar", "height", 1440))
      .toBe("0");
  });

  it("uses stable 116px desktop slots and exposes roughly 3.35 slots on narrow mobile", () => {
    for (const width of [768, 1024, 1366, 1440, 1920]) {
      for (const className of ["resultBall", "resultBallSkeleton"]) {
        expect(declaration(stylesheet, className, "flex", width)).toBe("0 0 116px");
        expect(declaration(stylesheet, className, "width", width)).toBe("116px");
      }
    }

    for (const width of [360, 390, 430, 639]) {
      for (const className of ["resultBall", "resultBallSkeleton"]) {
        expect(compact(declaration(stylesheet, className, "flex-basis", width)))
          .toBe("calc((100%-24px)/3.35)");
        expect(compact(declaration(stylesheet, className, "width", width)))
          .toBe("calc((100%-24px)/3.35)");
      }
    }
  });

  it("makes the first premium ball slightly larger and aligns every posture by its base", () => {
    expect(exactDeclaration(stylesheet, ".resultBall", "--ball-art-width", 1440)).toBe("116px");
    expect(exactDeclaration(
      stylesheet,
      '.resultBall[data-position="1"]',
      "--ball-art-width",
      1440,
    )).toBe("132px");

    expect(exactDeclaration(
      stylesheet,
      '.resultBall[data-position="1"]',
      "--ball-art-width",
      767,
    )).toBe("120px");

    expect(compact(exactDeclaration(stylesheet, ".resultBall", "--ball-art-width", 390)))
      .toBe("clamp(76px,26.6667vw,96px)");
    expect(compact(exactDeclaration(
      stylesheet,
      '.resultBall[data-position="1"]',
      "--ball-art-width",
      390,
    ))).toBe("clamp(90px,30.5556vw,110px)");
    expect(exactDeclaration(
      stylesheet,
      '.resultBall[data-position="1"] .resultBallArt',
      "left",
      390,
    )).toBeUndefined();
    for (const width of [390, 767]) {
      expect(exactDeclaration(stylesheet, ".resultBalls", "padding", width))
        .toBe("4px 2px 2px 15px");
      expect(exactDeclaration(stylesheet, ".resultBalls", "scroll-padding-inline", width))
        .toBe("15px 2px");
    }
    expect(declaration(stylesheet, "resultBallArt", "height", 1440)).toBe("auto");
    expect(declaration(stylesheet, "resultBallArt", "aspect-ratio", 1440)).toBe("1");
    expect(exactDeclaration(stylesheet, ".resultBall", "grid-template-columns", 1440))
      .toBe("minmax(0, 1fr)");
    expect(exactDeclaration(stylesheet, ".resultBall", "--result-number-y", 1440)).toBe("49%");
    expect(exactDeclaration(
      stylesheet,
      '.resultBall[data-position="1"]',
      "--result-number-y",
      1440,
    )).toBe("59%");
    expect(exactDeclaration(
      stylesheet,
      '.resultBall[data-tone="silver"]',
      "--result-number-y",
      1440,
    )).toBeUndefined();
    expect(exactDeclaration(
      stylesheet,
      '.resultBall[data-tone="bronze"]',
      "--result-number-y",
      1440,
    )).toBeUndefined();
  });

  it("renders every result in its final state without an entrance animation", () => {
    for (const width of [360, 768, 1024, 1440, 1920]) {
      expect(exactDeclaration(stylesheet, ".resultBall", "animation", width)).toBeUndefined();
      expect(exactDeclaration(stylesheet, ".resultBall", "animation-delay", width)).toBeUndefined();
      expect(exactDeclaration(stylesheet, ".resultBall", "opacity", width)).not.toBe("0");
      expect(exactDeclaration(stylesheet, ".resultBall", "transform", width)).toBeUndefined();
    }
    expect(stylesheetText).not.toMatch(/@keyframes\s+resultBallGather\b/);
    expect(stylesheetText).not.toMatch(/\.resultBalls\[data-animate=/);
    expect(carouselComponentText).not.toMatch(/data-animate|--result-entry-index|IntersectionObserver/);
  });

  it("styles four centered pagination segments with a longer active state", () => {
    expect(carouselComponentText).toMatch(/const\s+RESULT_PAGE_COUNT\s*=\s*4\s*;/);
    expect(carouselComponentText).toMatch(/Array\.from\(\{\s*length:\s*RESULT_PAGE_COUNT\s*\}/);
    expect(declaration(stylesheet, "latestResultsPagination", "display", 390)).toBe("flex");
    expect(declaration(stylesheet, "latestResultsPagination", "justify-content", 390)).toBe("center");
    expect(declaration(stylesheet, "latestResultsPagination", "gap", 390)).toBe("8px");
    expect(exactDeclaration(stylesheet, ".latestResultsSegment", "width", 390)).toBe("24px");
    expect(exactDeclaration(stylesheet, ".latestResultsSegment", "height", 390)).toBe("8px");
    expect(exactDeclaration(
      stylesheet,
      '.latestResultsSegment[data-active="true"]',
      "width",
      390,
    )).toBe("42px");
    expect(exactDeclaration(
      stylesheet,
      '.latestResultsSegment[data-active="true"]',
      "opacity",
      390,
    )).toBe("1");
  });

  it("highlights only the first posture label and keeps positions 2 through 14 neutral", () => {
    expect(declaration(stylesheet, "resultBallPosture", "color", 390)).toBe("currentColor");
    expect(declaration(stylesheet, "resultBallPosture", "white-space", 390)).toBe("nowrap");
    expect(declaration(stylesheet, "resultBallPosture", "text-overflow", 390)).toBe("ellipsis");
    expect(stylesheetText).not.toMatch(/\.resultBallRank\b/);

    const palettes = {
      dark: ["#efbd3d", "var(--q-muted-strong)"],
      light: ["#a36d00", "color-mix(in srgb, var(--q-muted-strong) 90%, #313842)"],
    } as const;
    for (const theme of ["dark", "light"] as const) {
      const baseSelector = theme === "dark"
        ? ".resultBall"
        : ':global([data-theme="light"]) .resultBall';
      const firstSelector = theme === "dark"
        ? '.resultBall[data-position="1"]'
        : ':global([data-theme="light"]) .resultBall[data-position="1"]';
      expect([
        exactDeclaration(stylesheet, firstSelector, "color", 390, "no-preference", theme),
        exactDeclaration(stylesheet, baseSelector, "color", 390, "no-preference", theme),
      ]).toEqual(palettes[theme]);
      for (const position of [2, 3]) {
        const selector = theme === "dark"
          ? `.resultBall[data-position="${position}"]`
          : `:global([data-theme="light"]) .resultBall[data-position="${position}"]`;
        expect(exactDeclaration(stylesheet, selector, "color", 390, "no-preference", theme))
          .toBeUndefined();
      }
    }
  });

  it("uses a theme-aware, non-interactive right fade only while more results remain", () => {
    expect(exactDeclaration(stylesheet, ".latestResultsCarousel::after", "content", 390)).toBe('""');
    expect(exactDeclaration(stylesheet, ".latestResultsCarousel::after", "pointer-events", 390))
      .toBe("none");
    expect(exactDeclaration(stylesheet, ".latestResultsCarousel::after", "opacity", 390)).toBe("0");
    expect(exactDeclaration(
      stylesheet,
      '.latestResultsCarousel[data-has-next="true"]::after',
      "opacity",
      390,
    )).toBe("0.78");
    expect(exactDeclaration(stylesheet, ".latestResultsCarousel::after", "background", 390))
      .toBe("linear-gradient(90deg, transparent, color-mix(in srgb, var(--q-panel) 94%, transparent))");
    expect(exactDeclaration(
      stylesheet,
      ':global([data-theme="light"]) .latestResultsCarousel::after',
      "background",
      390,
      "no-preference",
      "light",
    )).toBe("linear-gradient(90deg, transparent, color-mix(in srgb, #fff 82%, var(--q-panel)))");
  });

  it("removes optional carousel and loading motion when reduced motion is requested", () => {
    for (const width of [360, 1024, 1440]) {
      expect(declaration(stylesheet, "resultBallSkeleton", "animation", width, "reduce")).toBe("none");
      expect(exactDeclaration(stylesheet, ".resultBalls", "scroll-behavior", width, "reduce"))
        .toBe("auto");
      expect(exactDeclaration(stylesheet, ".resultBallArt", "transition", width, "reduce"))
        .toBeUndefined();
      expect(exactDeclaration(stylesheet, ".latestResultsArrow", "transition", width, "reduce"))
        .toBe("none");
      expect(exactDeclaration(stylesheet, ".latestResultsSegment", "transition", width, "reduce"))
        .toBe("none");
      expect(exactDeclaration(stylesheet, ".latestResultsCarousel::after", "transition", width, "reduce"))
        .toBe("none");
    }
  });
});
