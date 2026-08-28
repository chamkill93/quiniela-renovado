// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGamingCatalog } from "@/lib/gaming/catalog";

const { useProductMock } = vi.hoisted(() => ({ useProductMock: vi.fn() }));
vi.mock("@/providers/product-provider", () => ({ useProduct: useProductMock }));
import { ResultsClient } from "@/features/product/results-client";

const catalog = buildGamingCatalog("REFUND", new Date("2026-08-27T12:00:00Z"));
const orderedPostureValues = ["007", "000", "007", "014", "090", "123", "456", "789", "005", "032", "678", "900", "019", "042"];
const base = {
  catalog, session: { id: "session" }, loading: false, error: null, unauthorized: false, refresh: vi.fn(), gatewayMode: "preview",
  results: [
    { id: "head", source: "DRAW", gameId: "head", drawId: "early", result: "007", occurredAt: "2026-08-26T13:30:00Z" },
    { id: "prizes", source: "DRAW", gameId: "prizes", drawId: "early", resultNumbers: ["001", "002", "003", "004", "005", "006", "007"], occurredAt: "2026-08-26T13:31:00Z" },
    { id: "instant", source: "INSTANT", gameId: "sapyaite", result: "999", occurredAt: "2026-08-26T13:32:00Z" },
  ],
};
afterEach(cleanup);
beforeEach(() => {
  useProductMock.mockReturnValue(base);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

function openDrawPostures(label = "Tempranero") {
  fireEvent.click(screen.getByRole("button", { name: `Ver todos los números de ${label}` }));
  const panel = screen.getByRole("region", { name: `Posturas de ${label}` });
  const carousel = within(panel).getByRole("list", { name: `Números de ${label}` });
  return { panel, carousel };
}

function shownPostureNumbers(carousel: HTMLElement) {
  return within(carousel).getAllByTestId("draw-posture-number").map((number) => number.textContent);
}

describe("ResultsClient daily grid", () => {
  it.each(["preview", "backoffice"])("shows only the Results title without helper copy in %s mode", (gatewayMode) => {
    useProductMock.mockReturnValue({ ...base, gatewayMode });
    render(<ResultsClient />);
    const heading = screen.getByRole("heading", { name: "Resultados", level: 1 });
    expect(heading.closest("header")?.textContent).toBe("Resultados");
    expect(screen.queryByText("Sorteos diarios")).toBeNull();
    expect(screen.queryByText("Los cuatro sorteos de cada día, ordenados por fecha.")).toBeNull();
    expect(screen.queryByText(/Fechas y horas de Paraguay|Resultados de muestra/)).toBeNull();
  });

  it("renders four named slots with individual icons, statuses and a primary head number", () => {
    render(<ResultsClient />);
    const day = screen.getByTestId("results-day");
    const cards = within(day).getAllByTestId("daily-draw-card");
    expect(cards.map((card) => card.getAttribute("data-draw-id"))).toEqual(["early", "morning", "evening", "night"]);
    expect(within(day).getAllByRole("img")).toHaveLength(4);
    expect(within(day).getByTestId("daily-draw-number").textContent).toBe("007");
    expect(within(day).getAllByText("Sin publicar")).toHaveLength(3);
    for (const card of cards.slice(1)) {
      expect(within(card).queryByTestId("daily-draw-toggle")).toBeNull();
      expect(within(card).queryByTestId("daily-draw-number")).toBeNull();
    }
    expect(screen.queryByTestId("draw-postures-panel")).toBeNull();
    expect(within(day).queryByText("999")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Sapy’aite" })).toBeNull();
  });
  it("opens one carousel of 14 ordered postures with ranked crowns, preserving zeroes and repeated numbers", () => {
    const drawNumbers = orderedPostureValues.map((value, index) => ({ position: index + 1, value })).reverse();
    useProductMock.mockReturnValue({
      ...base,
      results: base.results.map((publication) => publication.source === "DRAW" ? { ...publication, drawNumbers } : publication),
    });
    render(<ResultsClient />);
    const toggle = screen.getByRole("button", { name: "Ver todos los números de Tempranero" });
    const card = toggle.closest("article")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("draw-postures-panel")).toBeNull();
    const { panel, carousel } = openDrawPostures();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-controls")).toBe(panel.id);
    expect(screen.getAllByTestId("draw-postures-panel")).toHaveLength(1);
    expect(within(panel).getAllByRole("list")).toHaveLength(1);
    expect(carousel.getAttribute("aria-roledescription")).toBe("carrusel");
    expect(carousel.tabIndex).toBe(0);
    const postures = within(carousel).getAllByRole("listitem");
    expect(postures).toHaveLength(14);
    expect(postures.map((posture) => posture.getAttribute("data-position"))).toEqual(Array.from({ length: 14 }, (_, index) => String(index + 1)));
    expect(shownPostureNumbers(carousel)).toEqual(orderedPostureValues);
    expect(postures[0].getAttribute("data-head")).toBe("true");
    expect(postures.slice(1).every((posture) => !posture.hasAttribute("data-head"))).toBe(true);
    expect(within(postures[0]).getByText("A la cabeza")).toBeTruthy();
    expect(within(postures[0]).getByTestId("draw-posture-number").textContent).toBe(within(card).getByTestId("daily-draw-number").textContent);
    expect(postures.slice(0, 3).map((posture) => within(posture).getByTestId("draw-posture-rank").getAttribute("data-rank")))
      .toEqual(["gold", "silver", "bronze"]);
    expect(within(carousel).getAllByTestId("draw-posture-rank")).toHaveLength(3);
    expect(within(carousel).queryByRole("img")).toBeNull();
    expect(within(panel).getByRole("button", { name: "Posturas anteriores de Tempranero" }).getAttribute("aria-controls")).toBe(carousel.id);
    expect(within(panel).getByRole("button", { name: "Posturas siguientes de Tempranero" }).getAttribute("aria-controls")).toBe(carousel.id);
    expect(within(panel).queryByRole("list", { name: "Números sin postura informada" })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar números de Tempranero" }));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("draw-postures-panel")).toBeNull();
    expect(within(card).getByTestId("daily-draw-number").textContent).toBe("007");
  });
  it("keeps all legacy numbers visible without assigning unknown postures", () => {
    useProductMock.mockReturnValue({
      ...base,
      results: base.results.map((publication) => publication.gameId === "head"
        ? { ...publication, resultNumbers: ["007", "008"] } : publication),
    });
    render(<ResultsClient />);
    const { panel, carousel } = openDrawPostures();
    expect(shownPostureNumbers(carousel)).toEqual(["007", ...Array<string>(13).fill("—")]);
    expect(within(carousel).getAllByLabelText("Postura sin informar")).toHaveLength(13);
    expect(within(carousel).getAllByTestId("draw-posture-rank").map((rank) => rank.getAttribute("data-rank"))).toEqual(["gold"]);
    const unpositioned = within(panel).getByRole("list", { name: "Números sin postura informada" });
    expect(within(unpositioned).getAllByRole("listitem").map((item) => item.textContent))
      .toEqual(["001", "002", "003", "004", "005", "006", "007", "008"]);
  });
  it("shows missing postures without borrowing a head number from an older publication", () => {
    useProductMock.mockReturnValue({
      ...base,
      results: [...base.results, {
        id: "partial-snapshot", source: "DRAW", gameId: "prizes", drawId: "early",
        drawNumbers: [{ position: 14, value: "99" }, { position: 2, value: "6" }],
        occurredAt: "2026-08-26T13:33:00Z",
      }],
    });
    render(<ResultsClient />);
    expect(screen.getByTestId("daily-draw-number").textContent).toBe("—");
    expect(screen.getByLabelText("A la cabeza sin informar")).toBeTruthy();
    const { carousel } = openDrawPostures();
    expect(shownPostureNumbers(carousel)).toEqual(Array.from({ length: 14 }, (_, index) => (
      index === 1 ? "006" : index === 13 ? "099" : "—"
    )));
    expect(within(carousel).getAllByLabelText("Postura sin informar")).toHaveLength(12);
    expect(within(carousel).getAllByTestId("draw-posture-rank").map((rank) => rank.getAttribute("data-rank"))).toEqual(["silver"]);
    expect(within(within(carousel).getAllByRole("listitem")[0]).queryByTestId("draw-posture-rank")).toBeNull();
    expect(screen.queryByRole("list", { name: "Números sin postura informada" })).toBeNull();
  });
  it.each([
    { kind: "empty", drawNumbers: [] },
    { kind: "entirely invalid", drawNumbers: [{ position: 0, value: "123" }, { position: 15, value: "456" }, { position: 1, value: "invalid" }] },
  ])("replaces a complete draw with a new $kind snapshot without restoring old or legacy values", ({ drawNumbers }) => {
    const olderSnapshot = {
      id: "old-complete-snapshot", source: "DRAW", gameId: "head", drawId: "early",
      drawNumbers: Array.from({ length: 14 }, (_, index) => ({ position: index + 1, value: String(100 + index) })),
      occurredAt: "2026-08-26T13:33:00Z",
    };
    useProductMock.mockReturnValue({ ...base, results: [...base.results, olderSnapshot] });
    const { rerender } = render(<ResultsClient />);
    expect(screen.getByTestId("daily-draw-number").textContent).toBe("100");
    useProductMock.mockReturnValue({
      ...base,
      results: [...base.results, olderSnapshot, {
        id: "new-empty-snapshot", source: "DRAW", gameId: "prizes", drawId: "early",
        occurredAt: "2026-08-26T13:34:00Z", drawNumbers,
      }],
    });
    rerender(<ResultsClient />);
    const card = screen.getAllByTestId("daily-draw-card")[0];
    expect(card.getAttribute("data-state")).toBe("published");
    expect(card.querySelector("time")?.getAttribute("datetime")).toBe("2026-08-26T13:34:00.000Z");
    expect(within(card).getByTestId("daily-draw-number").textContent).toBe("—");
    expect(within(card).getByLabelText("A la cabeza sin informar")).toBeTruthy();
    const { panel, carousel } = openDrawPostures();
    expect(shownPostureNumbers(carousel)).toEqual(Array<string>(14).fill("—"));
    expect(within(carousel).getAllByLabelText("Postura sin informar")).toHaveLength(14);
    expect(within(carousel).queryByTestId("draw-posture-rank")).toBeNull();
    expect(within(panel).queryByRole("list", { name: "Números sin postura informada" })).toBeNull();
  });
  it("switches one day panel between all four draws and closes it from the selected card", () => {
    const draws = [
      { id: "early", label: "Tempranero", head: "007" },
      { id: "morning", label: "Matutino", head: "107" },
      { id: "evening", label: "Vespertino", head: "207" },
      { id: "night", label: "Nocturno", head: "307" },
    ];
    useProductMock.mockReturnValue({
      ...base,
      results: draws.map(({ id, head }) => ({
        id: `snapshot-${id}`, source: "DRAW", gameId: "head", drawId: id,
        drawNumbers: orderedPostureValues.map((value, index) => ({ position: index + 1, value: index === 0 ? head : value })).reverse(),
        occurredAt: "2026-08-26T23:30:00Z",
      })),
    });
    render(<ResultsClient />);
    const day = screen.getByTestId("results-day");
    const cards = within(day).getAllByTestId("daily-draw-card");
    const toggles = cards.map((card) => within(card).getByTestId("daily-draw-toggle"));
    const pairs = within(day).getAllByTestId("daily-draw-pair");
    expect(pairs.map((pair) => within(pair).getAllByTestId("daily-draw-card").map((card) => card.getAttribute("data-draw-id"))))
      .toEqual([["early", "morning"], ["evening", "night"]]);
    const panelId = toggles[0].getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(toggles.map((toggle) => toggle.getAttribute("aria-controls"))).toEqual(Array<string | null>(4).fill(panelId));
    for (const [index, draw] of draws.entries()) {
      fireEvent.click(toggles[index]);
      const panel = within(day).getByRole("region", { name: `Posturas de ${draw.label}` });
      const carousel = within(panel).getByRole("list", { name: `Números de ${draw.label}` });
      expect(within(day).getAllByTestId("draw-postures-panel")).toHaveLength(1);
      const activePair = pairs[Math.floor(index / 2)];
      expect(panel.parentElement).toBe(activePair);
      expect(activePair.lastElementChild).toBe(panel);
      expect(panel.id).toBe(panelId);
      expect(toggles.map((toggle) => toggle.getAttribute("aria-expanded")))
        .toEqual(draws.map((_, drawIndex) => String(drawIndex === index)));
      expect(toggles[index].getAttribute("aria-label")).toBe(`Ocultar números de ${draw.label}`);
      expect(shownPostureNumbers(carousel)).toEqual(orderedPostureValues.map((value, position) => position === 0 ? draw.head : value));
      expect(within(cards[index]).getByTestId("daily-draw-number").textContent).toBe(draw.head);
    }
    fireEvent.click(toggles[3]);
    expect(within(day).queryByTestId("draw-postures-panel")).toBeNull();
    expect(toggles.every((toggle) => toggle.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(toggles[3].getAttribute("aria-label")).toBe("Ver todos los números de Nocturno");
  });
  it("keeps a single day without instant history, date controls or pagination counters", () => {
    render(<ResultsClient />);
    expect(screen.queryByLabelText("Buscar por fecha")).toBeNull();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver todas las fechas" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Paginación de fechas" })).toBeNull();
    expect(screen.queryByText(/Página \d+ de \d+|Días \d+[–-]\d+ de \d+/)).toBeNull();
    expect(screen.getByTestId("results-day").getAttribute("data-date")).toBe("2026-08-26");
    expect(screen.queryByRole("heading", { name: "Sapy’aite" })).toBeNull();
  });
  it("retains loading and unavailable states without fake draws", () => {
    useProductMock.mockReturnValue({ ...base, catalog: null, results: [], loading: true });
    const { rerender } = render(<ResultsClient />);
    expect(screen.getByText("Cargando resultados…")).toBeTruthy();
    expect(screen.queryByTestId("results-day")).toBeNull();
    useProductMock.mockReturnValue({ ...base, catalog: null, results: [], error: "No disponible" });
    rerender(<ResultsClient />);
    expect(screen.getByText("No disponible")).toBeTruthy();
  });
  it("does not show sample labels for remote results", () => {
    useProductMock.mockReturnValue({ ...base, gatewayMode: "backoffice", session: null });
    render(<ResultsClient />);
    expect(screen.queryByText(/Resultados de muestra/)).toBeNull();
    expect(screen.queryByText("Iniciá sesión para ver tus resultados instantáneos.")).toBeNull();
    expect(screen.getAllByTestId("daily-draw-card")).toHaveLength(4);
  });

  it.each([
    { state: "signed in", session: base.session, unauthorized: false },
    { state: "signed out", session: null, unauthorized: false },
    { state: "expired session", session: null, unauthorized: true },
  ])("excludes instant results for $state without changing the daily draws", ({ session, unauthorized }) => {
    const originalResults = structuredClone(base.results);
    useProductMock.mockReturnValue({ ...base, session, unauthorized });
    render(<ResultsClient />);
    expect(screen.queryByRole("region", { name: "Resultados instantáneos de la cuenta" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Resultados instantáneos" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Sapy’aite" })).toBeNull();
    expect(screen.queryByText("999")).toBeNull();
    expect(screen.queryByText(/tus resultados instantáneos|jugadas instantáneas confirmadas/i)).toBeNull();
    expect(screen.getAllByTestId("daily-draw-card")).toHaveLength(4);
    expect(base.results).toEqual(originalResults);
  });

  it("does not turn instant-only results into a daily draw or other published result", () => {
    useProductMock.mockReturnValue({ ...base, results: [base.results[2]] });
    render(<ResultsClient />);
    expect(screen.getByText("No hay sorteos publicados por fecha.")).toBeTruthy();
    expect(screen.queryByTestId("results-day")).toBeNull();
    expect(screen.queryByRole("region", { name: "Otros resultados publicados" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Resultados instantáneos" })).toBeNull();
    expect(screen.queryByText("999")).toBeNull();
  });

  it("paginates whole days with only two header buttons, preserves older records and returns to the first page", () => {
    const history = Array.from({ length: 11 }, (_, index) => ({
      id: `history-${index}`, source: "DRAW", gameId: "head", drawId: "early", result: "123",
      occurredAt: new Date(Date.UTC(2026, 7, 26 - index, 14)).toISOString(),
    }));
    useProductMock.mockReturnValue({ ...base, results: [...history, base.results[2]] });
    const { rerender } = render(<ResultsClient />);
    const header = screen.getByRole("heading", { name: "Resultados", level: 1 }).closest("header")!;
    const navigation = () => within(within(header).getByRole("navigation", { name: "Paginación de fechas" }));
    expect(header.textContent).toMatch(/^\s*Resultados\s*← Más recientes\s*Días anteriores →\s*$/);
    expect(navigation().getAllByRole("button").map((button) => button.textContent)).toEqual(["← Más recientes", "Días anteriores →"]);
    expect(screen.queryByLabelText("Buscar por fecha")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver todas las fechas" })).toBeNull();
    expect(screen.queryByText(/Página \d+ de \d+|Días \d+[–-]\d+ de \d+/)).toBeNull();
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    const dates = () => screen.getAllByTestId("results-day").map((day) => day.getAttribute("data-date"));
    const newestDates = ["2026-08-26", "2026-08-25", "2026-08-24", "2026-08-23", "2026-08-22"];
    expect(dates()).toEqual(newestDates);
    expect(screen.getAllByTestId("daily-draw-card")).toHaveLength(20);
    fireEvent.click(within(screen.getAllByTestId("daily-draw-card")[0]).getByTestId("daily-draw-toggle"));
    expect(screen.getAllByTestId("draw-postures-panel")).toHaveLength(1);
    expect((navigation().getByRole("button", { name: /Más recientes/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((navigation().getByRole("button", { name: /Días anteriores/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(navigation().getByRole("button", { name: /Días anteriores/ }));
    expect(dates()).toEqual(["2026-08-21", "2026-08-20", "2026-08-19", "2026-08-18", "2026-08-17"]);
    expect(screen.queryByTestId("draw-postures-panel")).toBeNull();
    expect(screen.getAllByTestId("daily-draw-card")).toHaveLength(20);
    expect(document.activeElement?.id).toBe("daily-results-history");
    expect((navigation().getByRole("button", { name: /Más recientes/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((navigation().getByRole("button", { name: /Días anteriores/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(navigation().getByRole("button", { name: /Días anteriores/ }));
    expect(dates()).toEqual(["2026-08-16"]);
    expect(screen.getAllByTestId("daily-draw-card")).toHaveLength(4);
    expect((navigation().getByRole("button", { name: /Días anteriores/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("heading", { name: "Sapy’aite" })).toBeNull();
    fireEvent.click(navigation().getByRole("button", { name: /Más recientes/ }));
    expect(dates()[0]).toBe("2026-08-21");
    fireEvent.click(navigation().getByRole("button", { name: /Más recientes/ }));
    expect(dates()).toEqual(newestDates);
    expect(screen.queryByTestId("draw-postures-panel")).toBeNull();
    expect(within(screen.getAllByTestId("daily-draw-card")[0]).getByTestId("daily-draw-toggle").getAttribute("aria-expanded")).toBe("false");
    expect((navigation().getByRole("button", { name: /Más recientes/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.activeElement?.id).toBe("daily-results-history");
    fireEvent.click(navigation().getByRole("button", { name: /Días anteriores/ }));
    useProductMock.mockReturnValue(base);
    rerender(<ResultsClient />);
    expect(dates()).toEqual(["2026-08-26"]);
    expect(screen.queryByRole("navigation", { name: "Paginación de fechas" })).toBeNull();
    expect(header.textContent).toBe("Resultados");
  });
});
