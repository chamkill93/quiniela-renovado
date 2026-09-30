// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CountdownScreen } from "@/app/contador/screen";
import { LAUNCH_AT } from "@/lib/countdown";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("automatically replaces the timer at midnight and keeps celebration visible", () => {
  vi.useFakeTimers();
  vi.setSystemTime(LAUNCH_AT - 1000);
  render(<CountdownScreen initialNow={Date.now()} />);
  expect(screen.getByRole("timer").textContent).toContain("01SEGUNDOS");
  expect(screen.queryByRole("button")).toBeNull();
  act(() => { vi.advanceTimersByTime(1000); });
  expect(screen.queryByRole("timer")).toBeNull();
  expect(screen.getByRole("heading", { name: "¡YA ESTAMOS EN PRODUCCIÓN!" })).toBeTruthy();
  expect(screen.getByText("¡Felicitaciones equipo!")).toBeTruthy();
  act(() => { vi.advanceTimersByTime(11000); });
  expect(screen.getByText("¡Felicitaciones equipo!")).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/online/i);
});
