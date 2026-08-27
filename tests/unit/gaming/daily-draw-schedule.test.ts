import { describe, expect, it } from "vitest";

import { buildPreviewDailyDraws, buildPreviewDrawsForDate } from "@/lib/gaming/daily-draw-schedule";
import { drawDateKey } from "@/lib/gaming/draw-calendar";

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
