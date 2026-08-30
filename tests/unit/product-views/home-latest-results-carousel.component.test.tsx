// @vitest-environment jsdom

import { act, cleanup, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeLatestResultsCarousel } from "@/features/product/home-latest-results-carousel";
import type { HomeResultPositionView } from "@/features/product/home-sections-data";

let pendingFrames: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let observers: ResizeObserverMock[];

const requestFrame = vi.fn((callback: FrameRequestCallback) => {
  const id = ++nextFrameId;
  pendingFrames.set(id, callback);
  return id;
});
const cancelFrame = vi.fn((id: number) => pendingFrames.delete(id));

class ResizeObserverMock {
  readonly targets = new Set<Element>();
  readonly observe = vi.fn((target: Element) => this.targets.add(target));
  readonly unobserve = vi.fn((target: Element) => this.targets.delete(target));
  readonly disconnect = vi.fn(() => this.targets.clear());

  constructor(readonly callback: ResizeObserverCallback) {
    observers.push(this);
  }

  notify() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

const values = [
  "85", "44", "7", "163", "300", "437", "574",
  "208", "731", "112", "830", "701", "550", "909",
] as const;

const results: readonly HomeResultPositionView[] = values.map((value, index) => ({
  position: index + 1,
  value,
  ending: value.padStart(3, "0").slice(-2),
  combinations: [],
}));

beforeEach(() => {
  vi.useFakeTimers();
  pendingFrames = new Map();
  nextFrameId = 0;
  observers = [];
  requestFrame.mockClear();
  cancelFrame.mockClear();
  vi.stubGlobal("requestAnimationFrame", requestFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: true,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function flushFrames() {
  const callbacks = [...pendingFrames.values()];
  pendingFrames.clear();
  act(() => {
    for (const callback of callbacks) callback(performance.now());
  });
}

function decodedSource(image: HTMLImageElement) {
  return decodeURIComponent(image.getAttribute("src") ?? "");
}

function activeSegmentIndex() {
  return screen.getAllByTestId("home-results-pagination-segment")
    .findIndex((segment) => segment.getAttribute("data-active") === "true");
}

function pointerEvent(
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  target: Element,
  properties: {
    pointerId: number;
    pointerType: "mouse" | "touch";
    button?: number;
    clientX: number;
  },
) {
  const event = createEvent(type, target, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { configurable: true, value: properties.pointerId },
    pointerType: { configurable: true, value: properties.pointerType },
    button: { configurable: true, value: properties.button ?? 0 },
    clientX: { configurable: true, value: properties.clientX },
  });
  return event;
}

function mountCarousel({
  clientWidth = 342,
  scrollWidth = 1_520,
}: {
  clientWidth?: number;
  scrollWidth?: number;
} = {}) {
  const view = render(<HomeLatestResultsCarousel results={results} />);
  const wrapper = screen.getByTestId("home-results-carousel");
  const track = screen.getByTestId("home-results-balls") as HTMLOListElement;
  const previous = screen.getByTestId("home-results-previous") as HTMLButtonElement;
  const next = screen.getByTestId("home-results-next") as HTMLButtonElement;
  const geometry = { clientWidth, scrollWidth, scrollLeft: 0 };
  const capturedPointers = new Set<number>();

  Object.defineProperties(track, {
    clientWidth: { configurable: true, get: () => geometry.clientWidth },
    scrollWidth: { configurable: true, get: () => geometry.scrollWidth },
    scrollLeft: {
      configurable: true,
      get: () => geometry.scrollLeft,
      set: (value: number) => {
        geometry.scrollLeft = Math.max(
          0,
          Math.min(value, Math.max(0, geometry.scrollWidth - geometry.clientWidth)),
        );
      },
    },
    setPointerCapture: {
      configurable: true,
      value: vi.fn((pointerId: number) => capturedPointers.add(pointerId)),
    },
    releasePointerCapture: {
      configurable: true,
      value: vi.fn((pointerId: number) => capturedPointers.delete(pointerId)),
    },
    hasPointerCapture: {
      configurable: true,
      value: vi.fn((pointerId: number) => capturedPointers.has(pointerId)),
    },
  });

  for (const [index, child] of Array.from(track.children).entries()) {
    const width = index === 0 ? 104 : 96;
    Object.defineProperties(child, {
      offsetLeft: { configurable: true, get: () => 4 + index * 114 },
      offsetWidth: { configurable: true, get: () => width },
      getBoundingClientRect: {
        configurable: true,
        value: () => new DOMRect(4 + index * 114, 0, width, 116),
      },
    });
  }

  const scrollTo = vi.fn((options: ScrollToOptions | number) => {
    track.scrollLeft = typeof options === "number" ? options : options.left ?? track.scrollLeft;
    fireEvent.scroll(track);
  });
  const scrollBy = vi.fn((options: ScrollToOptions | number) => {
    track.scrollLeft += typeof options === "number" ? options : options.left ?? 0;
    fireEvent.scroll(track);
  });
  Object.defineProperties(track, {
    scrollTo: { configurable: true, value: scrollTo },
    scrollBy: { configurable: true, value: scrollBy },
  });

  function scrollManually(left: number) {
    track.scrollLeft = left;
    fireEvent.scroll(track);
  }

  return {
    ...view,
    wrapper,
    track,
    previous,
    next,
    geometry,
    scrollTo,
    scrollBy,
    scrollManually,
  };
}

describe("HomeLatestResultsCarousel", () => {
  it("renders fourteen ordered HTML results with the premium tone assets and visual labels", () => {
    const { track, previous, next } = mountCarousel();
    flushFrames();

    expect(track.tagName).toBe("OL");
    expect(track.getAttribute("aria-roledescription")).toBe("carrusel");
    expect(track.tabIndex).toBe(0);
    expect(track.getAttribute("data-animate")).toBeNull();
    expect(previous.getAttribute("aria-controls")).toBe(track.id);
    expect(next.getAttribute("aria-controls")).toBe(track.id);

    const cards = within(track).getAllByRole("listitem");
    expect(cards).toHaveLength(14);
    expect(cards.map((card) => card.getAttribute("data-position")))
      .toEqual(Array.from({ length: 14 }, (_, index) => String(index + 1)));
    expect(cards.map((card) => within(card).getByTestId("home-result-value").textContent))
      .toEqual(["085", "044", "007", ...values.slice(3)]);

    const expectedTones = ["gold", "silver", "bronze", ...Array<string>(11).fill("red")];
    const expectedAssets = [
      "/assets/results/balls/ball-gold.webp",
      "/assets/results/balls/ball-silver.webp",
      "/assets/results/balls/ball-bronze.webp",
      ...Array<string>(11).fill("/assets/results/balls/ball-red.webp"),
    ];
    for (const [index, card] of cards.entries()) {
      const position = index + 1;
      const value = index < 3 ? ["085", "044", "007"][index] : values[index];
      const number = within(card).getByTestId("home-result-value");
      const label = within(card).getByTestId("home-result-posture");
      const image = card.querySelector("img") as HTMLImageElement | null;

      expect(card.getAttribute("data-tone")).toBe(expectedTones[index]);
      expect(card.getAttribute("aria-label")).toBe(`${position}.ª postura: número ${value}`);
      expect(number.tagName).toBe("STRONG");
      expect(number.textContent).toBe(value);
      expect(within(card).queryByTestId("home-result-rank-badge")).toBeNull();
      expect(label.textContent).toBe(`${position}ª POSTURA`);
      expect(label.getAttribute("aria-hidden")).toBe("true");
      expect(card.getAttribute("data-entry-order")).toBe(String(14 - index));
      expect(card.style.getPropertyValue("--result-entry-index")).toBe("");
      expect(image).not.toBeNull();
      expect(decodedSource(image!)).toContain(expectedAssets[index]);
      expect(image!.getAttribute("alt")).toBe("");
      expect(image!.getAttribute("aria-hidden")).toBe("true");
      expect(image!.draggable).toBe(false);
      expect(image!.getAttribute("width")).toBe("384");
      expect(image!.getAttribute("height")).toBe("384");
      expect(image!.getAttribute("sizes")).toBeNull();
      expect(image!.getAttribute("srcset")).toBeNull();
    }

    const segments = screen.getAllByTestId("home-results-pagination-segment");
    expect(segments).toHaveLength(4);
    expect(segments.filter((segment) => segment.getAttribute("data-active") === "true"))
      .toHaveLength(1);
    expect(activeSegmentIndex()).toBe(0);
    for (const segment of segments) {
      const image = segment.querySelector("img") as HTMLImageElement;
      const active = segment.getAttribute("data-active") === "true";
      expect(decodedSource(image)).toContain(
        active
          ? "/assets/results/ui/carousel-indicator-active.svg"
          : "/assets/results/ui/carousel-indicator-inactive.svg",
      );
      expect(image.getAttribute("alt")).toBe("");
      expect(image.getAttribute("aria-hidden")).toBe("true");
    }

    expect(screen.queryByText(/deslizá para ver todos|swipe|deslizá|arrastrá/i)).toBeNull();
  });

  it("derives one of four active segments from real scroll and supports arrows and keyboard", () => {
    const { track, previous, next, geometry, scrollBy, scrollTo, scrollManually } = mountCarousel();
    flushFrames();
    const end = geometry.scrollWidth - geometry.clientWidth;

    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    expect(activeSegmentIndex()).toBe(0);

    scrollManually(end * 0.34);
    expect(activeSegmentIndex()).toBe(1);
    scrollManually(end * 0.67);
    expect(activeSegmentIndex()).toBe(2);
    scrollManually(end);
    expect(activeSegmentIndex()).toBe(3);
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(true);

    fireEvent.click(previous);
    expect(scrollBy).toHaveBeenLastCalledWith({ behavior: "smooth", left: -342 });
    expect(next.disabled).toBe(false);

    track.focus();
    expect(fireEvent.keyDown(track, { key: "Home" })).toBe(false);
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: "smooth", left: 0 });
    expect(activeSegmentIndex()).toBe(0);
    expect(document.activeElement).toBe(track);

    expect(fireEvent.keyDown(track, { key: "ArrowRight" })).toBe(false);
    expect(scrollBy).toHaveBeenLastCalledWith({ behavior: "smooth", left: 342 });
    expect(activeSegmentIndex()).toBe(1);
    expect(fireEvent.keyDown(track, { key: "ArrowLeft" })).toBe(false);
    expect(scrollBy).toHaveBeenLastCalledWith({ behavior: "smooth", left: -342 });
    expect(activeSegmentIndex()).toBe(0);

    expect(fireEvent.keyDown(track, { key: "End" })).toBe(false);
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: "smooth", left: end });
    expect(activeSegmentIndex()).toBe(3);
    expect(next.disabled).toBe(true);
  });

  it("remeasures whether arrows are necessary without changing the four-segment contract", () => {
    const { track, previous, next, geometry } = mountCarousel();
    flushFrames();
    const observer = observers.find((candidate) => candidate.targets.has(track));
    expect(observer).toBeDefined();

    geometry.clientWidth = geometry.scrollWidth;
    act(() => observer!.notify());

    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    expect(screen.getAllByTestId("home-results-pagination-segment")).toHaveLength(4);
    expect(activeSegmentIndex()).toBe(0);
  });

  it("leaves touch gestures native and implements captured primary-mouse dragging", () => {
    const { track, geometry, scrollBy, scrollTo } = mountCarousel();
    flushFrames();
    scrollBy.mockClear();
    scrollTo.mockClear();

    const touchStart = { identifier: 1, target: track, clientX: 260, clientY: 120 };
    const touchMove = { ...touchStart, clientX: 120 };
    for (const event of [
      createEvent.touchStart(track, { bubbles: true, cancelable: true, touches: [touchStart], changedTouches: [touchStart] }),
      createEvent.touchMove(track, { bubbles: true, cancelable: true, touches: [touchMove], changedTouches: [touchMove] }),
      createEvent.touchEnd(track, { bubbles: true, cancelable: true, touches: [], changedTouches: [touchMove] }),
    ]) {
      const preventDefault = vi.spyOn(event, "preventDefault");
      expect(fireEvent(track, event)).toBe(true);
      expect(event.defaultPrevented).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
    }
    expect(scrollBy).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(track.scrollLeft).toBe(0);

    geometry.scrollLeft = 180;
    const down = pointerEvent("pointerdown", track, {
      pointerId: 7,
      pointerType: "mouse",
      button: 0,
      clientX: 260,
    });
    expect(fireEvent(track, down)).toBe(true);
    expect(track.getAttribute("data-dragging")).toBe("true");
    expect(track.setPointerCapture).toHaveBeenCalledWith(7);

    const move = pointerEvent("pointermove", track, {
      pointerId: 7,
      pointerType: "mouse",
      clientX: 120,
    });
    expect(fireEvent(track, move)).toBe(false);
    expect(move.defaultPrevented).toBe(true);
    expect(track.scrollLeft).toBe(320);
    expect(activeSegmentIndex()).toBe(1);

    const up = pointerEvent("pointerup", track, {
      pointerId: 7,
      pointerType: "mouse",
      clientX: 120,
    });
    expect(fireEvent(track, up)).toBe(true);
    expect(track.getAttribute("data-dragging")).toBe("false");
    expect(track.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it("never auto-advances and cleans resize and scroll resources on unmount", () => {
    const { track, scrollBy, scrollTo, unmount } = mountCarousel();
    const resizeObserver = observers.find((candidate) => candidate.targets.has(track));
    const queuedFrameIds = [...pendingFrames.keys()];
    const removeTrackListener = vi.spyOn(track, "removeEventListener");
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    expect(resizeObserver).toBeDefined();
    expect(queuedFrameIds).toHaveLength(1);

    scrollBy.mockClear();
    scrollTo.mockClear();
    act(() => vi.advanceTimersByTime(60_000));
    expect(track.scrollLeft).toBe(0);
    expect(activeSegmentIndex()).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    unmount();

    expect(resizeObserver!.disconnect).toHaveBeenCalledOnce();
    for (const frameId of queuedFrameIds) expect(cancelFrame).toHaveBeenCalledWith(frameId);
    expect(pendingFrames.size).toBe(0);
    expect(removeTrackListener).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(removeWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
