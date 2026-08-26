// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NumericReels } from "@/features/product/numeric-reels";
import { useSoundEffects } from "@/features/product/use-sound-effects";

let reducedMotion = false;
let rejectPlayback = false;
const mediaListeners = new Set<() => void>();
const audioInstances: MockAudio[] = [];

class MockAudio {
  currentTime = 0;
  onended: (() => void) | null = null;
  preload = "";
  volume = 1;
  readonly src: string;
  readonly pause = vi.fn();
  readonly play = vi.fn(() =>
    rejectPlayback ? Promise.reject(new DOMException("Autoplay blocked")) : Promise.resolve(),
  );

  constructor(src = "") {
    this.src = src;
    audioInstances.push(this);
  }
}

function SoundHarness() {
  const playSound = useSoundEffects();
  return (
    <>
      <button onClick={() => playSound("reelStart")} type="button">Inicio</button>
      <button onClick={() => playSound("reelTick")} type="button">Tick</button>
      <button onClick={() => playSound("reelTick", "stop")} type="button">Detener</button>
    </>
  );
}

function findAudio(file: string) {
  return audioInstances.find((audio) => audio.src.endsWith(file));
}

beforeEach(() => {
  reducedMotion = false;
  rejectPlayback = false;
  audioInstances.length = 0;
  mediaListeners.clear();
  window.localStorage.clear();
  vi.useFakeTimers();
  vi.stubGlobal("Audio", MockAudio);
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reducedMotion,
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => mediaListeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => mediaListeners.delete(listener),
      addListener: (listener: () => void) => mediaListeners.add(listener),
      removeListener: (listener: () => void) => mediaListeners.delete(listener),
      dispatchEvent: () => true,
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("sonido mecánico de NumericReels", () => {
  it("respeta quinie_sound=off y detiene el canal activo al deshabilitarlo", () => {
    const view = render(<SoundHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Inicio" }));
    expect(audioInstances).toHaveLength(0);

    window.localStorage.setItem("quinie_sound", "on");
    fireEvent.click(screen.getByRole("button", { name: "Inicio" }));
    const start = findAudio("reel_start.wav");
    expect(start?.play).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Tick" }));
    const tick = findAudio("reel_tick.wav");
    expect(start?.pause).toHaveBeenCalledTimes(1);
    expect(tick?.play).toHaveBeenCalledTimes(1);
    expect(tick?.volume).toBe(0.16);

    window.localStorage.setItem("quinie_sound", "off");
    window.dispatchEvent(new Event("quinie:preferences-changed"));
    expect(tick?.pause).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it("maneja un bloqueo de autoplay sin propagar el rechazo", async () => {
    window.localStorage.setItem("quinie_sound", "on");
    rejectPlayback = true;
    render(<SoundHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Inicio" }));
    await act(async () => Promise.resolve());

    expect(findAudio("reel_start.wav")?.play).toHaveBeenCalledTimes(1);
  });

  it("da al preview una introducción corta y corta sus ticks al desmontar", () => {
    window.localStorage.setItem("quinie_sound", "on");
    const view = render(<NumericReels continuous results={["137"]} />);

    expect(findAudio("reel_start.wav")?.play).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(2_100));
    const tick = findAudio("reel_tick.wav");
    expect(tick?.play).toHaveBeenCalledTimes(4);

    act(() => vi.advanceTimersByTime(3_000));
    expect(tick?.play).toHaveBeenCalledTimes(4);
    view.unmount();
    expect(tick?.pause).toHaveBeenCalled();

    const playsAtUnmount = tick?.play.mock.calls.length;
    act(() => vi.advanceTimersByTime(2_000));
    expect(tick?.play).toHaveBeenCalledTimes(playsAtUnmount ?? 0);
  });

  it("serializa los sonidos de un resultado múltiple en un único canal", () => {
    window.localStorage.setItem("quinie_sound", "on");
    const onComplete = vi.fn();
    render(
      <NumericReels
        onComplete={onComplete}
        results={["101", "202", "303", "404", "505"]}
      />,
    );

    act(() => vi.advanceTimersByTime(2_000));

    expect(findAudio("reel_tick.wav")).toBeTruthy();
    expect(findAudio("reel_stop.wav")?.play).toHaveBeenCalledTimes(5);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(audioInstances.filter((audio) => audio.src.includes("/reel_"))).toHaveLength(3);
  });

  it("no emite sonidos cuando la persona prefiere movimiento reducido", () => {
    reducedMotion = true;
    window.localStorage.setItem("quinie_sound", "on");
    const onComplete = vi.fn();
    render(<NumericReels onComplete={onComplete} results={["497"]} />);

    act(() => vi.advanceTimersByTime(150));

    expect(audioInstances).toHaveLength(0);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
