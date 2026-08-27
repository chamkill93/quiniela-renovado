// @vitest-environment jsdom

import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDrawPageDefinition } from "@/features/product/draw-page-data";
import { buildGamingCatalog } from "@/lib/gaming/catalog";
import type { GamingCatalog } from "@/lib/gaming/types";

const { useProductMock, refreshMock } = vi.hoisted(() => ({
  useProductMock: vi.fn(),
  refreshMock: vi.fn(),
}));
vi.mock("@/providers/product-provider", () => ({ useProduct: useProductMock }));

import { DrawPageClient } from "@/features/product/draw-page-client";

const catalog = buildGamingCatalog("REFUND", new Date("2026-08-26T10:00:00.000Z"));
const early = getDrawPageDefinition("tempranero")!;
const previewVideoPath = "/assets/video/quinie-streaming-simulado.mp4";
const operationalCatalog: GamingCatalog = {
  ...catalog,
  draws: catalog.draws.map((draw) => ({
    ...draw,
    drawsAt: "2026-08-27T15:45:00.000Z",
    closesAt: "2026-08-27T15:30:00.000Z",
  })),
};

function productState(overrides: Record<string, unknown> = {}) {
  return {
    catalog,
    results: [],
    loading: false,
    error: null,
    unauthorized: false,
    refresh: refreshMock,
    gatewayMode: "preview",
    ...overrides,
  };
}

function initializeClock() {
  act(() => vi.advanceTimersByTime(0));
}

function expectCountdown(hours: string, minutes: string, seconds = "00") {
  const timer = screen.getByRole("timer");
  expect(timer).toBe(screen.getByTestId("draw-countdown"));
  expect(timer.tagName).toBe("DIV");
  expect(timer.getAttribute("aria-label"))
    .toBe(`Faltan ${hours} horas, ${minutes} minutos y ${seconds} segundos`);
  expect(timer.textContent?.replace(/\s+/g, "")).toBe(`${hours}:${minutes}:${seconds}`);
  return timer;
}

function expectNoCountdown() {
  expect(screen.queryByRole("timer")).toBeNull();
  expect(screen.queryByTestId("draw-countdown")).toBeNull();
  expect(screen.queryByText("00:00:00")).toBeNull();
  expect(screen.queryByText(/Horario.*alcanzado|Calculando cuenta regresiva|Horario todavía no disponible/i))
    .toBeNull();
}

function expectNoDrawMetadata() {
  const page = screen.getByTestId("draw-page");
  expect(within(page).getAllByRole("heading")).toHaveLength(1);
  expect(within(page).queryAllByRole("link")).toHaveLength(0);
  expect(screen.queryByLabelText("Programación del sorteo")).toBeNull();
  expect(within(page).queryAllByText(
    /Transmisión simulada|Modo demostración|Video de muestra|Fuente autorizada|Señal oficial|Resultado|Historial|Horario|Hora de Paraguay|Cierre de venta|Fecha|Juego responsable|Cuenta regresiva|18\+/i,
  )).toHaveLength(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-27T12:15:00.000Z"));
  useProductMock.mockReturnValue(productState());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("DrawPageClient preview transmission", () => {
  it("plays the attached video with accessible controls and no extra labels", () => {
    render(<DrawPageClient definition={early} selectedDate="2026-08-27" streamUrl={null} />);
    initializeClock();

    const video = screen.getByTestId("draw-preview-video") as HTMLVideoElement;
    expect(video.tagName).toBe("VIDEO");
    expect(video.getAttribute("src")).toBe(previewVideoPath);
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video.controls).toBe(true);
    expect(video.getAttribute("aria-label")).toBe("Streaming de Tempranero");
    expect(screen.queryByTestId("draw-stream-placeholder")).toBeNull();
    expect(screen.getByTestId("draw-stream-frame").querySelector("iframe")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expectNoDrawMetadata();
  });

  it("places only the draw name, player and compact countdown in that order", () => {
    render(<DrawPageClient definition={early} selectedDate="2026-08-27" streamUrl={null} />);
    initializeClock();

    const page = screen.getByTestId("draw-page");
    const title = screen.getByRole("heading", { level: 1, name: "Tempranero" });
    const frame = screen.getByTestId("draw-stream-frame");
    const timer = expectCountdown("01", "15");
    expect(title).toBe(screen.getByTestId("draw-page-title"));
    expect(frame.contains(screen.getByTestId("draw-preview-video"))).toBe(true);
    expect(Array.from(page.children)).toEqual([title, frame, timer]);
    expectNoDrawMetadata();
  });

  it.each(["preview", "backoffice"])("does not bring back results or schedule details when %s has published results", (gatewayMode) => {
    useProductMock.mockReturnValue(productState({
      catalog: operationalCatalog,
      gatewayMode,
      results: [{
        id: "published-head",
        source: "DRAW",
        drawId: "early",
        gameId: "head",
        gameName: "A la Cabeza",
        result: "497",
        occurredAt: "2026-08-27T12:00:00.000Z",
      }],
    }));
    render(
      <DrawPageClient
        definition={early}
        selectedDate="2026-08-27"
        streamUrl="https://stream.example/authorized-player"
      />,
    );
    initializeClock();

    expectNoDrawMetadata();
    expect(screen.queryByText("497")).toBeNull();
    expect(screen.queryByText("A la Cabeza")).toBeNull();
    expect(screen.queryByText("12:30")).toBeNull();
    expect(Array.from(screen.getByTestId("draw-page").children)).toEqual([
      screen.getByTestId("draw-page-title"),
      screen.getByTestId("draw-stream-frame"),
      screen.getByTestId("draw-countdown"),
    ]);
  });

  it("uses the simulation in preview even when an operational embed is configured", () => {
    render(
      <DrawPageClient
        definition={early}
        streamUrl="https://stream.example/authorized-player"
      />,
    );
    initializeClock();

    expect(screen.getByTestId("draw-preview-video").getAttribute("src"))
      .toBe(previewVideoPath);
    expect(screen.queryByTitle("Streaming de Tempranero")).toBeNull();
  });

  it("offers a recoverable error when the local video cannot load", () => {
    render(<DrawPageClient definition={early} streamUrl={null} />);
    initializeClock();
    const firstVideo = screen.getByTestId("draw-preview-video");

    fireEvent.error(firstVideo);

    expect(screen.getByRole("alert").textContent).toMatch(/video/i);
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar video" }));

    expect(screen.queryByRole("alert")).toBeNull();
    const retriedVideo = screen.getByTestId("draw-preview-video");
    expect(retriedVideo).not.toBe(firstVideo);
    expect(retriedVideo.getAttribute("src")).toBe(previewVideoPath);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("DrawPageClient Paraguay schedule", () => {
  it.each([
    ["tempranero", "2026-08-27T12:15:00.000Z", "01", "15"],
    ["matutino", "2026-08-27T14:00:00.000Z", "02", "00"],
    ["vespertino", "2026-08-27T17:00:00.000Z", "02", "30"],
    ["nocturno", "2026-08-27T21:00:00.000Z", "02", "30"],
  ])("associates %s with its scheduled Paraguay time rather than stale preview timestamps", (slug, instant, hours, minutes) => {
    vi.setSystemTime(new Date(instant));
    render(
      <DrawPageClient
        definition={getDrawPageDefinition(slug)!}
        selectedDate="2026-08-27"
        streamUrl={null}
      />,
    );
    initializeClock();

    expectCountdown(hours, minutes);
    expectNoDrawMetadata();
  });

  it("keeps the tomorrow date selected by the Inicio link after the last draw of the day", () => {
    vi.setSystemTime(new Date("2026-08-27T23:30:00.000Z"));
    render(<DrawPageClient definition={early} selectedDate="2026-08-28" streamUrl={null} />);
    initializeClock();

    expectCountdown("14", "00");
  });

  it.each([undefined, "2026-08-27"])("removes the complete countdown at zero without restarting the video or rolling to tomorrow (selected date: %s)", (selectedDate) => {
    vi.setSystemTime(new Date("2026-08-27T13:29:59.000Z"));
    render(<DrawPageClient definition={early} selectedDate={selectedDate} streamUrl={null} />);
    initializeClock();
    const video = screen.getByTestId("draw-preview-video") as HTMLVideoElement;
    const frame = screen.getByTestId("draw-stream-frame");
    video.currentTime = 17;
    expectCountdown("00", "00", "01");

    act(() => vi.advanceTimersByTime(999));
    expectCountdown("00", "00", "01");

    act(() => vi.advanceTimersByTime(1));
    expectNoCountdown();
    expect(screen.getByTestId("draw-preview-video")).toBe(video);
    expect(video.currentTime).toBe(17);
    expect(Array.from(screen.getByTestId("draw-page").children)).toEqual([
      screen.getByTestId("draw-page-title"),
      frame,
    ]);
    expect(screen.queryByRole("status")).toBeNull();

    vi.setSystemTime(new Date("2026-08-28T12:00:00.000Z"));
    fireEvent.focus(window);

    expectNoCountdown();
    expect(screen.getByTestId("draw-preview-video")).toBe(video);
    expect(video.currentTime).toBe(17);
    expect(screen.getByTestId("draw-stream-frame")).toBe(frame);
    expect(Array.from(screen.getByTestId("draw-page").children)).toHaveLength(2);
  });

  it("never displays a zero-valued countdown when opened at the selected draw time", () => {
    vi.setSystemTime(new Date("2026-08-27T13:30:00.000Z"));
    render(<DrawPageClient definition={early} selectedDate="2026-08-27" streamUrl={null} />);
    const video = screen.getByTestId("draw-preview-video");
    initializeClock();

    expectNoCountdown();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("draw-preview-video")).toBe(video);
    expect(Array.from(screen.getByTestId("draw-page").children)).toEqual([
      screen.getByTestId("draw-page-title"),
      screen.getByTestId("draw-stream-frame"),
    ]);
  });

  it.each([undefined, "", "no-es-fecha", "2026-02-30"])("chooses the next occurrence when the requested date is missing or invalid (%s)", (selectedDate) => {
    vi.setSystemTime(new Date("2026-08-27T14:00:00.000Z"));
    render(<DrawPageClient definition={early} selectedDate={selectedDate} streamUrl={null} />);
    initializeClock();

    expectCountdown("23", "30");
  });

  it("cleans up the clock on unmount without leaving duplicate StrictMode intervals", () => {
    const setInterval = vi.spyOn(window, "setInterval");
    const clearInterval = vi.spyOn(window, "clearInterval");
    const { unmount } = render(
      <StrictMode><DrawPageClient definition={early} streamUrl={null} /></StrictMode>,
    );
    initializeClock();

    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1_000);
    const clockIntervals = setInterval.mock.calls.flatMap(([, delay], index) =>
      delay === 1_000 ? [setInterval.mock.results[index].value] : [],
    );
    expect(clockIntervals).toHaveLength(2);
    expect(clearInterval).toHaveBeenCalledWith(clockIntervals[0]);
    expect(clearInterval).not.toHaveBeenCalledWith(clockIntervals[1]);

    unmount();
    expect(clearInterval).toHaveBeenCalledWith(clockIntervals[1]);
  });
});

describe("DrawPageClient operational mode", () => {
  beforeEach(() => {
    useProductMock.mockReturnValue(productState({
      catalog: operationalCatalog,
      gatewayMode: "backoffice",
    }));
  });

  it("preserves the authorized iframe and the actual backoffice schedule", () => {
    render(
      <DrawPageClient
        definition={early}
        selectedDate="2026-08-27"
        streamUrl="https://stream.example/authorized-player"
      />,
    );
    initializeClock();

    const frame = screen.getByTitle("Streaming de Tempranero");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("src")).toBe("https://stream.example/authorized-player");
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    expect(screen.queryByTestId("draw-stream-placeholder")).toBeNull();
    expectCountdown("03", "30");
    expectNoDrawMetadata();
  });

  it("keeps the no-signal placeholder instead of introducing a fake backoffice stream", () => {
    render(<DrawPageClient definition={early} streamUrl={null} />);
    initializeClock();

    expect(screen.getByTestId("draw-stream-placeholder")).toBeTruthy();
    expect(screen.getByText("Transmisión no disponible")).toBeTruthy();
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    expect(screen.queryByTestId("draw-stream-frame")).toBeNull();
    expect(Array.from(screen.getByTestId("draw-page").children)).toEqual([
      screen.getByTestId("draw-page-title"),
      screen.getByTestId("draw-stream-placeholder"),
      screen.getByTestId("draw-countdown"),
    ]);
    expectNoDrawMetadata();
  });

  it("does not substitute another operational date when the requested draw date is unavailable", () => {
    render(<DrawPageClient definition={early} selectedDate="2026-08-28" streamUrl={null} />);
    initializeClock();

    expectNoCountdown();
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    expect(Array.from(screen.getByTestId("draw-page").children)).toEqual([
      screen.getByTestId("draw-page-title"),
      screen.getByTestId("draw-stream-placeholder"),
    ]);
  });

  it.each<[string, GamingCatalog | null]>([
    ["missing catalog", null],
    ["empty catalog", { ...catalog, draws: [] }],
    ["invalid timestamp", {
      ...catalog,
      draws: catalog.draws.map((draw) => ({ ...draw, drawsAt: "invalid" })),
    }],
  ])("never substitutes the preview timetable for a %s", (_reason, remoteCatalog) => {
    useProductMock.mockReturnValue(productState({
      catalog: remoteCatalog,
      gatewayMode: "backoffice",
    }));
    render(<DrawPageClient definition={early} selectedDate="2026-08-27" streamUrl={null} />);
    initializeClock();

    expectNoCountdown();
    expectNoDrawMetadata();
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    expect(Array.from(screen.getByTestId("draw-page").children)).toEqual([
      screen.getByTestId("draw-page-title"),
      screen.getByTestId("draw-stream-placeholder"),
    ]);
  });
});
