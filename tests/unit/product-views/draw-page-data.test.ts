import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DRAW_PAGE_DEFINITIONS,
  getConfiguredDrawStreamUrl,
  getDrawPageCountdown,
  getDrawPageDefinition,
  sanitizePublicDrawStreamUrl,
  selectDrawPageResults,
  selectDrawPageSchedule,
} from "@/features/product/draw-page-data";
import type { DrawDefinition } from "@/lib/gaming/types";
import type { MockResult } from "@/lib/product/api-types";

function draw(input: Partial<DrawDefinition> = {}): DrawDefinition {
  return {
    id: "early",
    label: "Tempranero · 09:00",
    family: "QUINIELA",
    closesAt: "2026-08-26T11:45:00.000Z",
    drawsAt: "2026-08-26T12:00:00.000Z",
    status: "OPEN",
    ...input,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("datos de páginas de sorteos", () => {
  it("expone únicamente los cuatro slugs estáticos y su mapeo canónico", () => {
    expect(DRAW_PAGE_DEFINITIONS).toEqual([
      expect.objectContaining({ slug: "tempranero", drawId: "early" }),
      expect.objectContaining({ slug: "matutino", drawId: "morning" }),
      expect.objectContaining({ slug: "vespertino", drawId: "evening" }),
      expect.objectContaining({ slug: "nocturno", drawId: "night" }),
    ]);
    expect(getDrawPageDefinition("tempranero")).toMatchObject({
      name: "Tempranero",
      iconSlug: "tempranero",
    });
    expect(getDrawPageDefinition("../early")).toBeNull();
    expect(getDrawPageDefinition("megaloto")).toBeNull();
  });

  it("selecciona la programación QUINIELA exacta y formatea en America/Asuncion", () => {
    const definition = getDrawPageDefinition("tempranero")!;
    const schedule = selectDrawPageSchedule(
      [
        draw({ family: "MEGALOTO", drawsAt: "2026-08-26T10:00:00Z" }),
        draw(),
      ],
      definition,
    );

    expect(schedule).toMatchObject({
      drawsAt: "2026-08-26T12:00:00.000Z",
      closesAt: "2026-08-26T11:45:00.000Z",
      timeLabel: "09:00",
      closingTimeLabel: "08:45",
    });
    expect(schedule?.dateLabel).toMatch(/26 de agosto de 2026/i);
  });

  it("no fabrica programación ante draw inexistente, familia incorrecta o fecha inválida", () => {
    const definition = getDrawPageDefinition("matutino")!;
    expect(selectDrawPageSchedule([draw()], definition)).toBeNull();
    expect(
      selectDrawPageSchedule(
        [draw({ id: "morning", family: "MEGALOTO" })],
        definition,
      ),
    ).toBeNull();
    expect(
      selectDrawPageSchedule(
        [draw({ id: "morning", drawsAt: "sin-fecha" })],
        definition,
      ),
    ).toBeNull();
  });

  it("ordena el historial del draw y normaliza el rango 001–999", () => {
    const results: MockResult[] = [
      {
        id: "old",
        source: "DRAW",
        drawId: "early",
        result: "7",
        occurredAt: "2026-08-26T10:00:00Z",
      },
      {
        id: "latest",
        source: "DRAW",
        drawId: "early",
        gameName: "A la Cabeza",
        result: "999",
        occurredAt: "2026-08-26T12:00:00Z",
      },
      {
        id: "fallback",
        source: "DRAW",
        drawId: "early",
        result: "497 · 208",
        resultNumbers: ["44"],
        publishedAt: "2026-08-26T11:00:00Z",
      },
      {
        id: "other-draw",
        source: "DRAW",
        drawId: "morning",
        result: "999",
        occurredAt: "2026-08-26T13:00:00Z",
      },
      {
        id: "instant",
        source: "INSTANT",
        drawId: "early",
        result: "888",
        occurredAt: "2026-08-26T14:00:00Z",
      },
      {
        id: "mega-with-wrong-draw",
        source: "DRAW",
        drawId: "early",
        gameId: "megaloto",
        result: "777",
        occurredAt: "2026-08-26T15:00:00Z",
      },
    ];

    expect(selectDrawPageResults(results, "early")).toEqual([
      expect.objectContaining({
        id: "latest",
        value: "999",
        label: "A la Cabeza",
      }),
      expect.objectContaining({ id: "fallback", value: "044" }),
      expect.objectContaining({ id: "old", value: "007" }),
    ]);
    expect(selectDrawPageResults(results, "early", 2)).toHaveLength(2);
  });

  it("descarta resultados ambiguos, fuera de rango o sin fecha verificable", () => {
    const invalidValues = ["000", "1000", "-1", "12.5", "abc"];
    const results = invalidValues.map<MockResult>((result, index) => ({
      id: `invalid-${index}`,
      source: "DRAW",
      drawId: "night",
      result,
      occurredAt: "2026-08-26T12:00:00Z",
    }));
    results.push({
      id: "invalid-date",
      source: "DRAW",
      drawId: "night",
      result: "497",
      occurredAt: "ayer",
    });

    expect(selectDrawPageResults(results, "night")).toEqual([]);
  });

  it("calcula el countdown sin negativos y conserva horas totales", () => {
    const now = Date.parse("2026-08-26T12:00:00Z");
    expect(getDrawPageCountdown("2026-08-27T14:02:03.250Z", now)).toEqual({
      state: "upcoming",
      totalSeconds: 93_724,
      hours: "26",
      minutes: "02",
      seconds: "04",
    });
    expect(getDrawPageCountdown("2026-08-26T12:00:00Z", now)).toMatchObject({
      state: "elapsed",
      totalSeconds: 0,
      hours: "00",
      minutes: "00",
      seconds: "00",
    });
    expect(getDrawPageCountdown("sin-fecha", now).state).toBe("unavailable");
  });

  it("acepta solo URLs públicas HTTPS sin credenciales", () => {
    expect(
      sanitizePublicDrawStreamUrl("https://stream.example/player?id=early"),
    ).toBe("https://stream.example/player?id=early");
    expect(sanitizePublicDrawStreamUrl("http://stream.example/player")).toBeNull();
    expect(sanitizePublicDrawStreamUrl("javascript:alert(1)")).toBeNull();
    expect(
      sanitizePublicDrawStreamUrl("https://user:secret@stream.example/player"),
    ).toBeNull();
    expect(sanitizePublicDrawStreamUrl(" ")).toBeNull();
  });

  it("resuelve la variable pública correspondiente sin interpolar nombres", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_DRAW_STREAM_MATUTINO_URL",
      "https://stream.example/matutino",
    );
    vi.stubEnv(
      "NEXT_PUBLIC_DRAW_STREAM_TEMPRANERO_URL",
      "http://inseguro.example/tempranero",
    );

    expect(getConfiguredDrawStreamUrl("morning")).toBe(
      "https://stream.example/matutino",
    );
    expect(getConfiguredDrawStreamUrl("early")).toBeNull();
  });
});
