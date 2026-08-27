// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGamingCatalog } from "@/lib/gaming/catalog";

const { useProductMock } = vi.hoisted(() => ({ useProductMock: vi.fn() }));
vi.mock("@/providers/product-provider", () => ({ useProduct: useProductMock }));
import { ResultsClient } from "@/features/product/results-client";

const catalog = buildGamingCatalog("REFUND", new Date("2026-08-27T12:00:00Z"));
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
      expect(card.querySelector("details")).toBeNull();
      expect(within(card).queryByTestId("daily-draw-number")).toBeNull();
    }
    expect(within(day).queryByText("999")).toBeNull();
    expect(screen.getByRole("heading", { name: "Sapy’aite" })).toBeTruthy();
  });
  it("expands one table of 14 ordered postures, highlighting the head and retaining zeroes and repeated numbers", () => {
    const values = ["007", "000", "007", "014", "090", "123", "456", "789", "005", "032", "678", "900", "019", "042"];
    const drawNumbers = values.map((value, index) => ({ position: index + 1, value })).reverse();
    useProductMock.mockReturnValue({
      ...base,
      results: base.results.map((publication) => publication.source === "DRAW" ? { ...publication, drawNumbers } : publication),
    });
    render(<ResultsClient />);
    const summary = screen.getByText("Ver todos los números");
    const detail = summary.closest("details")!;
    const card = detail.closest("article")!;
    expect(detail.open).toBe(false);
    fireEvent.click(summary);
    expect(detail.open).toBe(true);
    const table = within(detail).getByRole("table", { name: "Posturas de Tempranero" });
    expect(within(detail).getAllByRole("table")).toHaveLength(1);
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Postura", "Número"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(14);
    expect(rows.map((row) => row.getAttribute("data-position"))).toEqual(Array.from({ length: 14 }, (_, index) => String(index + 1)));
    expect(rows.map((row) => within(row).getByRole("cell").textContent)).toEqual(values);
    expect(rows[0].getAttribute("data-head")).toBe("true");
    expect(rows.slice(1).every((row) => !row.hasAttribute("data-head"))).toBe(true);
    expect(within(rows[0]).getByText("A la cabeza")).toBeTruthy();
    expect(within(rows[0]).getByRole("cell").textContent).toBe(within(card).getByTestId("daily-draw-number").textContent);
    expect(within(detail).getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["Posturas del sorteo"]);
    expect(within(detail).queryByRole("list", { name: "Números sin postura informada" })).toBeNull();
    fireEvent.click(summary);
    expect(detail.open).toBe(false);
    expect(within(card).getByTestId("daily-draw-number").textContent).toBe("007");
  });
  it("keeps all legacy numbers visible without assigning unknown postures", () => {
    useProductMock.mockReturnValue({
      ...base,
      results: base.results.map((publication) => publication.gameId === "head"
        ? { ...publication, resultNumbers: ["007", "008"] } : publication),
    });
    render(<ResultsClient />);
    const summary = screen.getByText("Ver todos los números");
    const detail = summary.closest("details")!;
    fireEvent.click(summary);
    const table = within(detail).getByRole("table", { name: "Posturas de Tempranero" });
    expect(within(table).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["007", ...Array<string>(13).fill("—")]);
    expect(within(table).getAllByLabelText("Postura sin informar")).toHaveLength(13);
    const unpositioned = within(detail).getByRole("list", { name: "Números sin postura informada" });
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
    fireEvent.click(screen.getByText("Ver todos los números"));
    const table = screen.getByRole("table", { name: "Posturas de Tempranero" });
    expect(within(table).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(Array.from({ length: 14 }, (_, index) => (
      index === 1 ? "006" : index === 13 ? "099" : "—"
    )));
    expect(within(table).getAllByLabelText("Postura sin informar")).toHaveLength(12);
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
    fireEvent.click(within(card).getByText("Ver todos los números"));
    const table = within(card).getByRole("table", { name: "Posturas de Tempranero" });
    expect(within(table).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(Array<string>(14).fill("—"));
    expect(within(table).getAllByLabelText("Postura sin informar")).toHaveLength(14);
    expect(within(card).queryByRole("list", { name: "Números sin postura informada" })).toBeNull();
  });
  it("keeps a single day and the instant history without date controls or pagination counters", () => {
    render(<ResultsClient />);
    expect(screen.queryByLabelText("Buscar por fecha")).toBeNull();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver todas las fechas" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Paginación de fechas" })).toBeNull();
    expect(screen.queryByText(/Página \d+ de \d+|Días \d+[–-]\d+ de \d+/)).toBeNull();
    expect(screen.getByTestId("results-day").getAttribute("data-date")).toBe("2026-08-26");
    expect(screen.getByRole("heading", { name: "Sapy’aite" })).toBeTruthy();
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
    expect(screen.getByText("Iniciá sesión para ver tus resultados instantáneos.")).toBeTruthy();
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
    expect((navigation().getByRole("button", { name: /Más recientes/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((navigation().getByRole("button", { name: /Días anteriores/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(navigation().getByRole("button", { name: /Días anteriores/ }));
    expect(dates()).toEqual(["2026-08-21", "2026-08-20", "2026-08-19", "2026-08-18", "2026-08-17"]);
    expect(screen.getAllByTestId("daily-draw-card")).toHaveLength(20);
    expect(document.activeElement?.id).toBe("daily-results-history");
    expect((navigation().getByRole("button", { name: /Más recientes/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((navigation().getByRole("button", { name: /Días anteriores/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(navigation().getByRole("button", { name: /Días anteriores/ }));
    expect(dates()).toEqual(["2026-08-16"]);
    expect(screen.getAllByTestId("daily-draw-card")).toHaveLength(4);
    expect((navigation().getByRole("button", { name: /Días anteriores/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("heading", { name: "Sapy’aite" })).toBeTruthy();
    fireEvent.click(navigation().getByRole("button", { name: /Más recientes/ }));
    expect(dates()[0]).toBe("2026-08-21");
    fireEvent.click(navigation().getByRole("button", { name: /Más recientes/ }));
    expect(dates()).toEqual(newestDates);
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
