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
  it("renders four named slots with individual icons, statuses and a primary head number", () => {
    render(<ResultsClient />);
    const day = screen.getByTestId("results-day");
    const cards = within(day).getAllByTestId("daily-draw-card");
    expect(cards.map((card) => card.getAttribute("data-draw-id"))).toEqual(["early", "morning", "evening", "night"]);
    expect(within(day).getAllByRole("img")).toHaveLength(4);
    expect(within(day).getByTestId("daily-draw-number").textContent).toBe("007");
    expect(within(day).getAllByText("Sin publicar")).toHaveLength(3);
    expect(within(day).queryByText("999")).toBeNull();
    expect(screen.getByRole("heading", { name: "Sapy’aite" })).toBeTruthy();
  });
  it("keeps every provided prize number in an expandable detail", () => {
    render(<ResultsClient />);
    const detail = screen.getByText("Ver todos los números").closest("details")!;
    expect(detail.open).toBe(false);
    const prizeList = within(detail).getByLabelText("A los Premios");
    expect(within(prizeList).getAllByRole("listitem")).toHaveLength(7);
  });
  it("filters dates and clears the filter without touching the instant history", () => {
    render(<ResultsClient />);
    fireEvent.change(screen.getByLabelText("Buscar por fecha"), { target: { value: "2026-08-20" } });
    expect(screen.getByTestId("results-day").getAttribute("data-date")).toBe("2026-08-20");
    expect(screen.getAllByText("Sin publicar")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "Sapy’aite" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver todas las fechas" }));
    expect(screen.getByTestId("results-day").getAttribute("data-date")).toBe("2026-08-26");
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

  it("paginates whole days, preserves older records and restores the first page after filtering", () => {
    const history = Array.from({ length: 11 }, (_, index) => ({
      id: `history-${index}`, source: "DRAW", gameId: "head", drawId: "early", result: "123",
      occurredAt: new Date(Date.UTC(2026, 7, 26 - index, 14)).toISOString(),
    }));
    useProductMock.mockReturnValue({ ...base, results: history });
    const { rerender } = render(<ResultsClient />);
    const top = () => within(screen.getByRole("navigation", { name: "Paginación de fechas" }));
    const bottom = () => within(screen.getByRole("navigation", { name: "Paginación de fechas inferior" }));
    const dates = () => screen.getAllByTestId("results-day").map((day) => day.getAttribute("data-date"));
    expect(dates()).toHaveLength(5);
    expect(dates()[0]).toBe("2026-08-26");
    expect((top().getByRole("button", { name: /Más recientes/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(bottom().getByRole("button", { name: /Días anteriores/ }));
    expect(dates()).toEqual(["2026-08-21", "2026-08-20", "2026-08-19", "2026-08-18", "2026-08-17"]);
    expect(document.activeElement?.id).toBe("daily-results-history");
    fireEvent.click(top().getByRole("button", { name: /Días anteriores/ }));
    expect(dates()).toEqual(["2026-08-16"]);
    expect((top().getByRole("button", { name: /Días anteriores/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(top().getByRole("button", { name: /Más recientes/ }));
    expect(dates()[0]).toBe("2026-08-21");
    fireEvent.change(screen.getByLabelText("Buscar por fecha"), { target: { value: "2026-08-16" } });
    expect(dates()).toEqual(["2026-08-16"]);
    expect(screen.queryByRole("navigation", { name: "Paginación de fechas" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver todas las fechas" }));
    expect(dates()[0]).toBe("2026-08-26");
    fireEvent.click(top().getByRole("button", { name: /Días anteriores/ }));
    useProductMock.mockReturnValue(base);
    rerender(<ResultsClient />);
    expect(dates()).toEqual(["2026-08-26"]);
    expect(screen.queryByRole("navigation", { name: "Paginación de fechas" })).toBeNull();
  });
});
