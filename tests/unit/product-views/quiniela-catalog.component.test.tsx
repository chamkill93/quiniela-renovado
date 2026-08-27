// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGamingCatalog } from "@/lib/gaming/catalog";
import { MEGA_LOTO_URL } from "@/features/product/product-links";

const { useProductMock } = vi.hoisted(() => ({ useProductMock: vi.fn() }));
vi.mock("@/providers/product-provider", () => ({ useProduct: useProductMock }));
import { QuinielaCatalogClient } from "@/features/product/catalog-views";

const catalog = buildGamingCatalog("REFUND", new Date("2026-08-27T12:00:00Z"), ["sapyaite"]);
const product = { catalog, loading: false, error: null, unauthorized: false, refresh: vi.fn() };

afterEach(cleanup);
beforeEach(() => useProductMock.mockReturnValue(product));

describe("Quiniela catalog category subtitles", () => {
  it("labels Sapy’aite and Mega Loto above their cards without changing links or branding", () => {
    render(<QuinielaCatalogClient />);
    const grid = screen.getByTestId("traditional-games-grid");
    const instant = screen.getByRole("region", { name: "Instantáneas" });
    const lotos = screen.getByRole("region", { name: "Lotos" });
    const instantTitle = within(instant).getByRole("heading", { name: "Instantáneas", level: 2 });
    const lotosTitle = within(lotos).getByRole("heading", { name: "Lotos", level: 2 });

    expect(instant.firstElementChild).toBe(instantTitle);
    expect(lotos.firstElementChild).toBe(lotosTitle);
    expect(within(instant).getByRole("link", { name: "Jugar Sapy’aite" }).getAttribute("href"))
      .toBe("/quinielas/sapyaite");
    const megaLoto = within(lotos).getByTestId("mega-loto-card");
    expect(megaLoto.getAttribute("href")).toBe(MEGA_LOTO_URL);
    expect(megaLoto.getAttribute("data-tone")).toBe("green");
    expect(megaLoto.getAttribute("target")).toBe("_blank");
    expect(within(grid).getAllByRole("link")).toHaveLength(6);
    expect(within(grid).getAllByRole("heading")).toEqual([instantTitle, lotosTitle]);
  });

  it("does not leave an empty Instantáneas category when Sapy’aite is unavailable", () => {
    useProductMock.mockReturnValue({ ...product, catalog: { ...catalog, instant: [] } });
    render(<QuinielaCatalogClient />);

    expect(screen.queryByRole("region", { name: "Instantáneas" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Instantáneas" })).toBeNull();
    expect(screen.getByRole("region", { name: "Lotos" })).toBeTruthy();
    expect(within(screen.getByTestId("traditional-games-grid")).getAllByRole("link")).toHaveLength(5);
  });
});
