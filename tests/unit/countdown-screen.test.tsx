// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CountdownScreen } from "@/app/contador/screen";
import { LAUNCH_AT } from "@/lib/countdown";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

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

it("plays the approved siren at each exact remaining-hour mark after activation", () => {
  vi.useFakeTimers();
  vi.setSystemTime(LAUNCH_AT - 2 * 60 * 60 * 1000 - 5 * 60 * 1000);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  render(<CountdownScreen initialNow={Date.now()} siren="/assets/contador/audio/sirena-quinie.wav" />);

  fireEvent.click(screen.getByRole("button", { name: "Activar sirena en cada hora restante" }));
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  act(() => {
    vi.setSystemTime(LAUNCH_AT - 2 * 60 * 60 * 1000 - 1000);
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  act(() => {
    vi.setSystemTime(LAUNCH_AT - 2 * 60 * 60 * 1000);
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("timer").textContent).toContain("02HORAS00MINUTOS00SEGUNDOS");

  act(() => {
    vi.setSystemTime(LAUNCH_AT - 60 * 60 * 1000);
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Desactivar sirena en cada hora restante" }));
  act(() => {
    vi.setSystemTime(LAUNCH_AT - 30 * 60 * 1000);
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
});
