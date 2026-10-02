import { describe, expect, it } from "vitest";
import { getCountdown, LAUNCH_AT, LAUNCH_TIME_ZONE } from "@/lib/countdown";

describe("launch countdown in Paraguay", () => {
  it("shows one second before 1 AM and celebrates exactly at 1 AM", () => {
    expect(getCountdown(Date.parse("2026-10-02T00:59:59-03:00"))).toEqual({ launched: false, values: [0, 0, 0, 1] });
    expect(getCountdown(Date.parse("2026-10-02T01:00:00-03:00"))).toEqual({ launched: true, values: [0, 0, 0, 0] });
  });
  it("does not round down into zero before the deadline", () => {
    expect(getCountdown(LAUNCH_AT - 1)).toEqual({ launched: false, values: [0, 0, 0, 1] });
  });
  it("uses the same instant for clients in any timezone", () => {
    expect(getCountdown(Date.parse("2026-10-02T03:59:59Z")).values).toEqual([0, 0, 0, 1]);
    expect(getCountdown(Date.parse("2026-10-01T20:59:59-07:00")).values).toEqual([0, 0, 0, 1]);
    const date = new Intl.DateTimeFormat("en-GB", { timeZone: LAUNCH_TIME_ZONE, dateStyle: "short", timeStyle: "medium" });
    expect(date.format(LAUNCH_AT)).toBe("02/10/2026, 01:00:00");
  });
  it("remains in celebration afterwards without negative numbers", () => {
    expect(getCountdown(LAUNCH_AT + 86400000)).toEqual({ launched: true, values: [0, 0, 0, 0] });
    expect(getCountdown(LAUNCH_AT - 90061000).values).toEqual([1, 1, 1, 1]);
  });
});
