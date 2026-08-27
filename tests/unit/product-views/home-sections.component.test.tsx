// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildGamingCatalog } from "@/lib/gaming/catalog";

const { useProductMock } = vi.hoisted(() => ({ useProductMock: vi.fn() }));
vi.mock("@/providers/product-provider", () => ({ useProduct: useProductMock }));
vi.mock("@/features/product/draw-icon", () => ({ DrawIcon: () => null }));

import { HomeSections } from "@/features/product/home-sections";

const catalog = buildGamingCatalog("REFUND", new Date("2026-08-26T10:00:00.000Z"));
const results = ["head", "prizes"].flatMap((gameId) =>
  Array.from({ length: 8 }, (_, index) => ({
    id: `${gameId}-${index}`,
    source: "DRAW",
    gameId,
    result: String(index + 1).padStart(3, "0"),
    occurredAt: "2026-08-26T10:00:00.000Z",
  })),
);

afterEach(cleanup);

describe("HomeSections compact grids", () => {
  it("keeps all four draws and every result in the selected grid without carousel controls", () => {
    useProductMock.mockReturnValue({ catalog, results, loading: false, error: null });
    render(<HomeSections />);

    expect(within(screen.getByTestId("home-draw-grid")).getAllByRole("link")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Ver más resultados" })).toBeNull();
    const panel = screen.getByRole("tabpanel");
    expect(panel.id).toBe("home-results-grid");
    expect(within(panel).getAllByTestId("home-result-card")).toHaveLength(8);
    expect(within(panel).getByText("001")).toBeTruthy();
    expect(within(panel).getByText("008")).toBeTruthy();

    const prizesTab = screen.getByRole("tab", { name: "A LOS PREMIOS" });
    fireEvent.click(prizesTab);
    expect(prizesTab.getAttribute("aria-selected")).toBe("true");
    expect(prizesTab.getAttribute("aria-controls")).toBe(panel.id);
    expect(within(screen.getByRole("tabpanel")).getAllByTestId("home-result-card")).toHaveLength(8);

    fireEvent.keyDown(prizesTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "REDOBLONA" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("Todavía no hay resultados");
  });

  it("retains the loading and unavailable states without inventing results", () => {
    useProductMock.mockReturnValue({ catalog: null, results: [], loading: true, error: null });
    const { rerender } = render(<HomeSections />);
    expect(screen.getByTestId("home-results-section").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryAllByTestId("home-result-card")).toHaveLength(0);

    useProductMock.mockReturnValue({ catalog: null, results: [], loading: false, error: "Unavailable" });
    rerender(<HomeSections />);
    expect(screen.getByRole("status").textContent).toContain("no están disponibles");
    expect(screen.queryAllByTestId("home-result-card")).toHaveLength(0);
  });
});
