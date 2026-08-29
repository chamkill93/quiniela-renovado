import { describe, expect, it } from "vitest";

import { buildPreviewDailyDraws, buildPreviewDrawsForDate, selectLiveDraw } from "@/lib/gaming/daily-draw-schedule";
import { drawDateKey } from "@/lib/gaming/draw-calendar";
import type { DrawDefinition } from "@/lib/gaming/types";

describe("calendario diario de sorteos de muestra", () => {
  it("fija los cuatro horarios de Paraguay y separa el cierre de ventas", () => {
    const draws = buildPreviewDrawsForDate("2026-08-26");
    expect(draws.map((draw) => draw.drawsAt)).toEqual([
      "2026-08-26T13:30:00.000Z",
      "2026-08-26T16:00:00.000Z",
      "2026-08-26T19:30:00.000Z",
      "2026-08-26T23:30:00.000Z",
    ]);
    expect(draws.map((draw) => draw.label)).toEqual([
      "Tempranero · 10:30", "Matutino · 13:00", "Vespertino · 16:30", "Nocturno · 20:30",
    ]);
    expect(draws.every((draw) => Date.parse(draw.drawsAt) - Date.parse(draw.closesAt) === 15 * 60 * 1_000)).toBe(true);
    expect(draws.every((draw) => draw.family === "QUINIELA" && draw.status === "OPEN")).toBe(true);
  });

  it("no desplaza la programación cada vez que se consulta", () => {
    expect(buildPreviewDailyDraws(Date.parse("2026-08-26T12:00:00Z"))).toEqual(
      buildPreviewDailyDraws(Date.parse("2026-08-26T12:59:59Z")),
    );
  });

  it("avanza solamente el slot cuya hora exacta se alcanzó", () => {
    const before = buildPreviewDailyDraws(Date.parse("2026-08-26T13:29:59.999Z"));
    const at = buildPreviewDailyDraws(Date.parse("2026-08-26T13:30:00.000Z"));
    expect(before[0].drawsAt).toBe("2026-08-26T13:30:00.000Z");
    expect(at[0].drawsAt).toBe("2026-08-27T13:30:00.000Z");
    expect(at.slice(1)).toEqual(before.slice(1));
  });

  it.each([
    ["2026-08-26T23:30:00Z", "2026-08-27"],
    ["2026-08-27T02:59:59Z", "2026-08-27"],
    ["2026-08-27T03:00:00Z", "2026-08-27"],
    ["2026-08-31T23:30:00Z", "2026-09-01"],
    ["2026-12-31T23:30:00Z", "2027-01-01"],
    ["2028-02-28T23:30:00Z", "2028-02-29"],
  ])("resuelve calendario local y cambio de fecha para %s", (instant, dateKey) => {
    const draws = buildPreviewDailyDraws(Date.parse(instant));
    expect(draws).toHaveLength(4);
    expect(draws.every((draw) => drawDateKey(Date.parse(draw.drawsAt)) === dateKey)).toBe(true);
    expect(draws.every((draw) => Date.parse(draw.drawsAt) > Date.parse(instant))).toBe(true);
  });

  it("permite abrir una fecha seleccionada sin convertirla en mañana", () => {
    const draws = buildPreviewDrawsForDate("2026-08-25");
    expect(draws.every((draw) => drawDateKey(Date.parse(draw.drawsAt)) === "2026-08-25")).toBe(true);
  });

  it.each(["sin-fecha", "2026-02-30", "2026-8-26", "../2026-08-26", ""])(
    "no fabrica sorteos para la fecha inválida %s",
    (dateKey) => expect(buildPreviewDrawsForDate(dateKey)).toEqual([]),
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE])(
    "no fabrica sorteos ante un reloj inválido %s",
    (now) => expect(buildPreviewDailyDraws(now)).toEqual([]),
  );
});

describe("indicador LIVE de sorteos diarios", () => {
  const dailyDraws = buildPreviewDrawsForDate("2026-08-26");
  const minute = 60 * 1_000;
  const remoteDraw = (overrides: Partial<DrawDefinition> = {}): DrawDefinition => ({
    ...dailyDraws[0],
    ...overrides,
  });

  it.each(dailyDraws)("respeta la ventana [-10, +30) minutos de $id", (draw) => {
    const drawsAtMs = Date.parse(draw.drawsAt);
    for (const [offset, live] of [
      [-10 * minute - 1, false],
      [-10 * minute, true],
      [-1, true],
      [0, true],
      [1, true],
      [30 * minute - 1, true],
      [30 * minute, false],
      [30 * minute + 1, false],
    ] as const) {
      const nowMs = drawsAtMs + offset;
      expect(selectLiveDraw(nowMs)).toEqual(live ? draw : null);
      expect(selectLiveDraw(nowMs, [draw])).toBe(live ? draw : null);
    }
  });

  it.each(dailyDraws)("conserva $id en LIVE después de que el próximo sorteo avance", (draw) => {
    const nowMs = Date.parse(draw.drawsAt) + 15 * minute;
    const next = buildPreviewDailyDraws(nowMs).find((candidate) => candidate.id === draw.id);
    expect(next?.drawsAt).not.toBe(draw.drawsAt);
    expect(selectLiveDraw(nowMs, undefined)).toEqual(draw);
  });

  it.each([
    ["2026-08-26T10:20:00-03:00", "early", "2026-08-26"],
    ["2026-08-26T20:59:59.999-03:00", "night", "2026-08-26"],
    ["2026-08-31T23:45:00Z", "night", "2026-08-31"],
    ["2026-09-01T13:20:00Z", "early", "2026-09-01"],
    ["2026-12-31T23:45:00Z", "night", "2026-12-31"],
    ["2027-01-01T13:20:00Z", "early", "2027-01-01"],
    ["2028-02-29T13:20:00Z", "early", "2028-02-29"],
  ])("usa la fecha de Paraguay para %s", (instant, id, dateKey) => {
    const selected = selectLiveDraw(Date.parse(instant));
    expect(selected?.id).toBe(id);
    expect(drawDateKey(Date.parse(selected!.drawsAt))).toBe(dateKey);
  });

  it.each(["2026-08-27T00:00:00Z", "2026-08-27T02:59:59.999Z", "2026-08-27T03:00:00Z"])(
    "no prolonga el nocturno ni adelanta el día siguiente en %s",
    (instant) => expect(selectLiveDraw(Date.parse(instant))).toBeNull(),
  );

  it("trata los horarios recibidos, incluso vacíos o ya avanzados, como autoritativos", () => {
    const nowMs = Date.parse("2026-08-26T13:35:00Z");
    expect(selectLiveDraw(nowMs)?.id).toBe("early");
    expect(selectLiveDraw(nowMs, [])).toBeNull();
    expect(selectLiveDraw(nowMs, buildPreviewDailyDraws(nowMs))).toBeNull();
    expect(selectLiveDraw(nowMs, [remoteDraw({ drawsAt: "2026-08-26T18:20:00Z" })])).toBeNull();
  });

  it("respeta la hora remota con offset y drawsAt, sin usar ni exigir closesAt", () => {
    const draw = Object.freeze(remoteDraw({
      label: "Horario recibido",
      drawsAt: "2026-08-26T15:20:00-03:00",
      closesAt: "2026-08-26T14:00:00-03:00",
    }));
    const source = Object.freeze([draw]);
    expect(selectLiveDraw(Date.parse(draw.closesAt), source)).toBeNull();
    expect(selectLiveDraw(Date.parse("2026-08-26T18:25:00Z"), source)).toBe(draw);
    const invalidCutoff = Object.freeze({ ...draw, closesAt: "sin-fecha" });
    expect(selectLiveDraw(Date.parse("2026-08-26T18:25:00Z"), [invalidCutoff])).toBe(invalidCutoff);
  });

  it("conserva una ocurrencia remota al cruzar la medianoche de Paraguay", () => {
    const previousDay = remoteDraw({ id: "night", drawsAt: "2026-08-26T23:50:00-03:00" });
    const nextDay = remoteDraw({ drawsAt: "2026-08-27T00:05:00-03:00" });
    expect(selectLiveDraw(Date.parse("2026-08-26T23:55:00-03:00"), [nextDay])).toBe(nextDay);
    expect(selectLiveDraw(Date.parse("2026-08-27T00:19:59.999-03:00"), [previousDay])).toBe(previousDay);
    expect(selectLiveDraw(Date.parse("2026-08-27T00:20:00-03:00"), [previousDay])).toBeNull();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_VALUE])(
    "devuelve null sin lanzar errores ante el reloj inválido %s",
    (nowMs) => {
      expect(selectLiveDraw(nowMs)).toBeNull();
      expect(selectLiveDraw(nowMs, dailyDraws)).toBeNull();
    },
  );

  it.each(["", "sin-fecha", "2026-13-26T13:30:00Z", "2026-02-30T13:30:00Z"])(
    "no usa la fecha remota inválida %s ni la reemplaza por el horario local",
    (drawsAt) => {
      const draw = remoteDraw({ drawsAt });
      expect(selectLiveDraw(Date.parse("2026-08-26T13:30:00Z"), [draw])).toBeNull();
      expect(selectLiveDraw(Date.parse("2026-03-02T13:30:00Z"), [draw])).toBeNull();
    },
  );

  it("ignora sorteos ajenos y fechas inválidas sin ocultar una ocurrencia válida", () => {
    const valid = remoteDraw();
    const unrelated = [
      remoteDraw({ id: "megaloto", family: "MEGALOTO" }),
      remoteDraw({ id: "early", family: "MEGALOTO" }),
      remoteDraw({ id: "tempranero" }),
      remoteDraw({ id: "otro", label: "Tempranero" }),
      remoteDraw({ drawsAt: "sin-fecha" }),
    ];
    const nowMs = Date.parse(valid.drawsAt);
    expect(selectLiveDraw(nowMs, unrelated)).toBeNull();
    expect(selectLiveDraw(nowMs, [...unrelated, valid])).toBe(valid);
  });

  it("elige la ocurrencia iniciada más reciente antes que una próxima, sin mutar el origen", () => {
    const older = Object.freeze(remoteDraw({ drawsAt: "2026-08-26T13:10:00Z" }));
    const current = Object.freeze(remoteDraw({ id: "morning", drawsAt: "2026-08-26T13:30:00Z" }));
    const upcoming = Object.freeze(remoteDraw({ id: "evening", drawsAt: "2026-08-26T13:32:00Z" }));
    const source = Object.freeze([upcoming, older, current]);
    const nowMs = Date.parse("2026-08-26T13:30:00Z");
    expect(selectLiveDraw(nowMs, source)).toBe(current);
    expect(selectLiveDraw(nowMs, [...source].reverse())).toBe(current);
  });

  it("elige la próxima más cercana cuando ninguna ventana activa ha iniciado", () => {
    const nearer = remoteDraw({ id: "night", drawsAt: "2026-08-26T13:33:00Z" });
    const later = remoteDraw({ drawsAt: "2026-08-26T13:38:00Z" });
    const nowMs = Date.parse("2026-08-26T13:30:00Z");
    expect(selectLiveDraw(nowMs, [later, nearer])).toBe(nearer);
    expect(selectLiveDraw(nowMs, [nearer, later])).toBe(nearer);
  });

  it.each(["2026-08-26T13:25:00Z", "2026-08-26T13:30:00Z"])(
    "desempata horarios iguales por el orden de los slots, no por el orden recibido en %s",
    (instant) => {
      const early = remoteDraw();
      const night = remoteDraw({ id: "night" });
      const nowMs = Date.parse(instant);
      expect(selectLiveDraw(nowMs, [night, early])).toBe(early);
      expect(selectLiveDraw(nowMs, [early, night])).toBe(early);
    },
  );
});
