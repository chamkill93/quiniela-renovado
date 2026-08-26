// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroVisual } from "@/features/product/hero-visual";

type MockAnimation = Animation & {
  cancel: ReturnType<typeof vi.fn>;
};

const animationInstances: MockAnimation[] = [];
let reduceMotion = false;

const animateMock = vi.fn(function (this: Element) {
  let resolveFinished: (animation: Animation) => void = () => undefined;
  const finished = new Promise<Animation>((resolve) => {
    resolveFinished = resolve;
  });
  const animation = {
    cancel: vi.fn(),
    finished,
    __finish: () => resolveFinished(animation as unknown as Animation),
  } as unknown as MockAnimation & { __finish: () => void };

  animationInstances.push(animation);
  return animation;
});

beforeEach(() => {
  reduceMotion = false;
  animationInstances.length = 0;
  animateMock.mockClear();

  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: animateMock,
  });
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: vi.fn(() => []),
  });
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: vi.fn(() => ({
      bottom: 10,
      height: 10,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })),
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: reduceMotion,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, "animate");
  Reflect.deleteProperty(Element.prototype, "getAnimations");
  Reflect.deleteProperty(HTMLElement.prototype, "getBoundingClientRect");
});

describe("HeroVisual", () => {
  it("representa exactamente el resultado recibido en tres dígitos, sin fallback inventado", () => {
    const view = render(<HeroVisual spinKey="result-1" value="7" />);
    const visual = screen.getByRole("img", {
      name: "Último resultado publicado 007",
    });

    expect(visual.getAttribute("data-reel-result")).toBe("007");
    expect(animateMock).toHaveBeenCalledTimes(3);

    view.rerender(<HeroVisual spinKey="without-result" value={null} />);

    expect(
      screen.getByRole("img", {
        name: "Último resultado todavía no disponible",
      }).getAttribute("data-reel-result"),
    ).toBe("");
    expect(view.container.querySelectorAll("[class*='placeholder']")).toHaveLength(3);
  });

  it("usa el timing escalonado aprobado y termina cada columna en el dígito exacto", () => {
    const { container } = render(<HeroVisual spinKey="draw-497" value="497" />);
    const expectedFinalTransforms = [
      "translate3d(0, -740px, 0)",
      "translate3d(0, -790px, 0)",
      "translate3d(0, -770px, 0)",
    ];

    expect(animateMock).toHaveBeenCalledTimes(3);

    animateMock.mock.calls.forEach((call, columnIndex) => {
      const [keyframes, options] = call as unknown as [
        Keyframe[],
        KeyframeAnimationOptions,
      ];

      expect(options).toMatchObject({
        delay: columnIndex * 150,
        duration: [1_250, 1_450, 1_670][columnIndex],
        easing: "cubic-bezier(.14,.72,.16,1)",
        fill: "forwards",
      });
      expect(keyframes).toHaveLength(4);
      expect(keyframes.at(-1)).toMatchObject({
        offset: 1,
        transform: expectedFinalTransforms[columnIndex],
      });
    });

    const strips = container.querySelectorAll<HTMLElement>("[data-reel-strip]");
    expect(Array.from(strips, (strip) => strip.style.transform)).toEqual(
      expectedFinalTransforms,
    );
  });

  it("vuelve a girar cuando cambia spinKey aunque el número sea el mismo", () => {
    const view = render(<HeroVisual spinKey="publication-a" value="381" />);
    const firstSpinAnimations = [...animationInstances];

    view.rerender(<HeroVisual spinKey="publication-b" value="381" />);

    expect(animateMock).toHaveBeenCalledTimes(6);
    firstSpinAnimations.forEach((animation) => {
      expect(animation.cancel).toHaveBeenCalledTimes(1);
    });
    expect(view.container.querySelector("[data-reel-result='381']")).toBeTruthy();
  });

  it("fija el resultado sin WAAPI cuando se prefiere movimiento reducido", () => {
    reduceMotion = true;
    const { container } = render(<HeroVisual spinKey="reduced" value="204" />);

    expect(window.matchMedia).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)",
    );
    expect(animateMock).not.toHaveBeenCalled();
    expect(
      Array.from(
        container.querySelectorAll<HTMLElement>("[data-reel-strip]"),
        (strip) => strip.style.transform,
      ),
    ).toEqual([
      "translate3d(0, -720px, 0)",
      "translate3d(0, -700px, 0)",
      "translate3d(0, -740px, 0)",
    ]);
  });

  it("no incorpora estados, premios ni fichas ajenos al hero", () => {
    render(<HeroVisual loading value={null} />);

    expect(
      screen
        .getByRole("img", { name: "Cargando último resultado publicado" })
        .getAttribute("aria-busy"),
    ).toBe("true");

    const copy = document.body.textContent ?? "";
    expect(copy).not.toMatch(/en vivo/i);
    expect(copy).not.toMatch(/ganaste|premio|fichas|chips/i);
  });
});
