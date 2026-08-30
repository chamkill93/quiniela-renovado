// @vitest-environment jsdom

import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildGamingCatalog } from "@/lib/gaming/catalog";
import type { GamingCatalog } from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";

const { useProductMock } = vi.hoisted(() => ({ useProductMock: vi.fn() }));
vi.mock("@/providers/product-provider", () => ({ useProduct: useProductMock }));
vi.mock("@/features/product/draw-icon", () => ({ DrawIcon: () => null }));

import { HomeSections } from "@/features/product/home-sections";

const catalog = buildGamingCatalog("REFUND", new Date("2026-08-26T10:00:00.000Z"));
const advertisingVideoIds = ["Z3eXyAIz65I", "JV9ajM_6Rsc"] as const;
const resultsCatalog: GamingCatalog = {
  ...catalog,
  draws: [
    ...catalog.draws,
    { ...catalog.draws.find((draw) => draw.id === "night")!, id: "quiniela-night", label: "Nocturno" },
    { ...catalog.draws.find((draw) => draw.id === "evening")!, id: "quiniela-evening", label: "Vespertino" },
  ],
};
const latestDrawValues = [
  "085", "208", "007", "731", "112", "005", "830",
  "701", "550", "909", "123", "888", "010", "044",
];

function drawSnapshot(overrides: Partial<MockResult> = {}): MockResult {
  return {
    id: "night-canonical-snapshot",
    source: "DRAW",
    drawId: "quiniela-night",
    gameId: "prizes",
    gameName: "A los Premios",
    result: "999",
    resultNumbers: ["999", "998", "997"],
    drawNumbers: latestDrawValues.map((value, index) => ({ position: index + 1, value })).reverse(),
    occurredAt: "2026-08-26T23:30:00.000Z",
    ...overrides,
  };
}

const previousNight = drawSnapshot({
  id: "previous-night",
  occurredAt: "2026-08-25T23:30:00.000Z",
  drawNumbers: latestDrawValues.map((_, index) => ({ position: index + 1, value: "666" })),
});
const results: MockResult[] = [
  previousNight,
  {
    id: "contradictory-legacy-head",
    source: "DRAW",
    drawId: "nocturno",
    gameId: "head",
    result: "999",
    occurredAt: "2026-08-26T23:30:00.000Z",
  },
  drawSnapshot({
    id: "earlier-vespertino",
    drawId: "quiniela-evening",
    occurredAt: "2026-08-26T19:30:00.000Z",
    drawNumbers: latestDrawValues.map((_, index) => ({ position: index + 1, value: "777" })),
  }),
  drawSnapshot(),
  {
    id: "contradictory-legacy-prizes",
    source: "DRAW",
    drawId: "nocturno",
    gameId: "prizes",
    resultNumbers: ["998", "997", "996"],
    occurredAt: "2026-08-26T23:30:00.000Z",
  },
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HomeSections latest draw results", () => {
  const base = { catalog: resultsCatalog, results, loading: false, error: null, gatewayMode: "backoffice" };
  const allPositions = Array.from({ length: 14 }, (_, index) => index + 1);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:15:00.000Z"));
    useProductMock.mockReturnValue(base);
  });

  function mountResults() {
    const view = render(<HomeSections />);
    act(() => vi.advanceTimersByTime(0));
    return view;
  }

  function resultsSection() {
    return screen.getByTestId("home-results-section");
  }

  function resultsList() {
    return within(resultsSection()).getByRole("list", {
      name: "Las 14 posturas del último sorteo publicado",
    });
  }

  function resultBalls() {
    return within(resultsList()).getAllByRole("listitem");
  }

  function expectBalls(values: readonly string[]) {
    const balls = resultBalls();
    expect(balls).toHaveLength(14);
    expect(balls.map((ball) => Number(ball.getAttribute("data-position")))).toEqual(allPositions);
    expect(balls.map((ball) => within(ball).getByTestId("home-result-value").textContent))
      .toEqual(values);
    expect(balls.map((ball) => within(ball).getByTestId("home-result-posture").textContent))
      .toEqual(allPositions.map((position) => position + "ª POSTURA"));
    return balls;
  }

  function expectPositionRanks(balls: readonly HTMLElement[]) {
    const tonesByPosition: Record<number, string> = { 1: "gold", 2: "silver", 3: "bronze" };
    for (const ball of balls) {
      const position = Number(ball.getAttribute("data-position"));
      const expectedTone = tonesByPosition[position] ?? "red";
      const image = ball.querySelector("img");
      expect(ball.getAttribute("data-tone")).toBe(expectedTone);
      expect(decodeURIComponent(image?.getAttribute("src") ?? ""))
        .toContain(`/assets/results/balls/ball-${expectedTone}.webp`);
      expect(image?.getAttribute("alt")).toBe("");
      expect(image?.getAttribute("aria-hidden")).toBe("true");
      expect(within(ball).queryByTestId("home-result-rank-badge")).toBeNull();
      expect(within(ball).queryByTestId("home-result-rank")).toBeNull();
    }
  }

  function expectMetadata(time = "20:30", date = "26/08/2026") {
    const metadata = within(resultsSection()).getAllByTestId("home-results-draw");
    expect(metadata).toHaveLength(1);
    expect(metadata[0].textContent).toContain("Nocturno");
    expect(metadata[0].textContent).toContain(date);
    expect(metadata[0].textContent).toContain(time);
  }

  it("shows one canonical 14-ball view for only the latest named draw", () => {
    mountResults();

    expect(within(screen.getByTestId("home-draw-grid")).getAllByRole("button")).toHaveLength(4);
    expect(within(resultsSection()).getByRole("heading", { name: "Último sorteo publicado" })).toBeTruthy();
    expect(resultsList().tagName).toBe("OL");
    expect(resultsList().getAttribute("tabindex")).toBe("0");
    expect(resultsList().getAttribute("aria-roledescription")).toBe("carrusel");
    expect(resultsList().getAttribute("data-animate")).toBeNull();
    expectBalls(latestDrawValues);
    expectMetadata();
    expect(screen.queryByText("Resultados de muestra")).toBeNull();
    expect(within(resultsSection()).queryByText("Vespertino")).toBeNull();
    for (const excludedValue of ["666", "777", "999", "998", "997"]) {
      expect(within(resultsSection()).queryByText(excludedValue, { exact: true })).toBeNull();
    }
    expect(within(resultsSection()).queryAllByRole("tab")).toHaveLength(0);
    expect(within(resultsSection()).queryByRole("tabpanel")).toBeNull();
    expect(within(resultsSection()).getByTestId("home-results-carousel").contains(resultsList())).toBe(true);
    expect(within(resultsSection()).getAllByTestId("home-results-pagination-segment")).toHaveLength(4);
    expect(within(resultsSection()).getByRole("button", { name: "Ver resultados anteriores" })).toBeTruthy();
    expect(within(resultsSection()).getByRole("button", { name: "Ver resultados siguientes" })).toBeTruthy();
    expect(within(resultsSection()).queryByText(/desliz|swipe|arrastr/i)).toBeNull();
    expect(within(resultsSection()).queryByRole("button", { name: "Ver más resultados" })).toBeNull();
    expect(within(resultsSection()).getByRole("link", { name: /Ver todos/i }).getAttribute("href"))
      .toBe("/resultados");
  });

  it("keeps visual and accessible order 1 through 14 without an entrance-animation property", () => {
    mountResults();
    const balls = expectBalls(latestDrawValues);

    expect(Array.from(resultsList().children)).toEqual(balls);
    expect(balls.map((ball) => ball.getAttribute("data-entry-order")))
      .toEqual(allPositions.map((position) => String(15 - position)));
    expect(balls.map((ball) => ball.style.getPropertyValue("--result-entry-index")))
      .toEqual(allPositions.map(() => ""));
    expect(balls.every((ball) => ball.style.order === "")).toBe(true);
  });

  it("does not register a visibility-driven entrance animation", () => {
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds = [0.18];
      disconnect = disconnectMock;
      observe = observeMock;
      takeRecords = () => [];
      unobserve = vi.fn();

      constructor(callback: IntersectionObserverCallback) {
        void callback;
      }
    });

    mountResults();
    const list = resultsList();
    expect(list.getAttribute("data-animate")).toBeNull();
    expect(observeMock).not.toHaveBeenCalled();
    expect(disconnectMock).not.toHaveBeenCalled();
  });

  it("uses gold, silver and bronze assets for the podium and one red asset for positions 4 through 14", () => {
    mountResults();
    const balls = expectBalls(latestDrawValues);

    expectPositionRanks(balls);
    expect(balls.slice(0, 3).map((ball) => ball.getAttribute("data-tone")))
      .toEqual(["gold", "silver", "bronze"]);
    expect(new Set(balls.slice(3).map((ball) => ball.querySelector("img")?.getAttribute("src"))).size)
      .toBe(1);
    expect(within(resultsList()).queryByTestId("home-result-rank")).toBeNull();
  });

  it.each([
    [1, "085"],
    [3, "007"],
    [14, "044"],
  ] as const)("names posture %i and its canonical three-digit number accessibly", (position, value) => {
    mountResults();
    const ball = resultBalls()[position - 1];
    const accessibleName = position + ".ª postura: número " + value;

    expect(ball.getAttribute("aria-label")).toBe(accessibleName);
    expect(within(resultsList()).getByRole("listitem", { name: accessibleName })).toBe(ball);
    expect(within(ball).getByTestId("home-result-value").textContent).toBe(value);
  });

  it("does not remount the list on an unchanged rerender and restarts it for a newer draw", () => {
    const { rerender } = mountResults();
    const originalList = resultsList();
    const originalFirstBall = resultBalls()[0];

    rerender(<HomeSections />);
    expect(resultsList()).toBe(originalList);
    expect(resultBalls()[0]).toBe(originalFirstBall);

    const newValues = latestDrawValues.map(() => "604");
    useProductMock.mockReturnValue({
      ...base,
      results: [...results, drawSnapshot({
        id: "new-night-published-snapshot",
        occurredAt: "2026-08-27T23:30:00.000Z",
        drawNumbers: newValues.map((value, index) => ({ position: index + 1, value })),
      })],
    });
    rerender(<HomeSections />);

    expect(resultsList()).not.toBe(originalList);
    expectBalls(newValues);
    expectMetadata("20:30", "27/08/2026");
  });

  it("retains 000 and pending postures in a newer partial snapshot without borrowing old numbers", () => {
    useProductMock.mockReturnValue({
      ...base,
      results: [...results, drawSnapshot({
        id: "latest-partial-night",
        occurredAt: "2026-08-26T23:35:00.000Z",
        drawNumbers: [{ position: 14, value: "44" }, { position: 3, value: "9" }, { position: 1, value: "000" }],
      })],
    });
    mountResults();

    const expectedValues = allPositions.map((position) => (
      position === 1 ? "000" : position === 3 ? "009" : position === 14 ? "044" : "—"
    ));
    const balls = expectBalls(expectedValues);
    expectPositionRanks(balls);
    expect(balls.filter((ball) => ball.getAttribute("data-pending") === "true")).toHaveLength(11);
    for (const position of allPositions) {
      const ball = balls[position - 1];
      const value = expectedValues[position - 1];
      const label = value === "—"
        ? position + ".ª postura: pendiente"
        : position + ".ª postura: número " + value;
      expect(ball.getAttribute("aria-label")).toBe(label);
      expect(ball.getAttribute("data-pending")).toBe(value === "—" ? "true" : "false");
    }
    expectMetadata("20:35");
  });

  it("keeps an explicit empty current snapshot as 14 pending balls", () => {
    const { rerender } = mountResults();
    expectBalls(latestDrawValues);
    useProductMock.mockReturnValue({
      ...base,
      results: [...results, drawSnapshot({
        id: "empty-current-night",
        occurredAt: "2026-08-26T23:40:00.000Z",
        drawNumbers: [],
      })],
    });

    rerender(<HomeSections />);

    const balls = expectBalls(allPositions.map(() => "—"));
    expectPositionRanks(balls);
    expect(balls.every((ball) => ball.getAttribute("data-pending") === "true")).toBe(true);
    expect(balls.map((ball) => ball.getAttribute("aria-label")))
      .toEqual(allPositions.map((position) => position + ".ª postura: pendiente"));
    expectMetadata("20:40");
  });

  it("accepts one legacy head but never assigns unpositioned legacy prizes to arbitrary postures", () => {
    useProductMock.mockReturnValue({
      ...base,
      results: [previousNight, {
        id: "legacy-current-head", source: "DRAW", gameId: "head", drawId: "nocturno",
        result: "7", occurredAt: "2026-08-26T23:30:00.000Z",
      }, {
        id: "legacy-current-prizes", source: "DRAW", gameId: "prizes", drawId: "quiniela-night",
        resultNumbers: ["222", "333", "444"], occurredAt: "2026-08-26T23:30:00.000Z",
      }],
    });
    mountResults();

    const balls = expectBalls(["007", ...allPositions.slice(1).map(() => "—")]);
    expect(balls[0].getAttribute("data-pending")).toBe("false");
    expect(balls.slice(1).every((ball) => ball.getAttribute("data-pending") === "true")).toBe(true);
    expect(within(resultsSection()).queryByText("222", { exact: true })).toBeNull();
    expect(within(resultsSection()).queryByText("333", { exact: true })).toBeNull();
    expect(within(resultsSection()).queryByText("444", { exact: true })).toBeNull();
    expectMetadata();
  });

  it.each<[string, MockResult[]]>([
    ["no publications", []],
    ["an unknown draw", [drawSnapshot({ drawId: "unmapped-draw" })]],
    ["only instant results", [drawSnapshot({ source: "INSTANT", gameId: "sapyaite" })]],
    ["only Mega Loto results", [drawSnapshot({ gameId: "megaloto" })]],
  ])("keeps an empty state instead of inventing a latest draw with %s", (_reason, publications) => {
    useProductMock.mockReturnValue({ ...base, results: publications });
    mountResults();

    expect(within(resultsSection()).queryByTestId("home-results-draw")).toBeNull();
    expect(within(resultsSection()).queryByTestId("home-results-balls")).toBeNull();
    expect(within(resultsSection()).queryAllByTestId("home-result-card")).toHaveLength(0);
    expect(within(resultsSection()).getByRole("status").textContent).toMatch(/Todavía|No hay|disponible/i);
  });

  it("retains a 14-ball loading skeleton and unavailable state without inventing results", () => {
    useProductMock.mockReturnValue({ ...base, catalog: null, results: [], loading: true });
    const { rerender } = mountResults();

    expect(resultsSection().getAttribute("aria-busy")).toBe("true");
    expect(within(resultsSection()).queryByTestId("home-results-balls")).toBeNull();
    expect(within(resultsSection()).queryAllByTestId("home-result-card")).toHaveLength(0);
    expect(within(resultsSection()).queryByTestId("home-results-draw")).toBeNull();
    expect(resultsSection().querySelectorAll('div[aria-hidden="true"] > span')).toHaveLength(14);

    useProductMock.mockReturnValue({ ...base, catalog: null, results: [], loading: false, error: "Unavailable" });
    rerender(<HomeSections />);

    expect(resultsSection().getAttribute("aria-busy")).toBe("false");
    expect(within(resultsSection()).getByRole("status").textContent).toContain("no están disponibles");
    expect(within(resultsSection()).queryByTestId("home-results-balls")).toBeNull();
    expect(within(resultsSection()).queryAllByTestId("home-result-card")).toHaveLength(0);
    expect(resultsSection().querySelectorAll('div[aria-hidden="true"] > span')).toHaveLength(0);
  });

  it.each(["preview", "backoffice"])("keeps sample labels out of the public results in %s mode", (gatewayMode) => {
    useProductMock.mockReturnValue({ ...base, gatewayMode });
    mountResults();

    expect(within(resultsSection()).queryByText(/muestra|demostración|demo/i)).toBeNull();
    expectBalls(latestDrawValues);
    expectMetadata();
  });
});

describe("HomeSections inline draw streaming", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:15:00.000Z"));
    useProductMock.mockReturnValue({
      catalog,
      results: [],
      loading: false,
      error: null,
      gatewayMode: "preview",
    });
  });

  function mountHome() {
    const view = render(<HomeSections />);
    act(() => vi.advanceTimersByTime(0));
    return view;
  }

  function activeDraw() {
    const cards = screen.getAllByTestId("home-draw-card");
    const active = cards.filter((card) => card.getAttribute("data-active") === "true");
    expect(active).toHaveLength(1);
    return active[0];
  }

  function nextDrawButton() {
    const button = screen.getByTestId("home-next-draw-action").closest("button");
    expect(button).not.toBeNull();
    expect(button).toBe(activeDraw());
    return button!;
  }

  function expectDrawAction(state: "play" | "collapse") {
    const action = screen.getByTestId("home-next-draw-action");
    const button = nextDrawButton();
    const icon = action.querySelector("svg");
    expect(action.tagName).toBe("SPAN");
    expect(action.textContent).toBe(state === "play" ? "Ver sorteo" : "Ocultar");
    expect(action.closest("button")).toBe(button);
    expect(action.querySelectorAll("svg")).toHaveLength(1);
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.getAttribute("focusable")).toBe("false");
    expect(icon?.getAttribute("data-state")).toBe(state);
    expect(button.querySelector('button, a, input, select, textarea, [role="button"], [role="link"]'))
      .toBeNull();
    return action;
  }

  function streamPanel() {
    return screen.getByTestId("home-draw-stream");
  }

  function expectAdvertisingPlayer() {
    const player = within(streamPanel()).getByTestId("draw-advertising-player") as HTMLIFrameElement;
    const frame = within(streamPanel()).getByTestId("draw-stream-frame");
    const source = player.getAttribute("src") ?? "";
    expect(player.tagName).toBe("IFRAME");
    expect(frame.getAttribute("data-stream-mode")).toBe("advertising");
    expect(frame.contains(player)).toBe(true);
    expect(source).toContain(`youtube-nocookie.com/embed/${advertisingVideoIds[0]}`);
    for (const videoId of advertisingVideoIds) expect(source).toContain(videoId);
    expect(source).toContain(`playlist=${advertisingVideoIds.join(",")}`);
    expect(player.getAttribute("title")).toBe("Publicidad de Quiniela");
    expect(within(streamPanel()).queryByTestId("draw-preview-video")).toBeNull();
    return player;
  }

  function expectPreviewLive(drawName: string) {
    const video = within(streamPanel()).getByTestId("draw-preview-video") as HTMLVideoElement;
    expect(within(streamPanel()).getByTestId("draw-stream-frame").getAttribute("data-stream-mode"))
      .toBe("live");
    expect(video.getAttribute("aria-label")).toBe(`Streaming de ${drawName}`);
    expect(within(streamPanel()).queryByTestId("draw-advertising-player")).toBeNull();
    return video;
  }

  function expectStreamCountdown(hours: string, minutes: string, seconds = "00") {
    const timer = within(streamPanel()).getByRole("timer");
    expect(timer).toBe(within(streamPanel()).getByTestId("draw-countdown"));
    expect(timer.getAttribute("aria-label"))
      .toBe(`Faltan ${hours} horas, ${minutes} minutos y ${seconds} segundos`);
    expect(timer.textContent).toBe(`${hours}:${minutes}:${seconds}`);
    return timer;
  }

  function expectDrawCountdown(compactTime: string, accessibleLabel: string) {
    const countdown = screen.getByTestId("home-draw-countdown");
    expect(countdown.tagName).toBe("TIME");
    expect(countdown.textContent).toBe(compactTime);
    expect(countdown.getAttribute("aria-label")).toBe(accessibleLabel);
    return countdown;
  }

  it("enables only the next of four draw cards without mounting a hidden video", () => {
    mountHome();

    const section = screen.getByTestId("home-draws-section");
    const cards = within(section).getAllByTestId("home-draw-card");
    const buttons = within(section).getAllByRole("button");
    const actions = within(section).getAllByTestId("home-next-draw-action");
    const action = actions[0];
    const countdown = expectDrawCountdown("01:15:00", "EN 01H 15M 00S");
    const button = nextDrawButton();

    expect(buttons).toHaveLength(4);
    expect(buttons).toEqual(cards);
    expect(within(section).queryAllByRole("link")).toHaveLength(0);
    expect(actions).toHaveLength(1);
    expect(expectDrawAction("play")).toBe(action);
    expect(button.contains(action)).toBe(true);
    expect(countdown.getAttribute("datetime")).toBe("2026-08-27T13:30:00.000Z");
    expect(countdown.parentElement).toBe(action.parentElement);
    expect(countdown.parentElement?.tagName).toBe("SPAN");
    expect(Array.from(countdown.parentElement!.children)).toEqual([countdown, action]);
    expect(section.querySelector("button button")).toBeNull();
    expect(within(section).getAllByRole("button", { name: /^Ver sorteo:/ })).toHaveLength(4);
    expect(screen.queryByTestId("home-next-draw-link")).toBeNull();
    expect(within(section).queryByText(/El próximo es|Ver transmisión/i)).toBeNull();

    for (const card of cards) {
      expect(card.tagName).toBe("BUTTON");
      expect(card.getAttribute("type")).toBe("button");
      expect(card.getAttribute("href")).toBeNull();
      expect(card.getAttribute("aria-expanded")).toBe("false");
      expect(card.getAttribute("aria-controls")).toBe("home-draw-stream");
      expect(card.getAttribute("aria-label")).toMatch(/^Ver sorteo:/);
      expect((card as HTMLButtonElement).disabled).toBe(card !== button);
    }
    for (const card of cards.filter((candidate) => candidate !== button)) {
      expect(within(card).queryByTestId("home-next-draw-action")).toBeNull();
      expect(within(card).queryByTestId("home-draw-countdown")).toBeNull();
      fireEvent.click(card);
    }
    expect(streamPanel().id).toBe("home-draw-stream");
    expect(streamPanel().hidden).toBe(true);
    expect(screen.queryByTestId("home-draw-stream-title")).toBeNull();
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    expect(screen.queryByTestId("draw-advertising-player")).toBeNull();
    expect(screen.queryByTestId("draw-stream-frame")).toBeNull();
  });

  it.each([
    ["09:15", "2026-08-27T12:15:00.000Z", "early", "Tempranero", "tempranero", "10:30", "2026-08-27T13:30:00.000Z"],
    ["11:00", "2026-08-27T14:00:00.000Z", "morning", "Matutino", "matutino", "13:00", "2026-08-27T16:00:00.000Z"],
    ["14:00", "2026-08-27T17:00:00.000Z", "evening", "Vespertino", "vespertino", "16:30", "2026-08-27T19:30:00.000Z"],
    ["18:00", "2026-08-27T21:00:00.000Z", "night", "Nocturno", "nocturno", "20:30", "2026-08-27T23:30:00.000Z"],
  ])("at %s in Paraguay opens advertising for the next scheduled draw on that calendar date", (_localTime, instant, id, label, slug, time, targetAt) => {
    vi.setSystemTime(new Date(instant));
    mountHome();

    const card = activeDraw();
    const button = nextDrawButton();
    const initialUrl = window.location.href;
    expect(card.getAttribute("data-draw-id")).toBe(id);
    expect(card.getAttribute("data-draw-slug")).toBe(slug);
    expect(card.textContent).toContain(time);
    expect(card.getAttribute("href")).toBeNull();
    expect(screen.getAllByTestId("home-draw-card").filter(
      (candidate) => !(candidate as HTMLButtonElement).disabled,
    )).toEqual([button]);
    expect(screen.getByRole("button", { name: new RegExp(`^Ver sorteo: ${label},`) })).toBe(button);
    expect(within(screen.getByTestId("home-draws-section")).queryByText(/Hora de Paraguay/i)).toBeNull();

    fireEvent.click(button);

    expect(streamPanel().hidden).toBe(false);
    expect(streamPanel().getAttribute("data-draw-target-at")).toBe(targetAt);
    expect(within(streamPanel()).getByRole("heading", { level: 3, name: label }))
      .toBe(screen.getByTestId("home-draw-stream-title"));
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-label")).toMatch(new RegExp(`^Ocultar sorteo: ${label},`));
    expect(screen.getByTestId("home-next-draw-action").textContent).toBe("Ocultar");
    expectAdvertisingPlayer();
    expect(streamPanel().querySelector("main")).toBeNull();
    expect(window.location.href).toBe(initialUrl);
  });

  it("updates the next draw on the one-second boundary without reloading Inicio", () => {
    vi.setSystemTime(new Date("2026-08-27T13:29:59.000Z"));
    mountHome();
    const previousCard = activeDraw();
    const previousAction = screen.getByTestId("home-next-draw-action");
    expect(previousCard.getAttribute("data-draw-id")).toBe("early");
    expect(nextDrawButton()).toBe(previousCard);
    expectDrawCountdown("00:00:01", "EN 00H 00M 01S");

    act(() => vi.advanceTimersByTime(999));
    expect(activeDraw().getAttribute("data-draw-id")).toBe("early");
    expect(screen.getByTestId("home-next-draw-action")).toBe(previousAction);

    act(() => vi.advanceTimersByTime(1));
    expect(activeDraw().getAttribute("data-draw-id")).toBe("morning");
    expectDrawCountdown("02:30:00", "EN 02H 30M 00S");
    expect(nextDrawButton().getAttribute("data-draw-id")).toBe("morning");
    expect((previousCard as HTMLButtonElement).disabled).toBe(true);
    expect((nextDrawButton() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId("home-draw-countdown").getAttribute("datetime"))
      .toBe("2026-08-27T16:00:00.000Z");
    expect(screen.getByTestId("home-next-draw-action")).not.toBe(previousAction);
    expect(within(previousCard).queryByTestId("home-next-draw-action")).toBeNull();
    expect(within(previousCard).queryByTestId("home-draw-countdown")).toBeNull();
    expect(previousCard.getAttribute("aria-label")).toMatch(/^Ver sorteo: Tempranero,/);
    expect(screen.getAllByTestId("home-next-draw-action")).toHaveLength(1);
    expect(within(screen.getByTestId("home-draws-section")).getAllByRole("button"))
      .toHaveLength(4);
  });

  it.each(["focus", "visibilitychange"])("refreshes a stale next draw when the page receives %s", (eventName) => {
    mountHome();
    expect(activeDraw().getAttribute("data-draw-id")).toBe("early");
    vi.setSystemTime(new Date("2026-08-27T14:00:00.000Z"));

    fireEvent(eventName === "focus" ? window : document, new Event(eventName));

    expect(activeDraw().getAttribute("data-draw-id")).toBe("morning");
    expect(nextDrawButton().getAttribute("data-draw-id")).toBe("morning");
    fireEvent.click(nextDrawButton());
    expect(streamPanel().getAttribute("data-draw-target-at"))
      .toBe("2026-08-27T16:00:00.000Z");
  });

  it("opens tomorrow's Tempranero after 20:30 and makes that date rollover visible", () => {
    vi.setSystemTime(new Date("2026-08-27T23:29:59.000Z"));
    mountHome();
    expect(activeDraw().getAttribute("data-draw-id")).toBe("night");

    act(() => vi.advanceTimersByTime(1_000));

    expect(activeDraw().getAttribute("data-draw-id")).toBe("early");
    expect(within(screen.getByTestId("home-draws-section")).getAllByText(/mañana/i).length)
      .toBeGreaterThan(0);
    expectDrawCountdown("14:00:00", "EN 14H 00M 00S");
    fireEvent.click(nextDrawButton());
    expect(streamPanel().getAttribute("data-draw-target-at"))
      .toBe("2026-08-28T13:30:00.000Z");
    expectStreamCountdown("14", "00");
  });

  it("takes operational times and the next draw from backoffice instead of the preview timetable", () => {
    vi.stubEnv("NEXT_PUBLIC_DRAW_STREAM_VESPERTINO_URL", "https://stream.example/vespertino");
    const operationalTimes: Record<string, string> = {
      early: "2026-08-27T15:45:00.000Z",
      morning: "2026-08-27T16:45:00.000Z",
      evening: "2026-08-27T12:40:00.000Z",
      night: "2026-08-27T23:45:00.000Z",
    };
    useProductMock.mockReturnValue({
      catalog: {
        ...catalog,
        draws: catalog.draws.map((draw) => ({ ...draw, drawsAt: operationalTimes[draw.id] })),
      },
      results: [],
      loading: false,
      error: null,
      gatewayMode: "backoffice",
    });
    mountHome();

    expect(activeDraw().getAttribute("data-draw-id")).toBe("evening");
    expect(activeDraw().textContent).toContain("09:40");
    expect(nextDrawButton().getAttribute("data-draw-id")).toBe("evening");
    const grid = screen.getByTestId("home-draw-grid");
    expect(within(grid).getByRole("button", { name: /^Ver sorteo: Tempranero,/ }).textContent)
      .toContain("12:45");
    expect(within(grid).queryByText("10:30")).toBeNull();

    fireEvent.click(nextDrawButton());

    expect(streamPanel().getAttribute("data-draw-target-at"))
      .toBe("2026-08-27T12:40:00.000Z");
    expectAdvertisingPlayer();
    expect(within(streamPanel()).queryByTitle("Streaming de Vespertino")).toBeNull();
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    expectStreamCountdown("00", "25");
  });

  it.each<[string, GamingCatalog | null]>([
    ["missing catalog", null],
    ["empty catalog", { ...catalog, draws: [] }],
    ["expired catalog", catalog],
  ])("does not invent a next backoffice draw with a %s", (_reason, remoteCatalog) => {
    useProductMock.mockReturnValue({
      catalog: remoteCatalog,
      results: [],
      loading: false,
      error: null,
      gatewayMode: "backoffice",
    });
    mountHome();

    expect(screen.queryByTestId("home-next-draw-action")).toBeNull();
    expect(screen.queryByTestId("home-draw-countdown")).toBeNull();
    expect(screen.queryAllByTestId("home-draw-card").some(
      (card) => card.getAttribute("data-active") === "true",
    )).toBe(false);
    expect(screen.getAllByTestId("home-draw-card").every(
      (card) => (card as HTMLButtonElement).disabled,
    )).toBe(true);
    expect(streamPanel().hidden).toBe(true);
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
  });

  it("toggles the selected stream off and mounts a fresh advertising player only when reopened", () => {
    mountHome();
    const button = nextDrawButton();
    const initialUrl = window.location.href;
    expect(streamPanel().hidden).toBe(true);
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();

    fireEvent.click(button);

    const firstPlayer = expectAdvertisingPlayer();
    expect(firstPlayer.getAttribute("allow")).toContain("autoplay");
    expect(firstPlayer.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(streamPanel().hidden).toBe(false);
    expectDrawAction("collapse");
    expectStreamCountdown("01", "15");
    expect(Array.from(streamPanel().children)).toEqual([
      screen.getByTestId("home-draw-stream-title").parentElement,
      screen.getByTestId("draw-stream-frame"),
      screen.getByTestId("draw-countdown"),
    ]);

    fireEvent.click(button);

    expect(streamPanel().hidden).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-label")).toMatch(/^Ver sorteo: Tempranero,/);
    expectDrawAction("play");
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    expect(screen.queryByTestId("draw-advertising-player")).toBeNull();
    expect(screen.queryByTestId("draw-countdown")).toBeNull();
    expect(screen.queryByTestId("home-draw-stream-title")).toBeNull();

    fireEvent.click(button);

    expect(streamPanel().hidden).toBe(false);
    expectDrawAction("collapse");
    expect(expectAdvertisingPlayer()).not.toBe(firstPlayer);
    expect(screen.getAllByTestId("draw-advertising-player")).toHaveLength(1);
    expect(window.location.href).toBe(initialUrl);
    expect(within(screen.getByTestId("home-draws-section")).queryAllByRole("link"))
      .toHaveLength(0);
  });

  it("blocks other cards and enables switching only when that draw becomes next", () => {
    mountHome();
    const earlyButton = nextDrawButton();
    const morningButton = screen.getByRole("button", { name: /^Ver sorteo: Matutino,/ });
    const panel = streamPanel();
    fireEvent.click(earlyButton);
    const earlyAdvertisingPlayer = expectAdvertisingPlayer();

    fireEvent.click(morningButton);

    expect((morningButton as HTMLButtonElement).disabled).toBe(true);
    expect(expectAdvertisingPlayer()).toBe(earlyAdvertisingPlayer);
    expect(within(panel).getByRole("heading", { name: "Tempranero" })).toBeTruthy();

    vi.setSystemTime(new Date("2026-08-27T14:00:00.000Z"));
    fireEvent.focus(window);
    expect((earlyButton as HTMLButtonElement).disabled).toBe(true);
    expect((morningButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(morningButton);

    expect(streamPanel()).toBe(panel);
    expect(panel.hidden).toBe(false);
    expect(panel.getAttribute("data-draw-target-at")).toBe("2026-08-27T16:00:00.000Z");
    expect(within(panel).getByRole("heading", { level: 3, name: "Matutino" })).toBeTruthy();
    expect(earlyButton.getAttribute("aria-expanded")).toBe("false");
    expect(morningButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByTestId("home-draw-card").filter(
      (card) => card.getAttribute("aria-expanded") === "true",
    )).toEqual([morningButton]);
    expect(screen.getAllByTestId("draw-advertising-player")).toHaveLength(1);
    expect(expectAdvertisingPlayer()).not.toBe(earlyAdvertisingPlayer);
    expectDrawAction("collapse");
    expectStreamCountdown("02", "00");
    expect(panel.querySelector("main")).toBeNull();

    fireEvent.click(morningButton);
    expect(panel.hidden).toBe(true);
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    expect(screen.queryByTestId("draw-advertising-player")).toBeNull();
  });

  it("keeps the panel open while switching advertising to preview LIVE and back at exact boundaries", () => {
    vi.setSystemTime(new Date("2026-08-27T13:19:59.000Z"));
    mountHome();
    const button = nextDrawButton();
    fireEvent.click(button);
    const panel = streamPanel();
    const firstAdvertisingPlayer = expectAdvertisingPlayer();
    const accessibleName = button.getAttribute("aria-label");
    expectStreamCountdown("00", "10", "01");

    act(() => vi.advanceTimersByTime(1_000));

    const video = expectPreviewLive("Tempranero");
    video.currentTime = 17;
    expect(firstAdvertisingPlayer.isConnected).toBe(false);
    expect(panel.hidden).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe(accessibleName);
    expectStreamCountdown("00", "10", "00");

    act(() => vi.advanceTimersByTime(10 * 60_000));

    expect(activeDraw().getAttribute("data-draw-id")).toBe("morning");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(nextDrawButton().getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByTestId("home-next-draw-action").textContent).toBe("Ver sorteo");
    expect(within(panel).queryByTestId("draw-countdown")).toBeNull();
    expect(expectPreviewLive("Tempranero")).toBe(video);
    expect(video.currentTime).toBe(17);
    expect(panel.getAttribute("data-draw-target-at")).toBe("2026-08-27T13:30:00.000Z");

    act(() => vi.advanceTimersByTime(29 * 60_000 + 59_000));
    expect(expectPreviewLive("Tempranero")).toBe(video);
    expect(panel.hidden).toBe(false);

    act(() => vi.advanceTimersByTime(1_000));

    const secondAdvertisingPlayer = expectAdvertisingPlayer();
    expect(secondAdvertisingPlayer).not.toBe(firstAdvertisingPlayer);
    expect(video.isConnected).toBe(false);
    expect(panel.hidden).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-label")).toMatch(/^Ocultar sorteo: Tempranero,/);
    expect(panel.getAttribute("data-draw-target-at")).toBe("2026-08-27T13:30:00.000Z");

    const closeButton = within(panel).getByRole("button", { name: "Cerrar sorteo de Tempranero" });
    closeButton.focus();
    fireEvent.click(closeButton);

    expect(panel.hidden).toBe(true);
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    expect(screen.queryByTestId("draw-advertising-player")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(nextDrawButton());
  });

  it("keeps backoffice without an authorized source free of preview video", () => {
    vi.setSystemTime(new Date("2026-08-27T13:25:00.000Z"));
    vi.stubEnv("NEXT_PUBLIC_DRAW_STREAM_TEMPRANERO_URL", "");
    useProductMock.mockReturnValue({
      catalog: buildGamingCatalog("REFUND", new Date("2026-08-27T12:15:00.000Z")),
      results: [],
      loading: false,
      error: null,
      gatewayMode: "backoffice",
    });
    mountHome();
    fireEvent.click(nextDrawButton());

    expect(within(streamPanel()).getByTestId("draw-stream-placeholder").textContent)
      .toBe("Transmisión no disponible");
    expect(within(streamPanel()).getByTestId("draw-stream-placeholder").getAttribute("data-stream-mode"))
      .toBe("live");
    expect(streamPanel().querySelector("iframe")).toBeNull();
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    expect(screen.queryByTestId("draw-advertising-player")).toBeNull();
  });

  it("updates a same-day operational time and switches ads to authorized LIVE without adopting tomorrow", () => {
    vi.stubEnv("NEXT_PUBLIC_DRAW_STREAM_TEMPRANERO_URL", "https://stream.example/tempranero");
    const sameDayCatalog = buildGamingCatalog("REFUND", new Date("2026-08-27T12:15:00.000Z"));
    const operationalState = {
      catalog: sameDayCatalog,
      results: [],
      loading: false,
      error: null,
      gatewayMode: "backoffice",
    };
    useProductMock.mockReturnValue(operationalState);
    const { rerender } = mountHome();
    const button = nextDrawButton();
    fireEvent.click(button);
    const initialAdvertisingPlayer = expectAdvertisingPlayer();
    expectStreamCountdown("01", "15");

    useProductMock.mockReturnValue({
      ...operationalState,
      catalog: {
        ...sameDayCatalog,
        draws: sameDayCatalog.draws.map((draw) => draw.id === "early"
          ? { ...draw, drawsAt: "2026-08-27T14:00:00.000Z" }
          : draw),
      },
    });
    rerender(<HomeSections />);

    expect(streamPanel().getAttribute("data-draw-target-at")).toBe("2026-08-27T14:00:00.000Z");
    expectStreamCountdown("01", "45");
    expect(expectAdvertisingPlayer()).toBe(initialAdvertisingPlayer);

    vi.setSystemTime(new Date("2026-08-27T13:50:00.000Z"));
    fireEvent.focus(window);

    const liveIframe = within(streamPanel()).getByTitle("Streaming de Tempranero");
    expect(liveIframe.tagName).toBe("IFRAME");
    expect(liveIframe.getAttribute("src")).toBe("https://stream.example/tempranero");
    expect(within(streamPanel()).getByTestId("draw-stream-frame").getAttribute("data-stream-mode"))
      .toBe("live");
    expect(screen.queryByTestId("draw-advertising-player")).toBeNull();
    expect(streamPanel().hidden).toBe(false);

    vi.setSystemTime(new Date("2026-08-27T14:30:00.000Z"));
    fireEvent.focus(window);

    const postLiveAdvertisingPlayer = expectAdvertisingPlayer();
    expect(postLiveAdvertisingPlayer).toBe(initialAdvertisingPlayer);
    expect(postLiveAdvertisingPlayer).toBe(liveIframe);
    expect(streamPanel().hidden).toBe(false);

    useProductMock.mockReturnValue({
      ...operationalState,
      catalog: buildGamingCatalog("REFUND", new Date("2026-08-28T12:15:00.000Z")),
    });
    rerender(<HomeSections />);

    expect(streamPanel().getAttribute("data-draw-target-at")).toBeNull();
    expect(within(streamPanel()).queryByTestId("draw-countdown")).toBeNull();
    expect(expectAdvertisingPlayer()).toBe(postLiveAdvertisingPlayer);
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();

    useProductMock.mockReturnValue({ ...operationalState, catalog: { ...sameDayCatalog, draws: [] } });
    rerender(<HomeSections />);

    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(expectAdvertisingPlayer()).toBe(postLiveAdvertisingPlayer);
    fireEvent.click(button);
    expect(streamPanel().hidden).toBe(false);
    const closeButton = within(streamPanel()).getByRole("button", { name: "Cerrar sorteo de Tempranero" });
    closeButton.focus();
    fireEvent.click(closeButton);
    expect(streamPanel().hidden).toBe(true);
    expect(screen.queryByTitle("Streaming de Tempranero")).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId("home-draws-section"));
  });

  it("keeps a single interval in StrictMode and releases it on unmount", () => {
    const setInterval = vi.spyOn(window, "setInterval");
    const clearInterval = vi.spyOn(window, "clearInterval");
    const { unmount } = render(<StrictMode><HomeSections /></StrictMode>);
    act(() => vi.advanceTimersByTime(0));

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
