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
const resultsCatalog: GamingCatalog = {
  ...catalog,
  draws: [
    ...catalog.draws,
    { ...catalog.draws.find((draw) => draw.id === "night")!, id: "quiniela-night", label: "Nocturno" },
    { ...catalog.draws.find((draw) => draw.id === "evening")!, id: "quiniela-evening", label: "Vespertino" },
  ],
};
const latestDrawValues = [
  "497", "208", "000", "731", "112", "005", "830",
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
});

describe("HomeSections latest draw results", () => {
  const base = { catalog: resultsCatalog, results, loading: false, error: null, gatewayMode: "backoffice" };

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

  function resultCards() {
    return within(screen.getByRole("tabpanel")).getAllByTestId("home-result-card");
  }

  function expectCards(positions: readonly number[], values: readonly string[]) {
    const cards = resultCards();
    expect(cards.map((card) => Number(card.getAttribute("data-position")))).toEqual(positions);
    expect(cards.map((card) => within(card).getByTestId("home-result-value").textContent))
      .toEqual(values);
    return cards;
  }

  function expectPositionRanks(cards: readonly HTMLElement[]) {
    const ranksByPosition: Record<number, string> = { 1: "gold", 2: "silver", 3: "bronze" };
    for (const card of cards) {
      const position = Number(card.getAttribute("data-position"));
      const expectedRank = ranksByPosition[position];
      const icons = within(card).queryAllByTestId("home-result-rank");
      expect(within(card).getByText(`POSICIÓN ${position}`, { exact: true })).toBeTruthy();
      expect(icons).toHaveLength(expectedRank ? 1 : 0);
      if (!expectedRank) continue;

      expect(icons[0].tagName.toLowerCase()).toBe("svg");
      expect(icons[0].getAttribute("data-rank")).toBe(expectedRank);
      expect(icons[0].getAttribute("aria-hidden")).toBe("true");
      expect(icons[0].getAttribute("focusable")).toBe("false");
    }
  }

  function expectMetadata(time = "20:30") {
    const metadata = within(resultsSection()).getAllByTestId("home-results-draw");
    expect(metadata).toHaveLength(1);
    expect(metadata[0].textContent).toContain("Nocturno");
    expect(metadata[0].textContent).toContain("26/08/2026");
    expect(metadata[0].textContent).toContain(time);
  }

  function expectCarousel(modality: "prizes" | "redoblona" | "invert", label: string) {
    const panel = screen.getByRole("tabpanel");
    const carousels = within(panel).getAllByTestId("home-results-carousel");
    expect(carousels).toHaveLength(1);
    const track = within(carousels[0]).getByTestId("home-results-carousel-track");
    expect(within(panel).getByRole("group", { name: `Resultados de ${label}` })).toBe(track);
    expect(track.getAttribute("aria-roledescription")).toBe("carrusel");
    expect(track.getAttribute("data-modality")).toBe(modality);
    expect(track.tabIndex).toBe(0);
    expect(within(track).getAllByTestId("home-result-card")).toEqual(resultCards());
    for (const name of ["Ver resultados anteriores", "Ver resultados siguientes"]) {
      expect(within(carousels[0]).getByRole("button", { name }).getAttribute("aria-controls"))
        .toBe(track.id);
    }
    return track;
  }

  const prizePositions = Array.from({ length: 13 }, (_, index) => index + 2);
  const allPositions = Array.from({ length: 14 }, (_, index) => index + 1);

  it("shows only the latest named draw and its canonical head rather than mixed history", () => {
    mountResults();

    expect(within(screen.getByTestId("home-draw-grid")).getAllByRole("button")).toHaveLength(4);
    expect(within(resultsSection()).getByRole("heading", { name: "Últimos resultados publicados" })).toBeTruthy();
    expectCards([1], ["497"]);
    expectMetadata();
    expect(screen.queryByText("Resultados de muestra")).toBeNull();
    expect(within(resultsSection()).queryByText("Vespertino")).toBeNull();
    for (const excludedValue of ["666", "777", "999", "998", "997"]) {
      expect(within(resultsSection()).queryByText(excludedValue, { exact: true })).toBeNull();
    }
    expect(within(resultsSection()).queryByRole("button", { name: "Ver más resultados" })).toBeNull();
    expect(within(resultsSection()).getByRole("link", { name: /Ver todos/i }).getAttribute("href"))
      .toBe("/resultados");
  });

  it.each([
    ["A LA CABEZA", [1], ["497"], ["gold"]],
    ["A LOS PREMIOS", prizePositions, latestDrawValues.slice(1), ["silver", "bronze"]],
    ["REDOBLONA", prizePositions, latestDrawValues.slice(1).map((value) => value.slice(-2)), ["silver", "bronze"]],
    ["INVERTIDA", allPositions, latestDrawValues, ["gold", "silver", "bronze"]],
  ] as const)("decorates actual podium positions in %s without ranking by visible card index", (tabName, positions, values, ranks) => {
    mountResults();
    fireEvent.click(screen.getByRole("tab", { name: tabName }));
    const cards = expectCards(positions, values);

    expectPositionRanks(cards);
    expect(within(screen.getByRole("tabpanel")).getAllByTestId("home-result-rank")
      .map((icon) => icon.getAttribute("data-rank"))).toEqual(ranks);
    expectMetadata();
  });

  it.each([
    ["A LA CABEZA", 1, "Posición 1: número 497"],
    ["A LOS PREMIOS", 3, "Posición 3: número 000"],
    ["A LOS PREMIOS", 14, "Posición 14: número 044"],
    ["REDOBLONA", 2, "Posición 2: terminación 08, del número 208"],
    ["REDOBLONA", 3, "Posición 3: terminación 00, del número 000"],
    ["REDOBLONA", 14, "Posición 14: terminación 44, del número 044"],
    ["INVERTIDA", 3, "Posición 3: número 000; combinaciones 000"],
    ["INVERTIDA", 6, "Posición 6: número 005; combinaciones 005, 050, 500"],
    ["INVERTIDA", 14, "Posición 14: número 044; combinaciones 044, 404, 440"],
  ] as const)("names %s position %i accessibly when its visual details are compact", (tabName, position, accessibleName) => {
    mountResults();
    fireEvent.click(screen.getByRole("tab", { name: tabName }));
    const card = resultCards().find((candidate) => candidate.getAttribute("data-position") === String(position));

    expect(card?.getAttribute("aria-label")).toBe(accessibleName);
    expect(within(screen.getByRole("tabpanel")).getByRole("article", { name: accessibleName })).toBe(card);
  });

  it("derives all four tabs from the same 14 positioned numbers with zeroes and unique permutations", () => {
    mountResults();
    expectCards([1], ["497"]);
    expect(screen.queryByTestId("home-results-carousel")).toBeNull();
    expect(screen.queryByTestId("home-results-carousel-track")).toBeNull();
    expect(screen.queryByTestId("home-results-previous")).toBeNull();
    expect(screen.queryByTestId("home-results-next")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "A LOS PREMIOS" }));
    expectCards(prizePositions, latestDrawValues.slice(1));
    expectCarousel("prizes", "A LOS PREMIOS");
    expectMetadata();

    fireEvent.click(screen.getByRole("tab", { name: "REDOBLONA" }));
    const redoblonaCards = expectCards(prizePositions, latestDrawValues.slice(1).map((value) => value.slice(-2)));
    const redoblonaTrack = expectCarousel("redoblona", "REDOBLONA");
    expect(screen.getAllByTestId("home-redoblona-head")).toHaveLength(1);
    expect(screen.getByTestId("home-redoblona-head").textContent).toContain("497");
    expect(redoblonaTrack.contains(screen.getByTestId("home-redoblona-head"))).toBe(false);
    for (const [index, card] of redoblonaCards.entries()) {
      expect(card.textContent).toContain(`Del número ${latestDrawValues[index + 1]}`);
    }
    expectMetadata();

    fireEvent.click(screen.getByRole("tab", { name: "INVERTIDA" }));
    const invertedCards = expectCards(allPositions, latestDrawValues);
    expectCarousel("invert", "INVERTIDA");
    expect(screen.queryByTestId("home-redoblona-head")).toBeNull();
    const expectedCombinations = new Map([
      [1, ["497", "479", "947", "974", "749", "794"]],
      [3, ["000"]],
      [5, ["112", "121", "211"]],
      [6, ["005", "050", "500"]],
      [12, ["888"]],
      [14, ["044", "404", "440"]],
    ]);
    for (const [position, expected] of expectedCombinations) {
      const combinations = within(invertedCards[position - 1]).getByTestId("home-result-combinations")
        .textContent?.match(/\d{3}/g) ?? [];
      expect(new Set(combinations)).toEqual(new Set(expected));
      expect(combinations).toHaveLength(expected.length);
    }
    expectMetadata();

    fireEvent.click(screen.getByRole("tab", { name: "A LA CABEZA" }));
    expectCards([1], ["497"]);
    expect(screen.queryByTestId("home-results-carousel")).toBeNull();
    expect(screen.queryByTestId("home-results-previous")).toBeNull();
    expect(screen.queryByTestId("home-results-next")).toBeNull();
    expectMetadata();
  });

  it("keeps carousel keyboard navigation separate from modality selection", () => {
    mountResults();
    fireEvent.click(screen.getByRole("tab", { name: "A LOS PREMIOS" }));
    const track = expectCarousel("prizes", "A LOS PREMIOS");
    Object.defineProperties(track, {
      clientWidth: { configurable: true, value: 340 },
      scrollWidth: { configurable: true, value: 1_576 },
      scrollBy: { configurable: true, value: vi.fn() },
      scrollTo: { configurable: true, value: vi.fn() },
    });
    track.focus();

    for (const key of ["ArrowRight", "ArrowLeft", "End", "Home"]) {
      fireEvent.keyDown(track, { key });
      expect(screen.getByRole("tab", { name: "A LOS PREMIOS" }).getAttribute("aria-selected"))
        .toBe("true");
      expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby"))
        .toBe("home-results-tab-prizes");
      expect(screen.getByTestId("home-results-carousel-track")).toBe(track);
      expect(document.activeElement).toBe(track);
      expectCards(prizePositions, latestDrawValues.slice(1));
    }
  });

  it("starts a fresh carousel when changing modality or the latest published draw", () => {
    const { rerender } = mountResults();
    fireEvent.click(screen.getByRole("tab", { name: "A LOS PREMIOS" }));
    const firstPrizesTrack = expectCarousel("prizes", "A LOS PREMIOS");
    firstPrizesTrack.scrollLeft = 240;

    fireEvent.click(screen.getByRole("tab", { name: "REDOBLONA" }));
    const redoblonaTrack = expectCarousel("redoblona", "REDOBLONA");
    expect(redoblonaTrack).not.toBe(firstPrizesTrack);
    expect(redoblonaTrack.scrollLeft).toBe(0);
    redoblonaTrack.scrollLeft = 480;

    fireEvent.click(screen.getByRole("tab", { name: "A LOS PREMIOS" }));
    const secondPrizesTrack = expectCarousel("prizes", "A LOS PREMIOS");
    expect(secondPrizesTrack).not.toBe(firstPrizesTrack);
    expect(secondPrizesTrack).not.toBe(redoblonaTrack);
    expect(secondPrizesTrack.scrollLeft).toBe(0);
    secondPrizesTrack.scrollLeft = 240;

    vi.setSystemTime(new Date("2026-08-28T12:15:00.000Z"));
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

    const newDrawTrack = expectCarousel("prizes", "A LOS PREMIOS");
    expect(newDrawTrack).not.toBe(secondPrizesTrack);
    expect(newDrawTrack.scrollLeft).toBe(0);
    expect(screen.getByRole("tab", { name: "A LOS PREMIOS" }).getAttribute("aria-selected"))
      .toBe("true");
    expectCards(prizePositions, newValues.slice(1));
    expect(screen.getByTestId("home-results-draw").textContent).toContain("27/08/2026");
    expect(screen.getAllByTestId("home-results-draw")).toHaveLength(1);
  });

  it("preserves keyboard tab semantics while the selected draw remains unchanged", () => {
    mountResults();
    const head = screen.getByRole("tab", { name: "A LA CABEZA" });
    const prizes = screen.getByRole("tab", { name: "A LOS PREMIOS" });
    const redoblona = screen.getByRole("tab", { name: "REDOBLONA" });
    const inverted = screen.getByRole("tab", { name: "INVERTIDA" });
    expect(screen.getByRole("tabpanel").id).toBe("home-results-grid");

    fireEvent.keyDown(head, { key: "ArrowRight" });
    expect(prizes.getAttribute("aria-selected")).toBe("true");
    expect(prizes.getAttribute("aria-controls")).toBe("home-results-grid");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(prizes.id);
    expect(document.activeElement).toBe(prizes);
    expectCards(prizePositions, latestDrawValues.slice(1));

    fireEvent.keyDown(prizes, { key: "ArrowRight" });
    expect(redoblona.getAttribute("aria-selected")).toBe("true");
    expectCards(prizePositions, latestDrawValues.slice(1).map((value) => value.slice(-2)));
    fireEvent.keyDown(redoblona, { key: "End" });
    expect(inverted.getAttribute("aria-selected")).toBe("true");
    expectCards(allPositions, latestDrawValues);
    fireEvent.keyDown(inverted, { key: "Home" });
    expect(head.getAttribute("aria-selected")).toBe("true");
    expectCards([1], ["497"]);
    expectMetadata();
  });

  it("retains 000 and pending positions in a newer partial snapshot without borrowing old numbers", () => {
    useProductMock.mockReturnValue({
      ...base,
      results: [...results, drawSnapshot({
        id: "latest-partial-night",
        occurredAt: "2026-08-26T23:35:00.000Z",
        drawNumbers: [{ position: 14, value: "44" }, { position: 3, value: "9" }, { position: 1, value: "000" }],
      })],
    });
    mountResults();
    expectCards([1], ["000"]);
    expect(within(screen.getByRole("tabpanel")).getByRole("article", { name: "Posición 1: número 000" }))
      .toBe(resultCards()[0]);
    expectMetadata("20:35");

    fireEvent.click(screen.getByRole("tab", { name: "A LOS PREMIOS" }));
    const cards = expectCards(prizePositions, prizePositions.map((position) => position === 3 ? "009" : position === 14 ? "044" : "—"));
    expectPositionRanks(cards);
    expect(within(cards[0]).getByText("Pendiente")).toBeTruthy();
    expect(within(screen.getByRole("tabpanel")).getAllByText("Pendiente")).toHaveLength(11);
    expect(within(screen.getByRole("tabpanel")).getByRole("article", { name: "Posición 2: pendiente" })).toBe(cards[0]);
    expect(within(screen.getByRole("tabpanel")).getByRole("article", { name: "Posición 3: número 009" })).toBe(cards[1]);
    expect(within(screen.getByRole("tabpanel")).getByRole("article", { name: "Posición 14: número 044" })).toBe(cards[12]);

    fireEvent.click(screen.getByRole("tab", { name: "REDOBLONA" }));
    expectCards(prizePositions, prizePositions.map((position) => position === 3 ? "09" : position === 14 ? "44" : "—"));
    expect(screen.getByTestId("home-redoblona-head").textContent).toContain("000");
    expect(resultCards()[1].textContent).toContain("Del número 009");

    fireEvent.click(screen.getByRole("tab", { name: "INVERTIDA" }));
    const invertedCards = expectCards(allPositions, allPositions.map((position) => position === 1 ? "000" : position === 3 ? "009" : position === 14 ? "044" : "—"));
    expectPositionRanks(invertedCards);
    expect(within(invertedCards[0]).getByTestId("home-result-combinations").textContent).toBe("000");
    expect(within(invertedCards[1]).queryByTestId("home-result-combinations")?.textContent?.match(/\d{3}/g) ?? [])
      .toEqual([]);
    expectMetadata("20:35");
  });

  it("clears every modality when the current draw publishes an explicit empty snapshot", () => {
    const { rerender } = mountResults();
    fireEvent.click(screen.getByRole("tab", { name: "A LOS PREMIOS" }));
    expectCards(prizePositions, latestDrawValues.slice(1));
    useProductMock.mockReturnValue({
      ...base,
      results: [...results, drawSnapshot({
        id: "empty-current-night",
        occurredAt: "2026-08-26T23:40:00.000Z",
        drawNumbers: [],
      })],
    });
    rerender(<HomeSections />);
    expect(screen.getByRole("tab", { name: "A LOS PREMIOS" }).getAttribute("aria-selected")).toBe("true");

    for (const [tabName, positions] of [
      ["A LA CABEZA", [1]],
      ["A LOS PREMIOS", prizePositions],
      ["REDOBLONA", prizePositions],
      ["INVERTIDA", allPositions],
    ] as const) {
      fireEvent.click(screen.getByRole("tab", { name: tabName }));
      const cards = expectCards(positions, positions.map(() => "—"));
      expectPositionRanks(cards);
      for (const card of cards) {
        expect(within(card).getByText("Pendiente")).toBeTruthy();
        expect(within(screen.getByRole("tabpanel")).getByRole("article", {
          name: `Posición ${card.getAttribute("data-position")}: pendiente`,
        })).toBe(card);
      }
      expectMetadata("20:40");
    }
  });

  it("accepts an explicit legacy head but never assigns unpositioned legacy prizes to arbitrary positions", () => {
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
    expectCards([1], ["007"]);
    expectMetadata();
    fireEvent.click(screen.getByRole("tab", { name: "A LOS PREMIOS" }));
    expectCards(prizePositions, prizePositions.map(() => "—"));
    expect(within(screen.getByRole("tabpanel")).getAllByText("Pendiente")).toHaveLength(13);
    fireEvent.click(screen.getByRole("tab", { name: "REDOBLONA" }));
    expectCards(prizePositions, prizePositions.map(() => "—"));
    expect(screen.getByTestId("home-redoblona-head").textContent).toContain("007");
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
    expect(within(resultsSection()).queryAllByTestId("home-result-card")).toHaveLength(0);
    expect(within(resultsSection()).getByRole("status").textContent).toMatch(/Todavía|No hay|disponible/i);
  });

  it("retains loading and unavailable states without inventing results", () => {
    useProductMock.mockReturnValue({ ...base, catalog: null, results: [], loading: true });
    const { rerender } = mountResults();
    expect(resultsSection().getAttribute("aria-busy")).toBe("true");
    expect(screen.queryAllByTestId("home-result-card")).toHaveLength(0);
    expect(screen.queryByTestId("home-results-draw")).toBeNull();

    useProductMock.mockReturnValue({ ...base, catalog: null, results: [], loading: false, error: "Unavailable" });
    rerender(<HomeSections />);
    expect(resultsSection().getAttribute("aria-busy")).toBe("false");
    expect(within(resultsSection()).getByRole("status").textContent).toContain("no están disponibles");
    expect(screen.queryAllByTestId("home-result-card")).toHaveLength(0);
  });

  it.each(["preview", "backoffice"])("keeps sample labels out of the public results in %s mode", (gatewayMode) => {
    useProductMock.mockReturnValue({ ...base, gatewayMode });
    mountResults();
    expect(within(resultsSection()).queryByText(/muestra|demostración|demo/i)).toBeNull();
    expectCards([1], ["497"]);
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

  it("offers four inline toggle buttons and one next-draw action without mounting a hidden video", () => {
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
    }
    for (const card of cards.filter((candidate) => candidate !== button)) {
      expect(within(card).queryByTestId("home-next-draw-action")).toBeNull();
      expect(within(card).queryByTestId("home-draw-countdown")).toBeNull();
    }
    expect(streamPanel().id).toBe("home-draw-stream");
    expect(streamPanel().hidden).toBe(true);
    expect(screen.queryByTestId("home-draw-stream-title")).toBeNull();
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    expect(screen.queryByTestId("draw-stream-frame")).toBeNull();
  });

  it.each([
    ["09:15", "2026-08-27T12:15:00.000Z", "early", "Tempranero", "tempranero", "10:30", "2026-08-27T13:30:00.000Z"],
    ["11:00", "2026-08-27T14:00:00.000Z", "morning", "Matutino", "matutino", "13:00", "2026-08-27T16:00:00.000Z"],
    ["14:00", "2026-08-27T17:00:00.000Z", "evening", "Vespertino", "vespertino", "16:30", "2026-08-27T19:30:00.000Z"],
    ["18:00", "2026-08-27T21:00:00.000Z", "night", "Nocturno", "nocturno", "20:30", "2026-08-27T23:30:00.000Z"],
  ])("at %s in Paraguay opens the next scheduled draw inline for that calendar date", (_localTime, instant, id, label, slug, time, targetAt) => {
    vi.setSystemTime(new Date(instant));
    mountHome();

    const card = activeDraw();
    const button = nextDrawButton();
    const initialUrl = window.location.href;
    expect(card.getAttribute("data-draw-id")).toBe(id);
    expect(card.getAttribute("data-draw-slug")).toBe(slug);
    expect(card.textContent).toContain(time);
    expect(card.getAttribute("href")).toBeNull();
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
    expect(screen.getByTestId("draw-preview-video").getAttribute("aria-label"))
      .toBe(`Streaming de ${label}`);
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
    const iframe = within(streamPanel()).getByTitle("Streaming de Vespertino");
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.getAttribute("src")).toBe("https://stream.example/vespertino");
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
    expect(streamPanel().hidden).toBe(true);
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
  });

  it("toggles the selected stream off and mounts a fresh player only when reopened", () => {
    mountHome();
    const button = nextDrawButton();
    const initialUrl = window.location.href;
    expect(streamPanel().hidden).toBe(true);
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();

    fireEvent.click(button);

    const firstVideo = screen.getByTestId("draw-preview-video") as HTMLVideoElement;
    expect(firstVideo.getAttribute("src")).toBe("/assets/video/quinie-streaming-simulado.mp4");
    expect(firstVideo.autoplay).toBe(true);
    expect(firstVideo.muted).toBe(true);
    expect(firstVideo.loop).toBe(true);
    expect(firstVideo.playsInline).toBe(true);
    expect(firstVideo.controls).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(streamPanel().hidden).toBe(false);
    expectDrawAction("collapse");
    expectStreamCountdown("01", "15");
    expect(Array.from(streamPanel().children)).toEqual([
      screen.getByTestId("home-draw-stream-title"),
      screen.getByTestId("draw-stream-frame"),
      screen.getByTestId("draw-countdown"),
    ]);

    fireEvent.click(button);

    expect(streamPanel().hidden).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-label")).toMatch(/^Ver sorteo: Tempranero,/);
    expectDrawAction("play");
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    expect(screen.queryByTestId("draw-countdown")).toBeNull();
    expect(screen.queryByTestId("home-draw-stream-title")).toBeNull();

    fireEvent.click(button);

    expect(streamPanel().hidden).toBe(false);
    expectDrawAction("collapse");
    expect(screen.getByTestId("draw-preview-video")).not.toBe(firstVideo);
    expect(screen.getAllByTestId("draw-preview-video")).toHaveLength(1);
    expect(window.location.href).toBe(initialUrl);
    expect(within(screen.getByTestId("home-draws-section")).queryAllByRole("link"))
      .toHaveLength(0);
  });

  it("switches to another card inside the same panel and expands only the selected draw", () => {
    mountHome();
    const earlyButton = nextDrawButton();
    const morningButton = screen.getByRole("button", { name: /^Ver sorteo: Matutino,/ });
    const panel = streamPanel();
    fireEvent.click(earlyButton);
    const earlyVideo = screen.getByTestId("draw-preview-video");

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
    expect(screen.getAllByTestId("draw-preview-video")).toHaveLength(1);
    expect(screen.getByTestId("draw-preview-video")).not.toBe(earlyVideo);
    expect(screen.getByTestId("draw-preview-video").getAttribute("aria-label"))
      .toBe("Streaming de Matutino");
    expectDrawAction("play");
    expectStreamCountdown("03", "45");
    expect(panel.querySelector("main")).toBeNull();

    fireEvent.click(morningButton);
    expect(panel.hidden).toBe(true);
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
  });

  it("keeps the selected video and date through clock ticks, zero and the next day until that card closes it", () => {
    vi.setSystemTime(new Date("2026-08-27T13:29:58.000Z"));
    mountHome();
    const button = nextDrawButton();
    fireEvent.click(button);
    const video = screen.getByTestId("draw-preview-video") as HTMLVideoElement;
    const accessibleName = button.getAttribute("aria-label");
    video.currentTime = 17;
    expectStreamCountdown("00", "00", "02");

    act(() => vi.advanceTimersByTime(1_000));
    expectStreamCountdown("00", "00", "01");
    expect(screen.getByTestId("draw-preview-video")).toBe(video);
    expect(video.currentTime).toBe(17);
    expect(button.getAttribute("aria-label")).toBe(accessibleName);

    act(() => vi.advanceTimersByTime(999));
    expectStreamCountdown("00", "00", "01");
    act(() => vi.advanceTimersByTime(1));

    expect(activeDraw().getAttribute("data-draw-id")).toBe("morning");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-label")).toMatch(/^Ocultar sorteo: Tempranero,/);
    expect(nextDrawButton().getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByTestId("home-next-draw-action").textContent).toBe("Ver sorteo");
    expect(within(streamPanel()).queryByTestId("draw-countdown")).toBeNull();
    expect(within(streamPanel()).queryByRole("status")).toBeNull();
    expect(screen.getByTestId("draw-preview-video")).toBe(video);
    expect(video.currentTime).toBe(17);
    expect(streamPanel().getAttribute("data-draw-target-at")).toBe("2026-08-27T13:30:00.000Z");

    vi.setSystemTime(new Date("2026-08-28T12:00:00.000Z"));
    fireEvent.focus(window);

    expect(streamPanel().getAttribute("data-draw-target-at")).toBe("2026-08-27T13:30:00.000Z");
    expect(within(streamPanel()).queryByTestId("draw-countdown")).toBeNull();
    expect(screen.getByTestId("draw-preview-video")).toBe(video);
    expect(video.currentTime).toBe(17);
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(button);

    expect(streamPanel().hidden).toBe(true);
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps backoffice without an authorized source free of preview video", () => {
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
    expect(streamPanel().querySelector("iframe")).toBeNull();
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();
  });

  it("updates a same-day operational time without reloading its iframe or adopting tomorrow's schedule", () => {
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
    const iframe = within(streamPanel()).getByTitle("Streaming de Tempranero");
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
    expect(within(streamPanel()).getByTitle("Streaming de Tempranero")).toBe(iframe);

    useProductMock.mockReturnValue({
      ...operationalState,
      catalog: buildGamingCatalog("REFUND", new Date("2026-08-28T12:15:00.000Z")),
    });
    rerender(<HomeSections />);

    expect(streamPanel().getAttribute("data-draw-target-at")).toBeNull();
    expect(within(streamPanel()).queryByTestId("draw-countdown")).toBeNull();
    expect(within(streamPanel()).getByTitle("Streaming de Tempranero")).toBe(iframe);
    expect(screen.queryByTestId("draw-preview-video")).toBeNull();

    useProductMock.mockReturnValue({ ...operationalState, catalog: { ...sameDayCatalog, draws: [] } });
    rerender(<HomeSections />);

    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(within(streamPanel()).getByTitle("Streaming de Tempranero")).toBe(iframe);
    fireEvent.click(button);
    expect(streamPanel().hidden).toBe(true);
    expect(screen.queryByTitle("Streaming de Tempranero")).toBeNull();
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
