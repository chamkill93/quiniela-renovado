import { describe, expect, it } from "vitest";

import {
  HOME_DRAW_SLOTS,
  HOME_RESULT_TABS,
  HOME_TIME_ZONE,
  selectHomeDrawCards,
  selectHomePublishedResults,
} from "@/features/product/home-sections-data";
import { buildGamingCatalog } from "@/lib/gaming/catalog";
import type { DrawDefinition, GamingCatalog } from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";

function catalog(draws?: readonly DrawDefinition[]): GamingCatalog {
  const base = buildGamingCatalog("REFUND", new Date("2026-08-26T10:00:00Z"));
  return { ...base, draws: draws ?? base.draws };
}

function activeDrawAt(isoInstant: string) {
  return selectHomeDrawCards(Date.parse(isoInstant)).find((card) => card.isNext);
}

describe("secciones finales de Inicio", () => {
  describe("selectHomeDrawCards", () => {
    it("mantiene una sola fuente de horarios, timezone y enlaces", () => {
      expect(HOME_TIME_ZONE).toBe("America/Asuncion");
      expect(HOME_DRAW_SLOTS.map((slot) => slot.time)).toEqual([
        "10:30",
        "13:00",
        "16:30",
        "20:30",
      ]);

      const cards = selectHomeDrawCards(Date.parse("2026-08-26T12:15:00Z"));

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
        timeLabel: "10:30",
        statusLabel: "EN 01H 15M 00S",
        targetAt: "2026-08-26T13:30:00.000Z",
        isNext: true,
        isTomorrow: false,
      });
      expect(cards.filter((card) => card.isNext)).toHaveLength(1);
      expect(cards.filter((card) => card.statusLabel !== null)).toHaveLength(1);
      expect(cards.filter((card) => card.targetAt !== null)).toHaveLength(1);
    });

    it.each([
      ["09:15", "2026-08-26T12:15:00Z", "tempranero"],
      ["11:00", "2026-08-26T14:00:00Z", "matutino"],
      ["14:00", "2026-08-26T17:00:00Z", "vespertino"],
      ["18:00", "2026-08-26T21:00:00Z", "nocturno"],
    ])("a las %s de Paraguay selecciona %s", (_localTime, instant, slug) => {
      expect(activeDrawAt(instant)?.slug).toBe(slug);
      expect(selectHomeDrawCards(Date.parse(instant)).filter((card) => card.isNext)).toHaveLength(1);
    });

    it("a las 20:30 exactas rota a Tempranero del siguiente día calendario", () => {
      const cards = selectHomeDrawCards(Date.parse("2026-08-26T23:30:00Z"));
      const active = cards.find((card) => card.isNext);

      expect(active).toMatchObject({
        slug: "tempranero",
        targetAt: "2026-08-27T13:30:00.000Z",
        statusLabel: "EN 14H 00M 00S",
        isTomorrow: true,
      });
      expect(cards.filter((card) => card.isNext)).toHaveLength(1);
      expect(cards.filter((card) => card.statusLabel !== null)).toHaveLength(1);
    });

    it("produce un primer render estable para SSR sin usar la hora del servidor", () => {
      const cards = selectHomeDrawCards(Number.NaN);

      expect(cards).toHaveLength(4);
      expect(cards.every((card) => !card.isNext && card.targetAt === null)).toBe(true);
      expect(cards.every((card) => card.statusLabel === null)).toBe(true);
      expect(cards.map((card) => card.timeLabel)).toEqual(["10:30", "13:00", "16:30", "20:30"]);
    });
  });

  describe("selectHomePublishedResults", () => {
    it("define las cuatro tabs canónicas en el orden aprobado", () => {
      expect(HOME_RESULT_TABS).toEqual([
        { id: "head", label: "A LA CABEZA" },
        { id: "prizes", label: "A LOS PREMIOS" },
        { id: "redoblona", label: "REDOBLONA" },
        { id: "invert", label: "INVERTIDA" },
      ]);
    });

    it("conserva todos los resultados recibidos, ordena y normaliza a tres cifras", () => {
      const results: MockResult[] = [
        ["one", "7", "2026-08-26T12:00:00Z"],
        ["two", "208", "2026-08-26T11:00:00Z"],
        ["three", "31", "2026-08-26T10:00:00Z"],
        ["four", "044", "2026-08-26T09:00:00Z"],
        ["five", "9", "2026-08-26T08:00:00Z"],
        ["six", "83", "2026-08-26T07:00:00Z"],
      ].map(([id, result, occurredAt]) => ({
        id,
        source: "DRAW",
        gameId: "head",
        gameName: "A la Cabeza",
        result,
        occurredAt,
      }));

      const mapped = selectHomePublishedResults(catalog(), results);

      expect(mapped).toHaveLength(6);
      expect(mapped.map((result) => result.id)).toEqual([
        "one-1",
        "two-1",
        "three-1",
        "four-1",
        "five-1",
        "six-1",
      ]);
      expect(mapped.map((result) => result.value)).toEqual([
        "007",
        "208",
        "031",
        "044",
        "009",
        "083",
      ]);
      expect(mapped.every((result) => result.tabId === "head")).toBe(true);
    });

    it("renderiza cada número estructurado recibido sin inventar su posición", () => {
      const mapped = selectHomePublishedResults(catalog(), [
        {
          id: "premios",
          source: "DRAW",
          gameId: "prizes",
          gameName: "A los Premios",
          result: "999",
          resultNumbers: ["44", "208", "7", "83", "731"],
          occurredAt: "2026-08-26T11:30:00Z",
          label: "Matutino",
        },
      ]);

      expect(mapped.map((result) => result.value)).toEqual([
        "044",
        "208",
        "007",
        "083",
        "731",
      ]);
      expect(mapped.map((result) => result.position)).toEqual([
        null,
        null,
        null,
        null,
        null,
      ]);
      expect(mapped.every((result) => result.tabId === "prizes")).toBe(true);
    });

    it("separa modalidades y excluye Instantáneas, Mega Loto e IDs ambiguos", () => {
      const mapped = selectHomePublishedResults(catalog(), [
        {
          id: "head",
          source: "DRAW",
          gameId: "head",
          result: "497",
          occurredAt: "2026-08-26T12:00:00Z",
        },
        {
          id: "redoblona",
          source: "DRAW",
          gameId: "redoblona",
          result: "44",
          occurredAt: "2026-08-26T11:00:00Z",
        },
        {
          id: "invert",
          source: "DRAW",
          gameId: "invert",
          result: "83",
          occurredAt: "2026-08-26T10:00:00Z",
        },
        {
          id: "instant",
          source: "INSTANT",
          gameId: "head",
          result: "111",
          occurredAt: "2026-08-26T09:00:00Z",
        },
        {
          id: "mega",
          source: "DRAW",
          gameId: "megaloto",
          result: "222",
          occurredAt: "2026-08-26T08:00:00Z",
        },
        {
          id: "unknown",
          source: "DRAW",
          gameId: "unknown",
          result: "333",
          occurredAt: "2026-08-26T07:00:00Z",
        },
      ]);

      expect(mapped.map((result) => result.id)).toEqual([
        "head-1",
        "redoblona-1",
        "invert-1",
      ]);
      expect(mapped.map((result) => result.tabId)).toEqual([
        "head",
        "redoblona",
        "invert",
      ]);
    });

    it("excluye una publicación asociada a un sorteo de familia Mega Loto", () => {
      const megaDraw: DrawDefinition = {
        id: "mega-draw",
        label: "Mega",
        family: "MEGALOTO",
        status: "OPEN",
        drawsAt: "2026-08-26T15:00:00Z",
        closesAt: "2026-08-26T14:45:00Z",
      };

      expect(selectHomePublishedResults(
        catalog([...catalog().draws, megaDraw]),
        [{
          id: "mega-family",
          source: "DRAW",
          drawId: "mega-draw",
          gameId: "head",
          result: "333",
          occurredAt: "2026-08-26T10:00:00Z",
        }],
      )).toEqual([]);
    });

    it("usa fallbacks válidos, labels limpios y descarta datos fuera de contrato", () => {
      const base = catalog();
      const morning: DrawDefinition = {
        ...base.draws.find((draw) => draw.id === "morning")!,
        label: "Matutino · 13:00",
      };
      const mapped = selectHomePublishedResults(
        catalog([morning]),
        [
          {
            id: "known",
            source: "DRAW",
            drawId: "morning",
            gameId: "head",
            resultNumbers: ["5"],
            publishedAt: "2026-08-26T11:30:00Z",
          },
          {
            id: "zero",
            source: "DRAW",
            gameId: "head",
            result: "0",
            occurredAt: "2026-08-26T11:00:00Z",
          },
          {
            id: "compound",
            source: "DRAW",
            gameId: "head",
            result: "497 · 208",
            occurredAt: "2026-08-26T10:00:00Z",
          },
          {
            id: "invalid-date",
            source: "DRAW",
            gameId: "head",
            result: "555",
            occurredAt: "ayer",
          },
        ],
      );

      expect(mapped).toHaveLength(1);
      expect(mapped[0]).toMatchObject({
        id: "known-1",
        value: "005",
        drawLabel: "Matutino",
        occurredAt: "2026-08-26T11:30:00Z",
      });
    });
  });
});
