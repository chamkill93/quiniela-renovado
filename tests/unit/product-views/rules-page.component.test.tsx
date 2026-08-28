// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ALL_GAME_RULES } from "@/features/product/rules-page-data";
import { MEGA_LOTO_URL } from "@/features/product/product-links";
import { buildGamingCatalog } from "@/lib/gaming/catalog";

const { useProductMock } = vi.hoisted(() => ({ useProductMock: vi.fn() }));
vi.mock("@/providers/product-provider", () => ({ useProduct: useProductMock }));
import RulesPage from "@/app/reglas/page";

const catalog = buildGamingCatalog("REFUND", new Date("2026-08-27T12:00:00Z"), ["sapyaite"]);
const base = { catalog, loading: false, error: null, unauthorized: false, refresh: vi.fn() };
const expectedGameIds = ["head", "prizes", "invert", "redoblona", "sapyaite", "megaloto"];

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  useProductMock.mockReturnValue(base);
});

function expectRulesOnly() {
  expect(screen.queryByTestId("prize-calculator")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Calculadora rápida" })).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("spinbutton")).toBeNull();
  expect(screen.getByRole("main").textContent)
    .not.toMatch(/×|multiplicador|cuánto paga|calculadora|premio total|tabla de pagos|\bGs\./i);
}

describe("RulesPage focused on participation rules", () => {
  it("shows the six current games with canonical local links and the official Mega Loto destination", () => {
    render(<RulesPage />);
    expect(screen.getByRole("heading", { name: "Cómo jugar", level: 1 })).toBeTruthy();
    const grid = screen.getByTestId("rules-grid");
    const cards = within(grid).getAllByRole("article");
    expect(cards).toHaveLength(6);
    expect(cards.map((card) => card.getAttribute("data-testid")))
      .toEqual(expectedGameIds.map((id) => "rule-card-" + id));
    expect(within(grid).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent))
      .toEqual(ALL_GAME_RULES.map((rule) => rule.title));
    expect(within(grid).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/quinielas/head", "/quinielas/prizes", "/quinielas/invert", "/quinielas/redoblona",
      "/quinielas/sapyaite", MEGA_LOTO_URL,
    ]);
    expect(within(grid).getAllByRole("link", { name: /^Jugar / })).toHaveLength(5);
    const official = within(grid).getByRole("link", { name: /^Sitio oficial de Mega Loto/ });
    expect(official.getAttribute("target")).toBe("_blank");
    expect(official.getAttribute("rel")?.split(/\s+/))
      .toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
    expect(grid.querySelector('a[href="/quinielas/megaloto"]')).toBeNull();
    for (const card of cards) {
      expect(card.querySelectorAll("dt")).toHaveLength(2);
      expect(card.querySelectorAll("dd")).toHaveLength(2);
    }
    expectRulesOnly();
    expect(base.refresh).not.toHaveBeenCalled();
  });

  it("preserves six independent accessible disclosures with detailed instructions, conditions and examples", () => {
    render(<RulesPage />);
    const controls = new Set<string>();
    for (const rule of ALL_GAME_RULES) {
      const card = screen.getByTestId("rule-card-" + rule.id);
      const toggle = within(card).getByRole("button", { name: "Ver reglas de " + rule.title });
      const detailId = toggle.getAttribute("aria-controls")!;
      const detail = document.getElementById(detailId)!;
      controls.add(detailId);
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(detail.hidden).toBe(true);
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(toggle.textContent).toBe("Ver menos");
      expect(detail.hidden).toBe(false);
      for (const name of ["Paso a paso", "Condiciones del acierto", "Ejemplo"]) {
        expect(within(card).getByRole("heading", { name, level: 3 })).toBeTruthy();
      }
      expect(within(card).getAllByRole("listitem")).toHaveLength(rule.instructions.length + rule.conditions.length);
      expect(within(card).getAllByText(rule.example, { exact: true })).toHaveLength(1);
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(detail.hidden).toBe(true);
    }
    expect(controls.size).toBe(6);
    expectRulesOnly();
  });

  it("does not compare one game with A la Cabeza or Sapy’aite in another game's card", () => {
    render(<RulesPage />);
    for (const id of expectedGameIds) {
      const card = screen.getByTestId("rule-card-" + id);
      if (id !== "head") expect(card.textContent).not.toMatch(/A la Cabeza/i);
      if (id !== "sapyaite") expect(card.textContent).not.toMatch(/Sapy[’']?aite/i);
    }
  });

  it.each([
    { state: "loading", loading: true, unauthorized: false, error: null, message: "Cargando reglas…" },
    { state: "unauthorized", loading: false, unauthorized: true, error: null, message: "Iniciá sesión para consultar las reglas disponibles." },
    { state: "failed", loading: false, unauthorized: false, error: "No disponible", message: "No disponible" },
    { state: "empty", loading: false, unauthorized: false, error: null, message: "No hay reglas disponibles en este momento." },
  ])("preserves the $state state when the catalog is null, without showing even external rules", ({ loading, unauthorized, error, message }) => {
    useProductMock.mockReturnValue({ ...base, catalog: null, loading, unauthorized, error });
    render(<RulesPage />);
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByTestId("rules-grid")).toBeNull();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByTestId("rule-card-megaloto")).toBeNull();
    expectRulesOnly();
  });

  it("keeps only the external Mega Loto rule when the known catalog has no local games", () => {
    useProductMock.mockReturnValue({ ...base, catalog: { ...catalog, traditional: [], instant: [] } });
    render(<RulesPage />);
    const grid = screen.getByTestId("rules-grid");
    expect(within(grid).getAllByRole("article")).toEqual([screen.getByTestId("rule-card-megaloto")]);
    expect(within(grid).getByRole("link", { name: /^Sitio oficial de Mega Loto/ }).getAttribute("href"))
      .toBe(MEGA_LOTO_URL);
    expect(screen.queryByText("No hay reglas disponibles en este momento.")).toBeNull();
    expectRulesOnly();
  });

  it("filters disabled local games without exposing legacy instant cards or a local Mega Loto duplicate", () => {
    const fullCatalog = buildGamingCatalog("REFUND", new Date("2026-08-27T12:00:00Z"));
    useProductMock.mockReturnValue({
      ...base,
      catalog: {
        ...fullCatalog,
        traditional: fullCatalog.traditional.filter((game) => ["head", "invert", "megaloto", "sapyaite-traditional"].includes(game.id)),
        instant: fullCatalog.instant.filter((game) => game.id !== "sapyaite"),
      },
    });
    render(<RulesPage />);
    expect(within(screen.getByTestId("rules-grid")).getAllByRole("article")
      .map((card) => card.getAttribute("data-testid")))
      .toEqual(["rule-card-head", "rule-card-invert", "rule-card-megaloto"]);
    expect(screen.queryByTestId("rule-card-sapyaite")).toBeNull();
    expect(screen.queryByTestId("rule-card-poa5")).toBeNull();
    expect(screen.queryByTestId("rule-card-pyae")).toBeNull();
    expectRulesOnly();
  });

  it("shows the six rules after the catalog finishes loading", () => {
    useProductMock.mockReturnValue({ ...base, catalog: null, loading: true });
    const { rerender } = render(<RulesPage />);
    expect(screen.getByText("Cargando reglas…")).toBeTruthy();
    expect(screen.queryByTestId("rules-grid")).toBeNull();

    useProductMock.mockReturnValue(base);
    rerender(<RulesPage />);

    expect(screen.queryByText("Cargando reglas…")).toBeNull();
    expect(within(screen.getByTestId("rules-grid")).getAllByRole("article")).toHaveLength(6);
    expectRulesOnly();
  });

  it("retains loaded rules while a refresh error offers an explicit retry", () => {
    useProductMock.mockReturnValue({ ...base, error: "No se pudo actualizar el catálogo" });
    render(<RulesPage />);
    expect(screen.getByRole("alert").textContent).toContain("No se pudo actualizar el catálogo");
    expect(within(screen.getByTestId("rules-grid")).getAllByRole("article")).toHaveLength(6);
    expect(base.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(base.refresh).toHaveBeenCalledOnce();
    expectRulesOnly();
  });
});
