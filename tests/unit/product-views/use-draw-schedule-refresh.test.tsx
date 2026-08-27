// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDrawScheduleRefresh } from "@/features/product/use-draw-schedule-refresh";
import { buildPreviewDrawsForDate } from "@/lib/gaming/daily-draw-schedule";

type Options = Parameters<typeof useDrawScheduleRefresh>[0];
const LAST_DRAW_AT = Date.parse("2026-08-27T23:30:00.000Z");
const draws = buildPreviewDrawsForDate("2026-08-27");
let visibility: DocumentVisibilityState;

function options(overrides: Partial<Options> = {}): Options {
  return {
    enabled: true,
    now: LAST_DRAW_AT - 1_000,
    draws,
    loading: false,
    refresh: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function settle() {
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(LAST_DRAW_AT - 1_000);
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("operational draw schedule refresh", () => {
  it("does not request anything in preview even after expiry, a new day or focus", async () => {
    const props = options({ enabled: false });
    const { rerender } = renderHook(useDrawScheduleRefresh, { initialProps: props });
    vi.setSystemTime(LAST_DRAW_AT + 86_400_000);
    rerender({ ...props, now: Date.now() });
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(props.refresh).not.toHaveBeenCalled();
  });

  it("refreshes once at the last known draw, not at an earlier draw or sales cutoff", async () => {
    const props = options({ now: Date.parse("2026-08-27T13:30:00Z") });
    const { rerender } = renderHook(useDrawScheduleRefresh, { initialProps: props });
    expect(props.refresh).not.toHaveBeenCalled();
    rerender({ ...props, now: LAST_DRAW_AT - 15 * 60_000 });
    expect(props.refresh).not.toHaveBeenCalled();
    rerender({ ...props, now: LAST_DRAW_AT - 1 });
    expect(props.refresh).not.toHaveBeenCalled();
    vi.setSystemTime(LAST_DRAW_AT);
    rerender({ ...props, now: LAST_DRAW_AT });
    await settle();
    expect(props.refresh).toHaveBeenCalledTimes(1);
    rerender({ ...props, now: LAST_DRAW_AT });
    await settle();
    expect(props.refresh).toHaveBeenCalledTimes(1);
  });

  it("retries an unchanged expired catalog at most once per minute, never every second", async () => {
    const props = options({ now: LAST_DRAW_AT });
    const { rerender } = renderHook(useDrawScheduleRefresh, { initialProps: props });
    await settle();
    expect(props.refresh).toHaveBeenCalledTimes(1);

    for (let second = 1; second < 60; second += 1) {
      rerender({ ...props, now: LAST_DRAW_AT + second * 1_000 });
    }
    expect(props.refresh).toHaveBeenCalledTimes(1);
    rerender({ ...props, now: LAST_DRAW_AT + 60_000 });
    await settle();
    expect(props.refresh).toHaveBeenCalledTimes(2);
    rerender({ ...props, now: LAST_DRAW_AT + 61_000 });
    await settle();
    expect(props.refresh).toHaveBeenCalledTimes(2);
  });

  it("shares the one-minute throttle across focus and visible events", async () => {
    const props = options({ draws: buildPreviewDrawsForDate("2026-08-28") });
    renderHook(useDrawScheduleRefresh, { initialProps: props });
    window.dispatchEvent(new Event("focus"));
    await settle();
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(props.refresh).toHaveBeenCalledTimes(1);
    vi.setSystemTime(LAST_DRAW_AT - 1_000 + 59_999);
    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(props.refresh).toHaveBeenCalledTimes(1);
    vi.setSystemTime(LAST_DRAW_AT - 1_000 + 60_000);
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(props.refresh).toHaveBeenCalledTimes(2);
  });

  it("uses the Paraguay day change rather than UTC midnight", async () => {
    const props = options({
      now: Date.parse("2026-08-27T23:59:59Z"),
      draws: buildPreviewDrawsForDate("2026-08-28"),
    });
    const { rerender } = renderHook(useDrawScheduleRefresh, { initialProps: props });
    rerender({ ...props, now: Date.parse("2026-08-28T00:00:00Z") });
    await settle();
    expect(props.refresh).not.toHaveBeenCalled();
    rerender({ ...props, now: Date.parse("2026-08-28T03:00:00Z") });
    await settle();
    expect(props.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not retry in a hidden tab and refreshes when it becomes visible", async () => {
    visibility = "hidden";
    const props = options({ now: LAST_DRAW_AT });
    const { rerender } = renderHook(useDrawScheduleRefresh, { initialProps: props });
    vi.setSystemTime(LAST_DRAW_AT + 120_000);
    rerender({ ...props, now: Date.now() });
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(props.refresh).not.toHaveBeenCalled();
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(props.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([null, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE])(
    "ignores an unavailable or invalid clock (%s)",
    async (now) => {
      const props = options({ now });
      renderHook(useDrawScheduleRefresh, { initialProps: props });
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      await settle();
      expect(props.refresh).not.toHaveBeenCalled();
    },
  );

  it("ignores loading and tolerates a missing refresh callback", async () => {
    const props = options({ loading: true, now: LAST_DRAW_AT });
    const { rerender } = renderHook(useDrawScheduleRefresh, { initialProps: props });
    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(props.refresh).not.toHaveBeenCalled();
    rerender({ ...props, loading: false, refresh: undefined });
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(props.refresh).not.toHaveBeenCalled();
    rerender({ ...props, loading: false });
    await settle();
    expect(props.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not overlap a slow refresh even after the throttle period", async () => {
    let resolveRefresh: (() => void) | undefined;
    const refresh = vi.fn(() => new Promise<void>((resolve) => { resolveRefresh = resolve; }));
    const props = options({ now: LAST_DRAW_AT, refresh });
    const { rerender } = renderHook(useDrawScheduleRefresh, { initialProps: props });
    vi.setSystemTime(LAST_DRAW_AT + 120_000);
    rerender({ ...props, now: Date.now() });
    window.dispatchEvent(new Event("focus"));
    expect(refresh).toHaveBeenCalledTimes(1);
    resolveRefresh?.();
    await settle();
    rerender({ ...props, now: Date.now() + 1 });
    expect(refresh).toHaveBeenCalledTimes(2);
    resolveRefresh?.();
    await settle();
  });

  it("handles a failed background request and permits a later throttled retry", async () => {
    const refresh = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("offline"));
    const props = options({ now: LAST_DRAW_AT, refresh });
    const { rerender } = renderHook(useDrawScheduleRefresh, { initialProps: props });
    await settle();
    rerender({ ...props, now: LAST_DRAW_AT + 60_000 });
    await settle();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does not let unrelated families or IDs hide expired daily Quiniela draws", async () => {
    const future = { ...draws[0], drawsAt: "2026-09-01T12:00:00Z" };
    const props = options({
      now: LAST_DRAW_AT,
      draws: [...draws, { ...future, family: "MEGALOTO" }, { ...future, id: "other" }],
    });
    renderHook(useDrawScheduleRefresh, { initialProps: props });
    await settle();
    expect(props.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, [], [{ ...draws[0], drawsAt: "invalid" }]])(
    "does not invent an expiry for an unavailable schedule (%s)",
    async (unavailable) => {
      const props = options({ now: LAST_DRAW_AT, draws: unavailable });
      renderHook(useDrawScheduleRefresh, { initialProps: props });
      await settle();
      expect(props.refresh).not.toHaveBeenCalled();
      window.dispatchEvent(new Event("focus"));
      await settle();
      expect(props.refresh).toHaveBeenCalledTimes(1);
    },
  );

  it("removes its listeners on unmount", async () => {
    const addWindow = vi.spyOn(window, "addEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    const addDocument = vi.spyOn(document, "addEventListener");
    const removeDocument = vi.spyOn(document, "removeEventListener");
    const props = options();
    const { unmount } = renderHook(useDrawScheduleRefresh, { initialProps: props });
    const focus = addWindow.mock.calls.find(([event]) => event === "focus")![1];
    const visible = addDocument.mock.calls.find(([event]) => event === "visibilitychange")![1];
    unmount();
    expect(removeWindow).toHaveBeenCalledWith("focus", focus);
    expect(removeDocument).toHaveBeenCalledWith("visibilitychange", visible);
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(props.refresh).not.toHaveBeenCalled();
  });
});
