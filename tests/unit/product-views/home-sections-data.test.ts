import { describe, expect, it } from "vitest";

import {
  HOME_DRAW_SLOTS,
  HOME_RESULT_TABS,
  HOME_TIME_ZONE,
  selectHomeDrawCards,
  selectHomeLatestDrawResults,
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
        href: "/sorteos/tempranero?fecha=2026-08-26",
        timeLabel: "10:30",
        dateLabel: "Hoy",
        statusLabel: "EN 01H 15M 00S",
        targetAt: "2026-08-26T13:30:00.000Z",
        isNext: true,
        isTomorrow: false,
        isPast: false,
      });
      expect(cards.filter((card) => card.isNext)).toHaveLength(1);
      expect(cards.filter((card) => card.statusLabel !== null)).toHaveLength(1);
      expect(cards.filter((card) => card.targetAt !== null)).toHaveLength(4);
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
      expect(cards.every((card) => card.isTomorrow && card.dateLabel === "Mañana")).toBe(true);
      expect(cards.every((card) => card.href.endsWith("?fecha=2026-08-27"))).toBe(true);
    });

    it.each([
      ["2026-08-26T13:29:59.999Z", "early"],
      ["2026-08-26T13:30:00.000Z", "morning"],
      ["2026-08-26T16:00:00.000Z", "evening"],
      ["2026-08-26T19:30:00.000Z", "night"],
      ["2026-08-26T23:30:00.000Z", "early"],
    ])("elige el próximo sorteo estricto en la frontera %s", (instant, expectedId) => {
      const cards = selectHomeDrawCards(Date.parse(instant));
      expect(cards.filter((card) => card.isNext).map((card) => card.id)).toEqual([expectedId]);
      expect(Date.parse(cards.find((card) => card.isNext)!.targetAt!)).toBeGreaterThan(Date.parse(instant));
    });

    it("no confunde cierre de ventas con inicio del sorteo", () => {
      const cards = selectHomeDrawCards(Date.parse("2026-08-26T13:15:00Z"));
      expect(cards.find((card) => card.isNext)).toMatchObject({
        id: "early", statusLabel: "EN 00H 15M 00S", isTomorrow: false,
      });
    });

    it("identifica mañana por fecha de Paraguay y actualiza a Hoy a medianoche", () => {
      const before = selectHomeDrawCards(Date.parse("2026-08-27T02:59:59Z"));
      const after = selectHomeDrawCards(Date.parse("2026-08-27T03:00:00Z"));
      expect(before.every((card) => card.dateLabel === "Mañana" && card.isTomorrow)).toBe(true);
      expect(after.every((card) => card.dateLabel === "Hoy" && !card.isTomorrow)).toBe(true);
      expect(before.map((card) => card.href)).toEqual(after.map((card) => card.href));
    });

    it("respeta horarios operativos modificados aunque cambien el orden habitual", () => {
      const base = catalog().draws;
      const received: DrawDefinition[] = [
        { ...base[0], label: "Tempranero · 10:30", drawsAt: "2026-08-26T20:00:00Z" },
        { ...base[1], drawsAt: "2026-08-26T16:15:00Z" },
        { ...base[2], drawsAt: "2026-08-26T19:45:00Z" },
        { ...base[3], drawsAt: "2026-08-26T23:45:00Z" },
      ];
      const cards = selectHomeDrawCards(Date.parse("2026-08-26T14:00:00Z"), received);
      expect(cards[0]).toMatchObject({ timeLabel: "17:00", targetAt: received[0].drawsAt, isNext: false });
      expect(cards[1]).toMatchObject({ timeLabel: "13:15", targetAt: received[1].drawsAt, isNext: true });
      expect(cards.map((card) => card.timeLabel)).toEqual(["17:00", "13:15", "16:45", "20:45"]);
      expect(cards.every((card) => card.href.endsWith("?fecha=2026-08-26"))).toBe(true);
    });

    it("no inventa horarios para un catálogo remoto vacío, inválido o de otra familia", () => {
      const now = Date.parse("2026-08-26T12:15:00Z");
      const empty = selectHomeDrawCards(now, []);
      const base = catalog().draws;
      const invalid = selectHomeDrawCards(now, [
        { ...base[0], drawsAt: "sin-fecha" },
        { ...base[1], family: "MEGALOTO" },
      ]);
      expect(empty).toEqual(invalid);
      expect(empty.every((card) => card.targetAt === null && !card.isNext)).toBe(true);
      expect(empty.every((card) => card.timeLabel === "—" && card.dateLabel === null)).toBe(true);
      expect(empty.every((card) => !card.href.includes("?"))).toBe(true);
    });

    it("conserva fecha real de sorteos remotos pasados sin avanzarlos artificialmente", () => {
      const received = catalog().draws.map((draw) => ({
        ...draw, drawsAt: "2026-08-25T23:30:00Z",
      }));
      const cards = selectHomeDrawCards(Date.parse("2026-08-26T14:00:00Z"), received);
      expect(cards.every((card) => card.isPast && !card.isNext && !card.isTomorrow)).toBe(true);
      expect(cards.every((card) => card.dateLabel === "25/08/2026")).toBe(true);
      expect(cards.every((card) => card.href.endsWith("?fecha=2026-08-25"))).toBe(true);
      expect(cards.every((card) => card.statusLabel === null)).toBe(true);
    });

    it("busca la siguiente ocurrencia válida de cada slot y sólo activa una en empates", () => {
      const base = catalog().draws;
      const cards = selectHomeDrawCards(Date.parse("2026-08-26T14:00:00Z"), [
        { ...base[0], drawsAt: "2026-08-25T13:30:00Z" },
        { ...base[0], drawsAt: "2026-08-28T13:30:00Z" },
        { ...base[0], drawsAt: "2026-08-27T13:30:00Z" },
        { ...base[1], drawsAt: "2026-08-27T13:30:00Z" },
      ]);
      expect(cards[0]).toMatchObject({
        targetAt: "2026-08-27T13:30:00Z", dateLabel: "Mañana", isTomorrow: true, isNext: true,
      });
      expect(cards[1].isNext).toBe(false);
      expect(cards.filter((card) => card.isNext)).toHaveLength(1);
    });

    it("a la hora exacta de un sorteo recibido lo marca pasado y conserva su fecha", () => {
      const received = [catalog().draws[0]];
      const cards = selectHomeDrawCards(Date.parse(received[0].drawsAt), received);
      expect(cards[0]).toMatchObject({ isPast: true, isNext: false, dateLabel: "Hoy" });
      expect(cards[0].targetAt).toBe(received[0].drawsAt);
      expect(cards.filter((card) => card.isNext)).toHaveLength(0);
    });

    it("produce un primer render estable para SSR sin usar la hora del servidor", () => {
      const cards = selectHomeDrawCards(Number.NaN);

      expect(cards).toHaveLength(4);
      expect(cards.every((card) => !card.isNext && card.targetAt === null)).toBe(true);
      expect(cards.every((card) => card.statusLabel === null)).toBe(true);
      expect(cards.map((card) => card.timeLabel)).toEqual(["—", "—", "—", "—"]);
      expect(cards.every((card) => card.dateLabel === null && !card.isPast)).toBe(true);
    });

    it("muestra horarios recibidos sin activar el próximo hasta disponer de reloj", () => {
      const cards = selectHomeDrawCards(Number.NaN, catalog().draws);
      expect(cards.map((card) => card.timeLabel)).toEqual(["10:30", "13:00", "16:30", "20:30"]);
      expect(cards.every((card) => !card.isNext && !card.isPast && card.targetAt !== null)).toBe(true);
    });
  });

  describe("selectHomeLatestDrawResults", () => {
    function result(id: string, overrides: Partial<MockResult> = {}): MockResult {
      return {
        id, source: "DRAW", drawId: "morning", gameId: "head",
        occurredAt: "2026-08-26T16:00:00Z", ...overrides,
      };
    }

    function snapshot(values: readonly string[]) {
      return values.map((value, index) => ({ position: index + 1, value }));
    }

    function unknownPositions() {
      return Array.from({ length: 14 }, (_, index) => ({
        position: index + 1, value: null, ending: null, combinations: [],
      }));
    }

    it("define las cuatro tabs canónicas en el orden aprobado", () => {
      expect(HOME_RESULT_TABS).toEqual([
        { id: "head", label: "A LA CABEZA" },
        { id: "prizes", label: "A LOS PREMIOS" },
        { id: "redoblona", label: "REDOBLONA" },
        { id: "invert", label: "INVERTIDA" },
      ]);
    });

    it("selecciona un único último sorteo y ordena sus 14 posiciones canónicas", () => {
      const values = ["497", "208", "000", "731", "112", "005", "830", "701", "550", "909", "123", "888", "010", "044"];
      const mapped = selectHomeLatestDrawResults(catalog(), [
        result("previous-day", { drawId: "night", occurredAt: "2026-08-25T23:30:00Z", drawNumbers: snapshot(["999"]) }),
        result("latest", { drawId: "night", occurredAt: "2026-08-26T23:30:00Z", drawNumbers: snapshot(values).reverse() }),
        result("earlier-today", { drawId: "evening", occurredAt: "2026-08-26T19:30:00Z", drawNumbers: snapshot(["777"]) }),
      ]);

      expect(mapped).toMatchObject({
        id: "2026-08-26:night", drawId: "night", drawLabel: "Nocturno",
        dateKey: "2026-08-26", dateLabel: "26/08/2026",
        occurredAt: "2026-08-26T23:30:00.000Z", timeLabel: "20:30",
      });
      expect(mapped?.positions).toHaveLength(14);
      expect(mapped?.positions.map((item) => item.position)).toEqual(Array.from({ length: 14 }, (_, index) => index + 1));
      expect(mapped?.positions.map((item) => item.value)).toEqual(values);
      expect(mapped?.positions[0].value).toBe("497");
      expect(mapped?.positions.slice(1).map((item) => item.value)).toEqual(values.slice(1));
    });

    it("ordena por occurredAt recibido, no por el orden estático de tarjetas ni publishedAt", () => {
      const mapped = selectHomeLatestDrawResults(catalog(), [
        result("night", { drawId: "night", occurredAt: "2026-08-26T21:00:00Z", publishedAt: "2026-08-27T02:00:00Z", drawNumbers: snapshot(["111"]) }),
        result("delayed-early", { drawId: "early", occurredAt: "2026-08-26T22:00:00Z", drawNumbers: snapshot(["222"]) }),
      ]);
      expect(mapped?.drawId).toBe("early");
      expect(mapped?.positions[0].value).toBe("222");
    });

    it("usa la fecha de Paraguay y el fallback publishedAt cuando occurredAt es inválido", () => {
      const mapped = selectHomeLatestDrawResults(catalog(), [
        result("fallback", { drawId: "night", occurredAt: "inválido", publishedAt: "2026-08-27T02:59:59Z", drawNumbers: snapshot(["7"]) }),
      ]);
      expect(mapped).toMatchObject({
        id: "2026-08-26:night", dateKey: "2026-08-26", dateLabel: "26/08/2026",
        occurredAt: "2026-08-27T02:59:59.000Z", timeLabel: "23:59",
      });
    });

    it("mantiene un snapshot aunque cuatro modalidades repliquen la misma publicación", () => {
      const values = ["007", "007", "000", "731", "112", "005", "830", "701", "550", "909", "123", "888", "010", "044"];
      const mapped = selectHomeLatestDrawResults(catalog(), HOME_RESULT_TABS.map(({ id }) => result(id, {
        gameId: id, result: "999", resultNumbers: ["999"], drawNumbers: snapshot(values),
      })));
      expect(mapped?.positions).toHaveLength(14);
      expect(mapped?.positions.map((item) => item.value)).toEqual(values);
      expect(mapped?.positions[0].value).toBe(mapped?.positions[1].value);
    });

    it("no rellena el snapshot parcial más reciente desde otras modalidades, fechas o versiones", () => {
      const mapped = selectHomeLatestDrawResults(catalog(), [
        result("previous-date", { occurredAt: "2026-08-25T16:00:00Z", drawNumbers: snapshot(["999", "888", "777"]) }),
        result("old-snapshot", { drawNumbers: snapshot(["101", "202", "303"]) }),
        result("latest-snapshot", { gameId: "prizes", occurredAt: "2026-08-26T16:05:00Z", drawNumbers: [{ position: 2, value: "44" }, { position: 14, value: "0" }] }),
        result("legacy-head-newer", { occurredAt: "2026-08-26T16:06:00Z", result: "777" }),
        result("other-modality", { gameId: "redoblona", occurredAt: "2026-08-26T16:02:00Z", drawNumbers: [{ position: 3, value: "606" }] }),
        result("other-draw", { drawId: "early", occurredAt: "2026-08-26T13:30:00Z", drawNumbers: snapshot(["444"]) }),
      ]);
      expect(mapped?.positions.map((item) => item.value)).toEqual(Array.from({ length: 14 }, (_, index) => index === 1 ? "044" : index === 13 ? "000" : null));
      expect(mapped?.positions[0]).toEqual(unknownPositions()[0]);
    });

    it.each([
      { drawNumbers: [] },
      { drawNumbers: [{ position: 0, value: "123" }, { position: 15, value: "456" }, { position: 1, value: "invalid" }] },
    ])("preserva el último snapshot vacío o inválido sin restaurar datos anteriores (%j)", ({ drawNumbers }) => {
      const mapped = selectHomeLatestDrawResults(catalog(), [
        result("old", { drawNumbers: snapshot(Array.from({ length: 14 }, (_, index) => String(index + 1))) }),
        result("new-empty", { gameId: "prizes", occurredAt: "2026-08-26T16:05:00Z", drawNumbers }),
        result("legacy", { occurredAt: "2026-08-26T16:06:00Z", result: "888" }),
      ]);
      expect(mapped?.id).toBe("2026-08-26:morning");
      expect(mapped?.positions).toEqual(unknownPositions());
    });

    it("no vuelve a un sorteo anterior cuando el último sólo tiene resultados legacy sin posturas", () => {
      const mapped = selectHomeLatestDrawResults(catalog(), [
        result("older-complete", { drawId: "early", occurredAt: "2026-08-26T13:30:00Z", drawNumbers: snapshot(["777", "888"]) }),
        result("latest-legacy", { gameId: "prizes", resultNumbers: ["123", "456"] }),
      ]);
      expect(mapped?.drawId).toBe("morning");
      expect(mapped?.positions).toEqual(unknownPositions());
    });

    it.each(["0", "000", "7", " 007 ", "999"])("admite cabeza legacy numérica %s sin atribuirle otras posturas", (value) => {
      const mapped = selectHomeLatestDrawResults(catalog(), [result("legacy-head", { result: value })]);
      expect(mapped?.positions[0].value).toBe(value.trim().padStart(3, "0"));
      expect(mapped?.positions.slice(1)).toEqual(unknownPositions().slice(1));
    });

    it("respeta la prioridad legacy de resultNumbers y no convierte su segundo número en cabeza", () => {
      const mapped = selectHomeLatestDrawResults(catalog(), [result("legacy-array", {
        result: "999", resultNumbers: ["000", "777"], numbers: ["888"],
      })]);
      expect(mapped?.positions[0].value).toBe("000");
      expect(mapped?.positions.slice(1)).toEqual(unknownPositions().slice(1));
      const invalidFirst = selectHomeLatestDrawResults(catalog(), [result("invalid-first", { resultNumbers: ["compuesto", "007"] })]);
      expect(invalidFirst?.positions).toEqual(unknownPositions());
    });

    it.each(["1234", "-7", "12.5", "497 · 208", "NaN"])("no publica una cabeza legacy inválida (%s)", (value) => {
      expect(selectHomeLatestDrawResults(catalog(), [result("invalid", { result: value })])?.positions).toEqual(unknownPositions());
    });

    it.each(["prizes", "redoblona", "invert"])("no asigna posiciones a números legacy de %s", (gameId) => {
      const mapped = selectHomeLatestDrawResults(catalog(), [result("unpositioned", { gameId, resultNumbers: ["497", "208", "007"] })]);
      expect(mapped?.positions).toEqual(unknownPositions());
    });

    it("acepta un snapshot explícito sin modalidad", () => {
      const mapped = selectHomeLatestDrawResults(catalog(), [result("canonical-only", {
        gameId: undefined, drawNumbers: [{ position: 7, value: "9" }],
      })]);
      expect(mapped?.positions[6]).toMatchObject({ position: 7, value: "009", ending: "09" });
      expect(mapped?.positions[0].value).toBeNull();
    });

    it("excluye Mega Loto, instantáneas, modalidades desconocidas y publicaciones sin identificación", () => {
      const excluded: MockResult[] = [
        result("instant", { source: "INSTANT", drawNumbers: snapshot(["111"]) }),
        result("missing-source", { source: undefined, drawNumbers: snapshot(["111"]) }),
        result("mega", { gameId: "megaloto", drawNumbers: snapshot(["222"]) }),
        result("instant-game", { gameId: "sapyaite", drawNumbers: snapshot(["333"]) }),
        result("unknown-game", { gameId: "unknown", drawNumbers: snapshot(["444"]) }),
        result("no-modality-or-snapshot", { gameId: undefined, result: "555" }),
        result("unknown-draw", { drawId: "unknown", drawNumbers: snapshot(["666"]) }),
        result("no-date", { occurredAt: "ayer", drawNumbers: snapshot(["777"]) }),
        result("ambiguous-name", { drawId: undefined, label: "Matutino y Vespertino", drawNumbers: snapshot(["888"]) }),
      ];
      expect(selectHomeLatestDrawResults(catalog(), excluded)).toBeNull();
      const latest = selectHomeLatestDrawResults(catalog(), [
        result("valid", { drawId: "early", occurredAt: "2026-08-26T13:30:00Z", drawNumbers: snapshot(["007"]) }),
        ...excluded,
      ]);
      expect(latest?.id).toBe("2026-08-26:early");
      expect(latest?.positions[0].value).toBe("007");
    });

    it("reconoce slugs y aliases inequívocos sin adivinar el sorteo por la hora", () => {
      const aliasedCatalog = catalog([{ ...catalog().draws[0], id: "draw-123", label: "Asunción · Vespertino" }]);
      const aliased = selectHomeLatestDrawResults(aliasedCatalog, [result("alias", {
        drawId: "draw-123", occurredAt: "2026-08-26T13:00:00Z", drawNumbers: snapshot(["7"]),
      })]);
      expect(aliased).toMatchObject({ id: "2026-08-26:evening", drawId: "evening", drawLabel: "Vespertino" });
      expect(selectHomeLatestDrawResults(catalog(), [result("slug", { drawId: "matutino", drawNumbers: snapshot(["7"]) })])?.drawId).toBe("morning");
      expect(selectHomeLatestDrawResults(catalog(), [result("name", { drawId: undefined, label: "Nocturno", drawNumbers: snapshot(["7"]) })])?.drawId).toBe("night");
    });

    it("rechaza la familia Mega Loto incluso si su alias parece un sorteo de Quiniela", () => {
      const megaCatalog = catalog([{ ...catalog().draws[0], id: "mega-alias", label: "Nocturno", family: "MEGALOTO" }]);
      expect(selectHomeLatestDrawResults(megaCatalog, [result("mega-family", { drawId: "mega-alias", drawNumbers: snapshot(["111"]) })])).toBeNull();
    });

    it("conserva posturas explícitas y huecos sin renumerar valores inválidos", () => {
      const mapped = selectHomeLatestDrawResults(catalog(), [result("positions", { drawNumbers: [
        { position: 14, value: "44" }, { position: 2, value: "007" },
        { position: 2, value: "999" }, { position: 1, value: "0" },
        { position: 0, value: "111" }, { position: 15, value: "222" },
        { position: 2.5, value: "333" }, { position: 3, value: "1234" },
        { position: 4, value: "-7" }, { position: 5, value: " " },
      ] })]);
      expect(mapped?.positions.map((item) => item.value)).toEqual(["000", "007", ...Array(11).fill(null), "044"]);
    });

    it("deriva terminaciones y permutaciones estables del número original, sin perder ceros", () => {
      const mapped = selectHomeLatestDrawResults(catalog(), [result("relations", {
        drawNumbers: snapshot(["497", "007", "044", "123", "111", "000"]),
      })]);
      expect(mapped?.positions.slice(0, 6).map((item) => item.ending)).toEqual(["97", "07", "44", "23", "11", "00"]);
      expect(mapped?.positions[0].combinations).toEqual(["497", "479", "947", "974", "749", "794"]);
      expect(mapped?.positions[1]).toEqual({ position: 2, value: "007", ending: "07", combinations: ["007", "070", "700"] });
      expect(mapped?.positions[2].combinations).toEqual(["044", "404", "440"]);
      expect(mapped?.positions[3].combinations).toEqual(["123", "132", "213", "231", "312", "321"]);
      expect(mapped?.positions[4].combinations).toEqual(["111"]);
      expect(mapped?.positions[5].combinations).toEqual(["000"]);
      expect(mapped?.positions[6]).toEqual(unknownPositions()[6]);
    });

    it("usa la copia más reciente de un ID repetido y no muta los resultados originales", () => {
      const results = [
        result("same-id", { drawNumbers: snapshot(["111"]) }),
        result("same-id", { occurredAt: "2026-08-26T16:01:00Z", drawNumbers: snapshot(["222"]) }),
      ];
      const original = structuredClone(results);
      const mapped = selectHomeLatestDrawResults(catalog(), results);
      expect(mapped?.positions[0].value).toBe("222");
      expect(results).toEqual(original);
    });

    it("devuelve null ante historial vacío o sin publicaciones utilizables", () => {
      expect(selectHomeLatestDrawResults(catalog(), [])).toBeNull();
      expect(selectHomeLatestDrawResults(catalog(), [result("empty")])).toBeNull();
    });
  });
});
