import { describe, expect, it } from "vitest";

import {
  selectHomeDrawCards,
  selectHomePublishedResults,
} from "@/features/product/home-sections-data";
import { buildGamingCatalog } from "@/lib/gaming/catalog";
import type { DrawDefinition, GamingCatalog } from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");

function draw(
  input: Partial<DrawDefinition> & Pick<DrawDefinition, "id" | "drawsAt" | "closesAt">,
): DrawDefinition {
  return {
    label: input.id,
    family: "QUINIELA",
    status: "OPEN",
    ...input,
  };
}

function catalog(draws?: readonly DrawDefinition[]): GamingCatalog {
  const base = buildGamingCatalog("REFUND", new Date("2026-08-26T10:00:00Z"));
  return { ...base, draws: draws ?? base.draws };
}

describe("secciones operativas de Inicio", () => {
  describe("selectHomeDrawCards", () => {
    it("mantiene las cuatro tarjetas canónicas, sus assets y sus enlaces semánticos", () => {
      const cards = selectHomeDrawCards([], NOW);

      expect(cards.map((card) => card.id)).toEqual([
        "early",
        "morning",
        "evening",
        "night",
      ]);
      expect(cards.map((card) => card.slug)).toEqual([
        "tempranero",
        "matutino",
        "vespertino",
        "nocturno",
      ]);
      expect(cards[0]).toMatchObject({
        href: "/sorteos/tempranero",
        iconDark: "/assets/quinie-home-v3/draws/dark/tempranero.webp",
        iconLight: "/assets/quinie-home-v3/draws/light/tempranero.webp",
        timeLabel: "--:--",
        statusLabel: "NO DISPONIBLE",
        state: "unavailable",
        isNext: false,
      });
    });

    it("destaca el siguiente por drawsAt y deriva countdowns/estados sin inventarlos", () => {
      const cards = selectHomeDrawCards([
        draw({
          id: "early",
          label: "Tempranero · 08:00",
          drawsAt: "2026-08-26T11:00:00Z",
          closesAt: "2026-08-26T10:45:00Z",
        }),
        draw({
          id: "morning",
          label: "Matutino · horario remoto",
          drawsAt: "2026-08-26T13:00:00Z",
          closesAt: "2026-08-26T12:45:00Z",
        }),
        draw({
          id: "evening",
          drawsAt: "2026-08-26T16:00:00Z",
          closesAt: "2026-08-26T15:45:00Z",
        }),
      ], NOW);

      expect(cards.find((card) => card.id === "early")).toMatchObject({
        state: "completed",
        statusLabel: "HORARIO CUMPLIDO",
        isNext: false,
      });
      expect(cards.find((card) => card.id === "morning")).toMatchObject({
        state: "open",
        statusLabel: "EN 0H 45M",
        isNext: true,
      });
      expect(cards.find((card) => card.id === "evening")).toMatchObject({
        state: "open",
        statusLabel: "EN 3H 45M",
        isNext: false,
      });
      expect(cards.find((card) => card.id === "night")?.state).toBe("unavailable");
    });

    it("distingue venta cerrada de una configuración de cierre inválida", () => {
      const cards = selectHomeDrawCards([
        draw({
          id: "early",
          drawsAt: "2026-08-26T13:00:00Z",
          closesAt: "2026-08-26T11:59:00Z",
        }),
        draw({
          id: "morning",
          drawsAt: "2026-08-26T14:00:00Z",
          closesAt: "2026-08-26T14:05:00Z",
        }),
      ], NOW);

      expect(cards.find((card) => card.id === "early")).toMatchObject({
        state: "closed",
        statusLabel: "VENTA CERRADA",
        isNext: true,
      });
      expect(cards.find((card) => card.id === "morning")).toMatchObject({
        state: "unavailable",
        statusLabel: "CIERRE NO DISPONIBLE",
      });
    });

    it("ignora sorteos Mega Loto o IDs remotos al decidir el próximo", () => {
      const cards = selectHomeDrawCards([
        draw({
          id: "mega",
          family: "MEGALOTO",
          drawsAt: "2026-08-26T12:05:00Z",
          closesAt: "2026-08-26T12:04:00Z",
        }),
        draw({
          id: "remote",
          drawsAt: "2026-08-26T12:10:00Z",
          closesAt: "2026-08-26T12:09:00Z",
        }),
        draw({
          id: "night",
          drawsAt: "2026-08-26T13:00:00Z",
          closesAt: "2026-08-26T12:45:00Z",
        }),
      ], NOW);

      expect(cards.filter((card) => card.isNext).map((card) => card.id)).toEqual([
        "night",
      ]);
    });
  });

  describe("selectHomePublishedResults", () => {
    it("filtra Quiniela, ordena por timestamp, normaliza tres cifras y limita a cuatro", () => {
      const results: MockResult[] = [
        {
          id: "old",
          source: "DRAW",
          gameId: "head",
          result: "8",
          occurredAt: "2026-08-26T08:00:00Z",
        },
        {
          id: "latest",
          source: "DRAW",
          gameId: "head",
          gameName: "A la Cabeza",
          result: "7",
          occurredAt: "2026-08-26T12:00:00Z",
        },
        {
          id: "second",
          source: "DRAW",
          gameId: "prizes",
          result: "208",
          occurredAt: "2026-08-26T11:00:00Z",
        },
        {
          id: "third",
          source: "DRAW",
          gameId: "invert",
          result: "731",
          occurredAt: "2026-08-26T10:00:00Z",
        },
        {
          id: "fourth",
          source: "DRAW",
          gameId: "redoblona",
          result: "044",
          occurredAt: "2026-08-26T09:00:00Z",
        },
      ];

      const mapped = selectHomePublishedResults(catalog(), results);

      expect(mapped.map((result) => result.id)).toEqual([
        "latest",
        "second",
        "third",
        "fourth",
      ]);
      expect(mapped.map((result) => result.value)).toEqual([
        "007",
        "208",
        "731",
        "044",
      ]);
      expect(mapped[0]).toMatchObject({
        modality: "A la Cabeza",
        drawLabel: "Quiniela",
      });
    });

    it("excluye Instantáneas, Mega Loto por juego o familia y datos ambiguos", () => {
      const megaDraw = draw({
        id: "mega-draw",
        family: "MEGALOTO",
        drawsAt: "2026-08-26T15:00:00Z",
        closesAt: "2026-08-26T14:45:00Z",
      });
      const results: MockResult[] = [
        {
          id: "instant",
          source: "INSTANT",
          gameId: "sapyaite",
          result: "111",
          occurredAt: "2026-08-26T12:00:00Z",
        },
        {
          id: "mega-game",
          source: "DRAW",
          gameId: "megaloto",
          result: "222",
          occurredAt: "2026-08-26T11:00:00Z",
        },
        {
          id: "mega-draw",
          source: "DRAW",
          drawId: "mega-draw",
          gameId: "head",
          result: "333",
          occurredAt: "2026-08-26T10:00:00Z",
        },
        {
          id: "unknown",
          source: "DRAW",
          result: "444",
          occurredAt: "2026-08-26T09:00:00Z",
        },
        {
          id: "invalid-number",
          source: "DRAW",
          gameId: "head",
          result: "1000",
          occurredAt: "2026-08-26T08:00:00Z",
        },
        {
          id: "invalid-date",
          source: "DRAW",
          gameId: "head",
          result: "555",
          occurredAt: "ayer",
        },
      ];

      expect(
        selectHomePublishedResults(
          catalog([...catalog().draws, megaDraw]),
          results,
        ),
      ).toEqual([]);
    });

    it("acepta resultados históricos del juego Quiniela y fallbacks válidos del contrato", () => {
      const mapped = selectHomePublishedResults(catalog(), [
        {
          id: "legacy",
          source: "DRAW",
          drawId: "previous-quiniela-1",
          gameId: "head",
          result: "497 · 208",
          resultNumbers: ["5"],
          publishedAt: "2026-08-26T11:30:00Z",
          label: "Matutino",
        },
      ]);

      expect(mapped).toHaveLength(1);
      expect(mapped[0]).toMatchObject({
        id: "legacy",
        value: "005",
        modality: "A la Cabeza",
        drawLabel: "Matutino",
        occurredAt: "2026-08-26T11:30:00Z",
      });
    });

    it("respeta el rango autoritativo 001–999 y no publica 000", () => {
      const mapped = selectHomePublishedResults(catalog(), [
        {
          id: "zero",
          source: "DRAW",
          gameId: "head",
          result: "0",
          occurredAt: "2026-08-26T11:00:00Z",
        },
      ]);

      expect(mapped).toEqual([]);
    });

    it("usa el nombre limpio del sorteo publicado por el catálogo", () => {
      const morning = draw({
        id: "morning",
        label: "Matutino · 13:00",
        drawsAt: "2026-08-26T13:00:00Z",
        closesAt: "2026-08-26T12:45:00Z",
      });
      const [mapped] = selectHomePublishedResults(catalog([morning]), [
        {
          id: "known-draw",
          source: "DRAW",
          drawId: "morning",
          gameId: "head",
          result: "497",
          occurredAt: "2026-08-26T11:00:00Z",
        },
      ]);

      expect(mapped.drawLabel).toBe("Matutino");
    });
  });
});
