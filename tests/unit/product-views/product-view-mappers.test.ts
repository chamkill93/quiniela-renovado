import { describe, expect, it } from "vitest";

import {
  GAME_VISUALS,
  mapCatalogGames,
  mapPublishedResults,
} from "@/features/product/product-view-mappers";
import { buildGamingCatalog } from "@/lib/gaming/catalog";
import type { GamingCatalog } from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";

function remoteCatalog(): GamingCatalog {
  const catalog = buildGamingCatalog("REFUND", new Date("2026-08-25T12:00:00Z"));
  return {
    ...catalog,
    amounts: [5_000, 1_000, 2_000],
    draws: catalog.draws.map((draw, index) =>
      index === 0 ? { ...draw, label: "Sorteo remoto A" } : draw,
    ),
    instant: catalog.instant.map((game, index) =>
      index === 0
        ? {
            ...game,
            name: "Nombre entregado por API",
            description: "Descripción entregada por API.",
          }
        : game,
    ),
  };
}

describe("mappers de vistas conectadas", () => {
  it("usa contenido y montos remotos, conservando solo presentación local", () => {
    const games = mapCatalogGames(remoteCatalog(), "instant", 6);

    expect(games).toHaveLength(6);
    expect(games[0]).toMatchObject({
      id: "sapyaite",
      name: "Nombre entregado por API",
      description: "Descripción entregada por API.",
      baseAmount: 1_000,
      href: "/instantaneas/sapyaite",
      art: GAME_VISUALS.sapyaite.art,
      tone: GAME_VISUALS.sapyaite.tone,
    });
  });

  it("limita los previews a seis y nueve sin rellenar datos inexistentes", () => {
    const catalog = remoteCatalog();

    expect(mapCatalogGames(catalog, "instant", 6)).toHaveLength(6);
    expect(mapCatalogGames(catalog, "instant", 9)).toHaveLength(9);
    expect(mapCatalogGames(catalog, "traditional", 6)).toHaveLength(6);
    expect(
      mapCatalogGames({ ...catalog, instant: catalog.instant.slice(0, 2) }, "instant", 9),
    ).toHaveLength(2);
  });

  it("no inventa un precio cuando el backoffice no informa montos", () => {
    const catalog = { ...remoteCatalog(), amounts: [] };

    expect(mapCatalogGames(catalog, "traditional", 1)[0].baseAmount).toBeNull();
  });

  it("separa resultados por fuente y descarta entradas sin resultado", () => {
    const catalog = remoteCatalog();
    const results: MockResult[] = [
      {
        id: "draw-1",
        source: "DRAW",
        drawId: "early",
        gameId: "head",
        gameName: "Nombre alternativo",
        result: "497",
        resultNumbers: ["497"],
        occurredAt: "2026-08-25T10:00:00Z",
      },
      {
        id: "instant-1",
        source: "INSTANT",
        gameId: "racha5",
        gameName: "Racha remota",
        resultNumbers: ["002", "104", "333"],
        occurredAt: "2026-08-25T10:05:00Z",
      },
      {
        id: "missing-result",
        source: "DRAW",
        gameId: "head",
      },
      {
        id: "missing-source",
        gameId: "head",
        result: "999",
      },
    ];

    expect(mapPublishedResults(catalog, results, "DRAW")).toEqual([
      expect.objectContaining({
        id: "draw-1",
        label: "Sorteo remoto A",
        result: "497",
        resultNumbers: ["497"],
      }),
    ]);
    expect(mapPublishedResults(catalog, results, "INSTANT")).toEqual([
      expect.objectContaining({
        id: "instant-1",
        label: "Racha remota",
        result: "002 · 104 · 333",
      }),
    ]);
  });
});
