import { describe, expect, it } from "vitest";

import {
  getHeroCountdown,
  getHomeHeroDrawIcon,
  selectLatestHeroResult,
  selectNextHeroDraw,
} from "@/features/product/home-hero-data";
import { buildGamingCatalog } from "@/lib/gaming/catalog";
import type { DrawDefinition, GamingCatalog } from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");

function catalog(): GamingCatalog {
  return buildGamingCatalog("REFUND", new Date("2026-08-26T10:00:00.000Z"));
}

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

describe("datos autoritativos del hero", () => {
  describe("selectLatestHeroResult", () => {
    it("elige por fecha real, no por orden de respuesta, y normaliza a tres cifras", () => {
      const results: MockResult[] = [
        {
          id: "older",
          source: "DRAW",
          gameId: "head",
          result: "999",
          occurredAt: "2026-08-26T09:00:00.000Z",
        },
        {
          id: "latest",
          source: "DRAW",
          gameId: "head",
          result: "7",
          occurredAt: "2026-08-26T11:00:00.000Z",
        },
        {
          id: "middle",
          source: "DRAW",
          gameId: "head",
          result: "208",
          occurredAt: "2026-08-26T10:00:00.000Z",
        },
      ];

      expect(selectLatestHeroResult(results, catalog())).toEqual({
        id: "latest",
        value: "007",
        occurredAt: "2026-08-26T11:00:00.000Z",
        spinKey: "latest:2026-08-26T11:00:00.000Z",
      });
    });

    it("usa publishedAt y la primera representación numérica válida disponible", () => {
      const result: MockResult = {
        id: "legacy",
        source: "DRAW",
        gameId: "head",
        result: "497 · 208",
        resultNumbers: ["044"],
        publishedAt: "2026-08-26T11:30:00Z",
      };

      expect(selectLatestHeroResult([result], catalog())).toMatchObject({
        id: "legacy",
        value: "044",
        occurredAt: "2026-08-26T11:30:00Z",
      });
    });

    it("acepta resultados legacy cuyo drawId ya no está en el catálogo si el juego es Quiniela", () => {
      const result: MockResult = {
        id: "legacy-draw",
        source: "DRAW",
        drawId: "previous-quiniela-1",
        gameId: "head",
        result: "497",
        occurredAt: "2026-08-26T11:00:00Z",
      };

      expect(selectLatestHeroResult([result], catalog())?.value).toBe("497");
    });

    it("excluye instantáneas, Mega Loto y contradicciones de familia", () => {
      const remoteCatalog = catalog();
      const megalotoDraw = draw({
        id: "mega-draw",
        family: "MEGALOTO",
        drawsAt: "2026-08-26T13:00:00Z",
        closesAt: "2026-08-26T12:45:00Z",
      });
      const results: MockResult[] = [
        {
          id: "instant",
          source: "INSTANT",
          gameId: "sapyaite",
          result: "777",
          occurredAt: "2026-08-26T11:59:00Z",
        },
        {
          id: "mega-by-game",
          source: "DRAW",
          gameId: "megaloto",
          result: "888",
          occurredAt: "2026-08-26T11:58:00Z",
        },
        {
          id: "mega-by-draw",
          source: "DRAW",
          drawId: "mega-draw",
          gameId: "head",
          result: "999",
          occurredAt: "2026-08-26T11:57:00Z",
        },
      ];

      expect(
        selectLatestHeroResult(results, {
          ...remoteCatalog,
          draws: [...remoteCatalog.draws, megalotoDraw],
        }),
      ).toBeNull();
    });

    it.each(["000", "1000", "-1", "12.5", "abc", "497 · 208", ""])(
      "descarta el resultado inválido %j sin fabricar un fallback",
      (value) => {
        expect(
          selectLatestHeroResult(
            [{
              id: "invalid",
              source: "DRAW",
              gameId: "head",
              result: value,
              occurredAt: "2026-08-26T11:00:00Z",
            }],
            catalog(),
          ),
        ).toBeNull();
      },
    );

    it("descarta entradas ambiguas o sin timestamp verificable", () => {
      expect(
        selectLatestHeroResult(
          [
            {
              id: "unknown",
              source: "DRAW",
              result: "497",
              occurredAt: "2026-08-26T11:00:00Z",
            },
            {
              id: "invalid-date",
              source: "DRAW",
              gameId: "head",
              result: "497",
              occurredAt: "ayer",
            },
          ],
          catalog(),
        ),
      ).toBeNull();
    });

    it("cambia spinKey aunque un sorteo nuevo repita el mismo número", () => {
      const first = selectLatestHeroResult(
        [{
          id: "draw-a",
          source: "DRAW",
          gameId: "head",
          result: "497",
          occurredAt: "2026-08-26T10:00:00Z",
        }],
        catalog(),
      );
      const second = selectLatestHeroResult(
        [{
          id: "draw-b",
          source: "DRAW",
          gameId: "head",
          result: "497",
          occurredAt: "2026-08-26T11:00:00Z",
        }],
        catalog(),
      );

      expect(first?.value).toBe(second?.value);
      expect(first?.spinKey).not.toBe(second?.spinKey);
    });
  });

  describe("selectNextHeroDraw", () => {
    it("elige el próximo QUINIELA por drawsAt y no por el orden ni el horario del label", () => {
      const draws = [
        draw({
          id: "night",
          label: "Nocturno · 21:00",
          drawsAt: "2026-08-26T18:00:00Z",
          closesAt: "2026-08-26T17:45:00Z",
        }),
        draw({
          id: "morning",
          label: "Matutino · 13:00",
          drawsAt: "2026-08-26T13:00:00Z",
          closesAt: "2026-08-26T12:45:00Z",
        }),
      ];

      expect(selectNextHeroDraw(draws, NOW)).toEqual({
        id: "morning",
        name: "Matutino",
        drawsAt: "2026-08-26T13:00:00Z",
        closesAt: "2026-08-26T12:45:00Z",
        timeLabel: "10:00",
        href: "/quinielas",
        iconSlug: "matutino",
        state: "open",
      });
    });

    it("mantiene el próximo sorteo visible como cerrado sin countdown negativo", () => {
      const next = selectNextHeroDraw(
        [draw({
          id: "morning",
          drawsAt: "2026-08-26T13:00:00Z",
          closesAt: "2026-08-26T11:59:59Z",
        })],
        NOW,
      );

      expect(next?.state).toBe("closed");
      expect(getHeroCountdown(next!.closesAt, NOW)).toMatchObject({
        state: "closed",
        totalSeconds: 0,
        hours: "00",
        minutes: "00",
        seconds: "00",
      });
    });

    it("marca cierre inválido o posterior al sorteo como unavailable", () => {
      const invalid = selectNextHeroDraw(
        [draw({
          id: "early",
          drawsAt: "2026-08-26T13:00:00Z",
          closesAt: "sin-fecha",
        })],
        NOW,
      );
      const afterDraw = selectNextHeroDraw(
        [draw({
          id: "early",
          drawsAt: "2026-08-26T13:00:00Z",
          closesAt: "2026-08-26T13:05:00Z",
        })],
        NOW,
      );

      expect(invalid?.state).toBe("unavailable");
      expect(afterDraw?.state).toBe("unavailable");
    });

    it("ignora Mega Loto, fechas inválidas y sorteos ya realizados", () => {
      const draws = [
        draw({
          id: "mega",
          family: "MEGALOTO",
          drawsAt: "2026-08-26T12:30:00Z",
          closesAt: "2026-08-26T12:15:00Z",
        }),
        draw({
          id: "invalid",
          drawsAt: "mañana",
          closesAt: "2026-08-26T12:45:00Z",
        }),
        draw({
          id: "past",
          drawsAt: "2026-08-26T12:00:00Z",
          closesAt: "2026-08-26T11:45:00Z",
        }),
      ];

      expect(selectNextHeroDraw(draws, NOW)).toBeNull();
      expect(selectNextHeroDraw(draws, Number.NaN)).toBeNull();
    });

    it("conserva nombres remotos y no inventa icono para IDs desconocidos", () => {
      const next = selectNextHeroDraw(
        [draw({
          id: "remote-special",
          label: "Edición especial",
          drawsAt: "2026-08-26T13:00:00Z",
          closesAt: "2026-08-26T12:45:00Z",
        })],
        NOW,
      );

      expect(next).toMatchObject({
        id: "remote-special",
        name: "Edición especial",
        iconSlug: null,
      });
    });
  });

  describe("getHeroCountdown", () => {
    it("calcula desde timestamps absolutos, conserva horas totales y redondea el segundo activo", () => {
      expect(getHeroCountdown("2026-08-27T14:02:03.250Z", NOW)).toEqual({
        state: "open",
        totalSeconds: 93_724,
        hours: "26",
        minutes: "02",
        seconds: "04",
      });
    });

    it("cierra exactamente en el instante de closesAt", () => {
      expect(getHeroCountdown("2026-08-26T12:00:00Z", NOW).state).toBe("closed");
    });

    it("expone unavailable ante fecha o reloj inválidos", () => {
      expect(getHeroCountdown("no-es-fecha", NOW)).toEqual({
        state: "unavailable",
        totalSeconds: null,
        hours: null,
        minutes: null,
        seconds: null,
      });
      expect(getHeroCountdown("2026-08-26T13:00:00Z", Infinity).state).toBe(
        "unavailable",
      );
    });
  });

  describe("getHomeHeroDrawIcon", () => {
    it.each([
      ["early", "tempranero"],
      ["morning", "matutino"],
      ["evening", "vespertino"],
      ["night", "nocturno"],
    ] as const)("mapea %s a los assets dark/light de %s", (drawId, slug) => {
      expect(getHomeHeroDrawIcon(drawId)).toEqual({
        slug,
        dark: `/assets/quinie-home-v3/draws/dark/${slug}.webp`,
        light: `/assets/quinie-home-v3/draws/light/${slug}.webp`,
      });
    });

    it("no compone rutas con IDs remotos desconocidos", () => {
      expect(getHomeHeroDrawIcon("../../secreto")).toBeNull();
    });
  });
});
