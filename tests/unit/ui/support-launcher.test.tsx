// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SupportLauncher } from "@/components/shell/SupportLauncher";

const script = vi.hoisted(() => ({ onReady: undefined as (() => void) | undefined }));
vi.mock("next/script", () => ({ default: (props: { onReady: () => void }) => {
  script.onReady = props.onReady;
  return null;
} }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => { cleanup(); delete window.zE; delete window.zEMessenger; script.onReady = undefined; });

describe("call center panel", () => {
  it("loads Zendesk only on demand and restores focus when closed", () => {
    render(<SupportLauncher />);
    expect(script.onReady).toBeUndefined();
    const trigger = screen.getByRole("button", { name: "Abrir soporte" });
    fireEvent.click(trigger);
    expect(window.zEMessenger).toEqual({ autorender: false });
    expect(screen.getByRole("dialog", { name: "Atención al jugador" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar chat" }));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("embeds the real chat once and preserves it when reopened", () => {
    const zendesk = vi.fn((_channel: string, command: string, _value: unknown, callback?: (error: Error | null) => void) => {
      if (command === "render") callback?.(null);
    });
    window.zE = zendesk;
    render(<SupportLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir soporte" }));
    act(() => script.onReady?.());
    expect(zendesk).toHaveBeenCalledWith("messenger", "render", { mode: "embedded", widget: { targetElement: "#quinie-support-messenger" } }, expect.any(Function));
    expect(screen.queryByText("Conectando con atención…")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir soporte" }));
    act(() => script.onReady?.());
    expect(zendesk.mock.calls.filter(call => call[1] === "render")).toHaveLength(1);
  });

  it("offers help and retry when Zendesk fails to render", () => {
    window.zE = vi.fn((_channel: string, command: string, _value: unknown, callback?: (error: Error | null) => void) => {
      if (command === "render") callback?.(new Error("Unavailable"));
    });
    render(<SupportLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir soporte" }));
    act(() => script.onReady?.());
    expect(screen.getByText("No pudimos cargar el chat")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir al centro de ayuda" }).getAttribute("href")).toBe("/ayuda");
  });
});
