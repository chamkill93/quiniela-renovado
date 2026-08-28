// @vitest-environment jsdom

import { StrictMode } from "react";
import { act, cleanup, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeResultsCarousel } from "@/features/product/home-results-carousel";

type Modality = "prizes" | "redoblona" | "invert";

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

beforeEach(() => {
  vi.useFakeTimers();
  pendingFrames = new Map();
  nextFrameId = 0;
  observers = [];
  vi.stubGlobal("requestAnimationFrame", requestFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function flushFrame() {
  const callbacks = [...pendingFrames.values()];
  pendingFrames.clear();
  act(() => {
    for (const callback of callbacks) callback(performance.now());
  });
}

function cards(count = 13) {
  return Array.from({ length: count }, (_, index) => (
    <article data-position={index + 1} data-testid="carousel-result" key={index + 1}>
      Posición {index + 1}
    </article>
  ));
}

function mountCarousel({
  modality = "prizes",
  label = "A LOS PREMIOS",
  count = 13,
  clientWidth = 340,
  scrollWidth = 1_576,
}: {
  modality?: Modality;
  label?: string;
  count?: number;
  clientWidth?: number;
  scrollWidth?: number;
} = {}) {
  const view = render(
    <HomeResultsCarousel label={label} modality={modality}>
      {cards(count)}
    </HomeResultsCarousel>,
  );
  const track = screen.getByTestId("home-results-carousel-track");
  const previous = screen.getByTestId("home-results-previous") as HTMLButtonElement;
  const next = screen.getByTestId("home-results-next") as HTMLButtonElement;
  const geometry = { clientWidth, scrollWidth, scrollLeft: 0 };
  Object.defineProperties(track, {
    clientWidth: { configurable: true, get: () => geometry.clientWidth },
    scrollWidth: { configurable: true, get: () => geometry.scrollWidth },
    scrollLeft: {
      configurable: true,
      get: () => geometry.scrollLeft,
      set: (value: number) => {
        geometry.scrollLeft = Math.max(0, Math.min(value, Math.max(0, geometry.scrollWidth - geometry.clientWidth)));
      },
    },
  });
  for (const [index, child] of Array.from(track.children).entries()) {
    Object.defineProperties(child, {
      offsetLeft: { configurable: true, get: () => 16 + index * 120 },
      offsetWidth: { configurable: true, value: 104 },
      getBoundingClientRect: {
        configurable: true,
        value: () => new DOMRect(16 + index * 120, 0, 104, 100),
      },
    });
  }

  // jsdom has no layout or native scrolling; mirror the position and scroll event.
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
    flushFrame();
  }

  return { ...view, track, previous, next, geometry, scrollTo, scrollBy, scrollManually };
}

describe("HomeResultsCarousel", () => {
  it.each<[Modality, string, number]>([
    ["prizes", "A LOS PREMIOS", 13],
    ["redoblona", "REDOBLONA", 13],
    ["invert", "INVERTIDA", 14],
  ])("exposes an accessible, focusable %s carousel without removing any cards", (modality, label, count) => {
    const { track, previous, next } = mountCarousel({ modality, label, count });
    flushFrame();

    expect(screen.getByTestId("home-results-carousel").contains(track)).toBe(true);
    expect(screen.getByRole("group", { name: `Resultados de ${label}` })).toBe(track);
    expect(track.getAttribute("aria-roledescription")).toBe("carrusel");
    expect(track.getAttribute("data-modality")).toBe(modality);
    expect(track.tabIndex).toBe(0);
    expect(track.id).not.toBe("");
    expect(within(track).getAllByTestId("carousel-result")).toHaveLength(count);
    expect(screen.getByRole("button", { name: "Ver resultados anteriores" })).toBe(previous);
    expect(screen.getByRole("button", { name: "Ver resultados siguientes" })).toBe(next);
    for (const button of [previous, next]) {
      expect(button.type).toBe("button");
      expect(button.getAttribute("aria-controls")).toBe(track.id);
    }
  });

  it("gives separately mounted carousels distinct track identifiers", () => {
    render(
      <>
        <HomeResultsCarousel label="Premios" modality="prizes">{cards()}</HomeResultsCarousel>
        <HomeResultsCarousel label="Invertida" modality="invert">{cards(14)}</HomeResultsCarousel>
      </>,
    );
    flushFrame();
    const wrappers = screen.getAllByTestId("home-results-carousel");
    const tracks = screen.getAllByTestId("home-results-carousel-track");
    expect(new Set(tracks.map((track) => track.id)).size).toBe(2);
    for (const [index, wrapper] of wrappers.entries()) {
      for (const button of within(wrapper).getAllByRole("button")) {
        expect(button.getAttribute("aria-controls")).toBe(tracks[index].id);
      }
    }
  });

  it("measures initial boundaries on an animation frame and moves a page of whole cards", () => {
    const { track, previous, next } = mountCarousel();
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    expect(pendingFrames.size).toBeGreaterThan(0);

    flushFrame();

    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    flushFrame();
    // Three 104px cards plus two 16px gaps need 344px, so only two fit in 340px.
    expect(track.scrollLeft).toBe(240);
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(false);

    fireEvent.click(next);
    flushFrame();
    expect(track.scrollLeft).toBe(480);
    fireEvent.click(previous);
    flushFrame();
    expect(track.scrollLeft).toBe(240);
    fireEvent.click(previous);
    flushFrame();
    expect(track.scrollLeft).toBe(0);
    expect(previous.disabled).toBe(true);
  });

  it("still advances at least one card when the viewport is narrower than a card stride", () => {
    const { track, next } = mountCarousel({ clientWidth: 88 });
    flushFrame();
    fireEvent.click(next);
    flushFrame();
    expect(track.scrollLeft).toBe(120);
  });

  it("supports ArrowLeft, ArrowRight, Home and End while retaining track focus", () => {
    const { track, geometry, previous, next } = mountCarousel();
    flushFrame();
    track.focus();

    expect(fireEvent.keyDown(track, { key: "ArrowRight" })).toBe(false);
    flushFrame();
    expect(track.scrollLeft).toBe(240);
    expect(fireEvent.keyDown(track, { key: "ArrowLeft" })).toBe(false);
    flushFrame();
    expect(track.scrollLeft).toBe(0);
    expect(fireEvent.keyDown(track, { key: "End" })).toBe(false);
    flushFrame();
    expect(track.scrollLeft).toBe(geometry.scrollWidth - geometry.clientWidth);
    expect(next.disabled).toBe(true);
    expect(previous.disabled).toBe(false);
    expect(fireEvent.keyDown(track, { key: "Home" })).toBe(false);
    flushFrame();
    expect(track.scrollLeft).toBe(0);
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    expect(document.activeElement).toBe(track);
  });

  it("leaves unrelated keyboard events and vertical navigation untouched", () => {
    const { track, scrollTo, scrollBy } = mountCarousel();
    flushFrame();
    scrollTo.mockClear();
    scrollBy.mockClear();

    for (const key of ["ArrowUp", "ArrowDown", "Tab", "Escape", "a"]) {
      expect(fireEvent.keyDown(track, { key })).toBe(true);
    }

    expect(track.scrollLeft).toBe(0);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it.each([
    ["horizontal", "track", 80, 140],
    ["vertical", "track", 260, 20],
    ["horizontal", "card", 80, 140],
    ["vertical", "card", 260, 20],
  ] as const)("leaves %s touches on the %s to native scrolling", (_direction, targetKind, clientX, clientY) => {
    const { track, scrollTo, scrollBy } = mountCarousel();
    flushFrame();
    scrollTo.mockClear();
    scrollBy.mockClear();
    const target = targetKind === "track" ? track : within(track).getAllByTestId("carousel-result")[0];
    const start = { identifier: 1, target, clientX: 260, clientY: 140 };
    const moved = { ...start, clientX, clientY };
    const events = [
      createEvent.touchStart(target, { bubbles: true, cancelable: true, touches: [start], changedTouches: [start] }),
      createEvent.touchMove(target, { bubbles: true, cancelable: true, touches: [moved], changedTouches: [moved] }),
      createEvent.touchEnd(target, { bubbles: true, cancelable: true, touches: [], changedTouches: [moved] }),
    ];

    for (const event of events) {
      const preventDefault = vi.spyOn(event, "preventDefault");
      expect(fireEvent(target, event)).toBe(true);
      expect(event.defaultPrevented).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
    }
    act(() => vi.advanceTimersByTime(16));
    flushFrame();

    // jsdom cannot pan a viewport; this guards against JS hijacking native gestures.
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollBy).not.toHaveBeenCalled();
    expect(track.scrollLeft).toBe(0);
  });

  it("updates both buttons after manual scrolling and stops at the final edge", () => {
    const { track, geometry, previous, next, scrollManually } = mountCarousel();
    flushFrame();
    scrollManually(180);
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(false);

    scrollManually(geometry.scrollWidth - geometry.clientWidth - 60);
    fireEvent.click(next);
    flushFrame();
    expect(track.scrollLeft).toBe(geometry.scrollWidth - geometry.clientWidth);
    expect(next.disabled).toBe(true);
    expect(previous.disabled).toBe(false);

    scrollManually(0);
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
  });

  it("remeasures overflow and whole-card page size when the observed viewport resizes", () => {
    const { track, geometry, previous, next } = mountCarousel();
    flushFrame();
    const observer = observers.find((candidate) => candidate.targets.has(track));
    expect(observer).toBeDefined();

    geometry.clientWidth = geometry.scrollWidth;
    act(() => observer!.notify());
    flushFrame();
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(true);

    geometry.clientWidth = 500;
    act(() => observer!.notify());
    flushFrame();
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    flushFrame();
    expect(track.scrollLeft).toBe(480);
  });

  it.each([0, 1, 3])("disables both directions when all %s cards fit without overflow", (count) => {
    const { track, previous, next } = mountCarousel({ count, scrollWidth: 340 });
    flushFrame();
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    expect(within(track).queryAllByTestId("carousel-result")).toHaveLength(count);
    fireEvent.click(previous);
    fireEvent.click(next);
    expect(track.scrollLeft).toBe(0);
  });

  it("never advances results automatically as time passes", () => {
    const { track, scrollTo, scrollBy } = mountCarousel();
    flushFrame();
    scrollTo.mockClear();
    scrollBy.mockClear();

    act(() => vi.advanceTimersByTime(60_000));
    flushFrame();

    expect(track.scrollLeft).toBe(0);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollBy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("disconnects resize observation and cancels queued measurements on unmount", () => {
    const { track, unmount } = mountCarousel();
    fireEvent.scroll(track);
    const queuedFrameIds = [...pendingFrames.keys()];
    expect(queuedFrameIds.length).toBeGreaterThan(0);

    unmount();

    for (const observer of observers) expect(observer.disconnect).toHaveBeenCalled();
    for (const id of queuedFrameIds) expect(cancelFrame).toHaveBeenCalledWith(id);
    expect(pendingFrames.size).toBe(0);
    requestFrame.mockClear();
    fireEvent.scroll(track);
    fireEvent.resize(window);
    expect(requestFrame).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not retain duplicate observations or frames after a StrictMode mount", () => {
    const { unmount } = render(
      <StrictMode>
        <HomeResultsCarousel label="Premios" modality="prizes">{cards()}</HomeResultsCarousel>
      </StrictMode>,
    );
    expect(observers).toHaveLength(2);
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
    expect(observers[1].disconnect).not.toHaveBeenCalled();
    expect(pendingFrames.size).toBe(1);

    unmount();

    expect(observers[1].disconnect).toHaveBeenCalledOnce();
    expect(pendingFrames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
