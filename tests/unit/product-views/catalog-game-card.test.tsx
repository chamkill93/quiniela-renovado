import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CatalogGameCard } from "@/features/product/catalog-game-card";
import type { CatalogGameView } from "@/features/product/product-view-mappers";

function game(overrides: Partial<CatalogGameView> = {}): CatalogGameView {
  return {
    id: "producto-remoto-42",
    name: "Juego remoto",
    eyebrow: "Resultado inmediato",
    description: "Definición recibida del backoffice.",
    iconKey: "poa5",
    tone: "red",
    baseAmount: 1_000,
    href: "/instantaneas/producto-remoto-42",
    ...overrides,
  };
}

describe("CatalogGameCard", () => {
  it("muestra solo nombre, explicación y la acción de jugar", () => {
    const markup = renderToStaticMarkup(<CatalogGameCard game={game()} />);

    expect(markup).toContain('aria-label="Jugar Juego remoto"');
    expect(markup).toContain('href="/instantaneas/producto-remoto-42"');
    expect(markup).toContain("Juego remoto");
    expect(markup).toContain("Definición recibida del backoffice.");
    expect(markup).toContain("Jugar");
    expect(markup).not.toContain("Resultado inmediato");
    expect(markup).not.toContain("Desde");
    expect(markup).not.toContain("Gs.");
  });

  it("renderiza el icono aprobado resuelto desde iconKey aunque el ID sea remoto", () => {
    const markup = renderToStaticMarkup(<CatalogGameCard game={game()} />);

    expect(markup).toContain('data-game-icon="poa5"');
    expect(markup).toContain('data-game-icon-family="instant"');
    expect(markup).toContain('data-game-icon-slug="poa-5"');
    expect(markup).not.toContain('data-game-icon="producto-remoto-42"');
  });

  it("no interpola IDs remotos cuando no existe un iconKey aprobado", () => {
    const markup = renderToStaticMarkup(
      <CatalogGameCard game={game({ iconKey: null, id: "../producto-no-aprobado" })} />,
    );

    expect(markup).not.toContain("data-game-icon");
    expect(markup).not.toContain("quinie-icons-v2/games");
  });

  it("usa el ID canónico como fallback defensivo", () => {
    const markup = renderToStaticMarkup(
      <CatalogGameCard game={game({ iconKey: null, id: "mbohapy" })} />,
    );

    expect(markup).toContain('data-game-icon="mbohapy"');
    expect(markup).toContain('data-game-icon-slug="mbohapy"');
  });
});
