// @vitest-environment jsdom

import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildGamingCatalog } from "@/lib/gaming/catalog";

const { useProductMock } = vi.hoisted(() => ({
  useProductMock: vi.fn(),
}));

vi.mock("@/providers/product-provider", () => ({
  useProduct: useProductMock,
}));

vi.mock("@/features/product/hero-visual", () => ({
  HeroVisual: ({
    loading,
    source,
    spinKey,
    value,
  }: {
    loading?: boolean;
    source?: "promotional" | "published";
    spinKey?: string;
    value: string | null;
  }) => (
    <div
      data-loading={loading ? "true" : "false"}
      data-source={source}
      data-spin-key={spinKey}
      data-testid="hero-visual-probe"
      data-value={value ?? ""}
    />
  ),
}));

import { HomeHero } from "@/features/product/home-hero";

const catalog = buildGamingCatalog(
  "REFUND",
  new Date("2026-08-26T10:00:00.000Z"),
);

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("HomeHero", () => {
  it("mantiene solo Jugar Quiniela como acción del hero", () => {
    useProductMock.mockReturnValue({
      catalog,
      error: null,
      gatewayMode: "backoffice",
      loading: false,
      results: [],
    });

    render(<HomeHero />);

    expect(screen.getByRole("heading", { level: 1, name: "Tu jugada empieza acá." })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /^Jugar/ })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Jugar Quiniela" }).getAttribute("href"))
      .toBe("/quinielas");
    expect(screen.queryByRole("link", { name: "Jugar Sapy’aite" })).toBeNull();
  });

  it("mantiene el resultado publicado cuando el gateway es backoffice", () => {
    const random = vi.spyOn(Math, "random");
    useProductMock.mockReturnValue({
      catalog,
      error: null,
      gatewayMode: "backoffice",
      loading: false,
      results: [
        {
          id: "official-result",
          source: "DRAW",
          gameId: "head",
          result: "246",
          occurredAt: "2026-08-26T09:00:00.000Z",
        },
      ],
    });

    render(<HomeHero />);

    const visual = screen.getByTestId("hero-visual-probe");
    expect(visual.getAttribute("data-source")).toBe("published");
    expect(visual.getAttribute("data-value")).toBe("246");
    expect(visual.getAttribute("data-spin-key")).toBe(
      "official-result:2026-08-26T09:00:00.000Z",
    );
    expect(random).not.toHaveBeenCalled();
  });

  it("genera una combinación promocional después de montar incluso en StrictMode", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    useProductMock.mockReturnValue({
      catalog,
      error: null,
      gatewayMode: "preview",
      loading: false,
      results: [],
    });

    render(
      <StrictMode>
        <HomeHero />
      </StrictMode>,
    );

    const visual = screen.getByTestId("hero-visual-probe");
    await waitFor(() => expect(visual.getAttribute("data-value")).toBe("001"));
    expect(visual.getAttribute("data-source")).toBe("promotional");
    expect(visual.getAttribute("data-spin-key")).toBe("preview-001");
    expect(window.sessionStorage.getItem("quinie_home_hero_random")).toBe("001");
  });
});
