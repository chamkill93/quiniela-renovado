// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGamingCatalog } from "@/lib/gaming/catalog";

const { useProductMock } = vi.hoisted(() => ({ useProductMock: vi.fn() }));
vi.mock("@/providers/product-provider", () => ({ useProduct: useProductMock }));
import RulesPage from "@/app/reglas/page";

const catalog = buildGamingCatalog("REFUND", new Date("2026-08-27T12:00:00Z"), ["sapyaite"]);
const base = { catalog, loading: false, error: null, unauthorized: false, refresh: vi.fn() };

afterEach(cleanup);
beforeEach(() => useProductMock.mockReturnValue(base));

describe("RulesPage without the quick calculator", () => {
  it("preserves the enabled rules, multipliers and game links without calculator inputs", () => {
    render(<RulesPage />);
    expect(screen.getByRole("heading", { name: "Cómo jugar", level: 1 })).toBeTruthy();
    const grid = screen.getByTestId("rules-grid");
    expect(within(grid).getAllByRole("article")).toHaveLength(5);
    expect(within(grid).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/quinielas/head", "/quinielas/prizes", "/quinielas/invert", "/quinielas/redoblona", "/quinielas/sapyaite",
    ]);
    expect(within(grid).getAllByText("700× el importe")).toHaveLength(2);
    expect(within(grid).getByText("700× ÷ postura")).toBeTruthy();
    expect(within(grid).getByText("700× ÷ combinaciones ÷ postura")).toBeTruthy();
    expect(within(grid).getByText("700× · 80× ÷ postura")).toBeTruthy();
    expect(screen.queryByTestId("prize-calculator")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Calculadora rápida" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(base.refresh).not.toHaveBeenCalled();
  });

  it("keeps Sapy’aite details expandable and its multiplier unchanged", () => {
    render(<RulesPage />);
    const card = within(screen.getByTestId("rule-card-sapyaite"));
    const toggle = card.getByRole("button", { name: "Ver reglas de Sapy’aite" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(card.getByText("Si acertás con Gs. 500, el premio total es Gs. 350.000.")).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("prize-calculator")).toBeNull();
  });

  it.each([
    { state: "loading", loading: true, unauthorized: false, error: null, message: "Cargando reglas…" },
    { state: "unauthorized", loading: false, unauthorized: true, error: null, message: "Iniciá sesión para consultar las reglas disponibles." },
    { state: "failed", loading: false, unauthorized: false, error: "No disponible", message: "No disponible" },
    { state: "empty", loading: false, unauthorized: false, error: null, message: "No hay reglas disponibles en este momento." },
  ])("preserves the $state state without restoring the calculator", ({ loading, unauthorized, error, message }) => {
    useProductMock.mockReturnValue({ ...base, catalog: null, loading, unauthorized, error });
    render(<RulesPage />);
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByTestId("rules-grid")).toBeNull();
    expect(screen.queryByTestId("prize-calculator")).toBeNull();
  });

  it("shows the empty state when no games are enabled", () => {
    useProductMock.mockReturnValue({ ...base, catalog: { ...catalog, traditional: [], instant: [] } });
    render(<RulesPage />);
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByText("No hay reglas disponibles en este momento.")).toBeTruthy();
    expect(screen.queryByTestId("prize-calculator")).toBeNull();
  });
});
