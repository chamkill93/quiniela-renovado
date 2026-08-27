// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useProductMock } = vi.hoisted(() => ({ useProductMock: vi.fn() }));
vi.mock("@/providers/product-provider", () => ({ useProduct: useProductMock }));
import { AccountClient } from "@/features/product/account-client";
import type { AccountLimits, AccountPauseInput, AccountProfileInput, AccountSettings } from "@/lib/account/contracts";

const session = { id: "demo-player-42", displayName: "Ana Prueba", role: "PLAYER", balance: 75_000, currency: "PYG" };
let settings: AccountSettings;
const account = { getSettings: vi.fn(), saveLimits: vi.fn(), pause: vi.fn(), updateProfile: vi.fn() };
const base = {
  account,
  session, loading: false, error: null, unauthorized: false,
  gatewayMode: "preview", persistentRegistration: false,
  login: vi.fn(), register: vi.fn(), logout: vi.fn(), refresh: vi.fn(),
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER", "");
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  base.logout.mockReset().mockResolvedValue(undefined);
  base.refresh.mockReset().mockResolvedValue(undefined);
  settings = { sessionId: session.id, scope: "session", sessionStartedAt: new Date().toISOString(), limits: null, pausedUntil: null, usage: { daily: 0, weekly: 0, minutes: 0 } };
  account.getSettings.mockReset().mockImplementation(async () => structuredClone(settings));
  account.saveLimits.mockReset().mockImplementation(async (limits: AccountLimits) => { settings = { ...settings, limits }; return structuredClone(settings); });
  account.pause.mockReset().mockImplementation(async ({ durationMinutes }: AccountPauseInput) => { settings = { ...settings, pausedUntil: new Date(Date.now() + durationMinutes * 60_000).toISOString() }; return structuredClone(settings); });
  account.updateProfile.mockReset().mockImplementation(async ({ displayName }: AccountProfileInput) => ({ ...session, displayName }));
  useProductMock.mockReturnValue(base);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Account dashboard", () => {
  it("keeps profile and balance above one options block with logout at its end", () => {
    render(<AccountClient />);
    expect(screen.getByRole("heading", { name: "Cuenta", level: 1 })).toBeTruthy();
    const profile = screen.getByRole("region", { name: "Ana Prueba" });
    expect(within(profile).getByRole("heading", { name: "Ana Prueba", level: 2 })).toBeTruthy();
    expect(screen.getByText("Cuenta personal")).toBeTruthy();
    expect(screen.queryByText(/Cuenta de prueba|Saldo de prueba|Sin dinero real|Solo una demostración|Terminaste por hoy|^Demo$/i)).toBeNull();
    expect(screen.getByRole("region", { name: "Saldo disponible" }).textContent).toContain("75.000");
    const options = screen.getByRole("region", { name: "Opciones de tu cuenta" });
    for (const name of ["Mis datos", "Seguridad y acceso", "Contactar por WhatsApp", "Autolímites", "Tomarme un descanso", "Cerrar sesión"]) {
      expect(within(options).getByRole("button", { name })).toBeTruthy();
    }
    expect(within(options).getAllByRole("button").at(-1)?.textContent).toBe("Cerrar sesión");
    expect(profile.compareDocumentPosition(options) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/backoffice|proveedor|codexa|kodexa/i)).toBeNull();
  });

  it("links activity, help and legal options to existing routes", () => {
    render(<AccountClient />);
    const options = within(screen.getByRole("region", { name: "Opciones de tu cuenta" }));
    expect(options.getByRole("link", { name: "Mis jugadas" }).getAttribute("href")).toBe("/mis-jugadas");
    expect(options.getByRole("link", { name: "Saldo y movimientos" }).getAttribute("href")).toBe("/saldos");
    expect(options.getByRole("link", { name: "Centro de ayuda" }).getAttribute("href")).toBe("/ayuda");
    const legal = within(screen.getByRole("navigation", { name: "Información de tu cuenta" }));
    expect(legal.getByRole("link", { name: "Juego responsable" }).getAttribute("href")).toBe("/legal/juego-responsable");
    expect(legal.getByRole("link", { name: "Términos" }).getAttribute("href")).toBe("/legal/terminos");
    expect(legal.getByRole("link", { name: "Privacidad" }).getAttribute("href")).toBe("/legal/privacidad");
  });

  it("shows an honest fallback when WhatsApp is not configured", async () => {
    const user = userEvent.setup();
    render(<AccountClient />);
    await user.click(screen.getByRole("button", { name: "Contactar por WhatsApp" }));
    const dialog = within(screen.getByRole("dialog", { name: "Contactar por WhatsApp" }));
    expect(dialog.getByText(/Todavía no hay un número de atención configurado/)).toBeTruthy();
    expect(dialog.getByRole("link", { name: "Ir al centro de ayuda" }).getAttribute("href")).toBe("/ayuda");
    expect(document.querySelector('a[href*="wa.me"]')).toBeNull();
  });

  it("opens only the configured WhatsApp destination without sharing profile or balance", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER", "+595 (981) 123-456");
    render(<AccountClient />);
    const contact = screen.getByRole("link", { name: "Contactar por WhatsApp (se abre en una pestaña nueva)" });
    const url = new URL(contact.getAttribute("href")!);
    expect(url.pathname).toBe("/595981123456");
    expect(url.searchParams.get("text")).toBe("Hola, necesito ayuda con mi cuenta de quinie.LA.");
    expect(contact.getAttribute("target")).toBe("_blank");
    expect(contact.getAttribute("rel")).toBe("noopener noreferrer");
    expect(url.href).not.toContain(session.id);
    expect(url.href).not.toContain("75000");
  });

  it("does not create an external link for a malformed WhatsApp number", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER", "https://evil.example/phone");
    render(<AccountClient />);
    expect(screen.getByRole("button", { name: "Contactar por WhatsApp" })).toBeTruthy();
    expect(document.querySelector('a[target="_blank"]')).toBeNull();
  });

  it("shows available profile fields without inventing personal contact data", async () => {
    const user = userEvent.setup();
    useProductMock.mockReturnValue({ ...base, session: { ...session, role: "ADMIN" } });
    render(<AccountClient />);
    expect(screen.getByText("Sesión de operador")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Mis datos" }));
    const dialog = within(screen.getByRole("dialog", { name: "Mis datos" }));
    expect(dialog.getByText(session.id)).toBeTruthy();
    expect(dialog.getByLabelText<HTMLInputElement>("Nombre visible").value).toBe(session.displayName);
    expect(dialog.getByText("Operador")).toBeTruthy();
    expect(dialog.queryByText(/verificada|@|teléfono/i)).toBeNull();
  });

  it("saves limits through the service and reloads their authoritative values", async () => {
    const user = userEvent.setup();
    render(<AccountClient />);
    await user.click(screen.getByRole("button", { name: "Autolímites" }));
    const dialog = within(screen.getByRole("dialog", { name: "Autolímites" }));
    expect(dialog.getByText(/Estos límites se aplican/)).toBeTruthy();
    fireEvent.change(dialog.getByLabelText("Importe diario (Gs.)"), { target: { value: "75000" } });
    fireEvent.change(dialog.getByLabelText("Importe semanal (Gs.)"), { target: { value: "300000" } });
    await user.selectOptions(dialog.getByLabelText("Tiempo máximo de sesión"), "30");
    await user.click(dialog.getByRole("button", { name: "Guardar autolímites" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("se guardaron y se aplican");
    expect(account.saveLimits.mock.calls[0][0]).toEqual({ daily: 75000, weekly: 300000, minutes: 30 });
    await user.click(screen.getByRole("button", { name: "Autolímites" }));
    expect(screen.getByLabelText<HTMLInputElement>("Importe diario (Gs.)").value).toBe("75000");
    expect(screen.getByLabelText<HTMLInputElement>("Importe semanal (Gs.)").value).toBe("300000");
    expect(screen.getByLabelText<HTMLSelectElement>("Tiempo máximo de sesión").value).toBe("30");
  });

  it("validates limits and focuses the first invalid amount", async () => {
    const user = userEvent.setup();
    render(<AccountClient />);
    await user.click(screen.getByRole("button", { name: "Autolímites" }));
    const input = screen.getByLabelText("Importe diario (Gs.)");
    fireEvent.change(input, { target: { value: "-50" } });
    await user.click(screen.getByRole("button", { name: "Guardar autolímites" }));
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("alert").textContent).toContain("mayor a cero");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("rejects a weekly amount below the daily limit", async () => {
    const user = userEvent.setup();
    render(<AccountClient />);
    await user.click(screen.getByRole("button", { name: "Autolímites" }));
    const weekly = screen.getByLabelText("Importe semanal (Gs.)");
    fireEvent.change(weekly, { target: { value: "1000" } });
    await user.click(screen.getByRole("button", { name: "Guardar autolímites" }));
    expect(weekly.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(weekly);
    expect(screen.getByRole("alert").textContent).toContain("menor al diario");
  });

  it("discards unsaved edits and restores keyboard focus when closing the panel", async () => {
    const user = userEvent.setup();
    render(<AccountClient />);
    const trigger = screen.getByRole("button", { name: "Autolímites" });
    await user.click(trigger);
    fireEvent.change(screen.getByLabelText("Importe diario (Gs.)"), { target: { value: "10000" } });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    expect(screen.getByLabelText<HTMLInputElement>("Importe diario (Gs.)").value).toBe("50000");
  });

  it("resets notices and does not carry limits to another account", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AccountClient />);
    await user.click(screen.getByRole("button", { name: "Autolímites" }));
    await user.click(screen.getByRole("button", { name: "Guardar autolímites" }));
    expect(screen.getByRole("status")).toBeTruthy();
    useProductMock.mockReturnValue({ ...base, session: { ...session, id: "other-account" } });
    settings = { ...settings, sessionId: "other-account", limits: null };
    rerender(<AccountClient />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/50.000 al día/)).toBeNull();
  });

  it("does not invent account capabilities for an unconfigured external service", async () => {
    const user = userEvent.setup();
    useProductMock.mockReturnValue({ ...base, account: undefined, gatewayMode: "backoffice", persistentRegistration: false });
    render(<AccountClient />);
    expect(screen.queryByText("Cuenta de prueba")).toBeNull();
    expect(screen.queryByText("Demo")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Autolímites" }));
    const dialog = within(screen.getByRole("dialog", { name: "Autolímites" }));
    expect(dialog.queryByRole("textbox")).toBeNull();
    expect(dialog.queryByRole("button", { name: "Guardar autolímites" })).toBeNull();
    expect(dialog.getByText(/Esta opción no está disponible/)).toBeTruthy();
  });

  it("requires confirmation and applies a pause without logging the user out", async () => {
    const user = userEvent.setup();
    render(<AccountClient />);
    await user.click(screen.getByRole("button", { name: "Tomarme un descanso" }));
    const dialog = within(screen.getByRole("dialog", { name: "Pausa de juego" }));
    const confirm = dialog.getByRole<HTMLButtonElement>("button", { name: "Activar pausa" });
    expect(confirm.disabled).toBe(true);
    await user.click(dialog.getByRole("checkbox"));
    await user.click(confirm);
    expect(account.pause.mock.calls[0][0]).toEqual({ durationMinutes: 15 });
    expect(screen.getByRole("status").textContent).toContain("Pausa activada");
    expect(base.logout).not.toHaveBeenCalled();
  });

  it("does not confirm or discard inputs when saving limits fails", async () => {
    account.saveLimits.mockRejectedValueOnce(new Error("No pudimos guardar tus límites."));
    const user = userEvent.setup();
    render(<AccountClient />);
    await user.click(screen.getByRole("button", { name: "Autolímites" }));
    await user.click(screen.getByRole("button", { name: "Guardar autolímites" }));
    expect((await screen.findByRole("alert")).textContent).toContain("No pudimos guardar tus límites");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>("Importe diario (Gs.)").value).toBe("50000");
    await user.click(screen.getByRole("button", { name: "Guardar autolímites" }));
    expect(screen.getByRole("status").textContent).toContain("se guardaron");
  });

  it("waits for the service, blocks duplicate saves and aborts UI updates after cancellation", async () => {
    let finish!: (value: AccountSettings) => void;
    account.saveLimits.mockImplementationOnce(() => new Promise<AccountSettings>((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    render(<AccountClient />);
    await user.click(screen.getByRole("button", { name: "Autolímites" }));
    const save = screen.getByRole<HTMLButtonElement>("button", { name: "Guardar autolímites" });
    fireEvent.click(save); fireEvent.click(save);
    expect(account.saveLimits).toHaveBeenCalledTimes(1);
    expect(save.disabled).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await act(async () => { finish({ ...settings, limits: { daily: 50000, weekly: 200000, minutes: 60 } }); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("saves a validated profile name through the account service", async () => {
    const user = userEvent.setup();
    render(<AccountClient />);
    await user.click(screen.getByRole("button", { name: "Mis datos" }));
    const name = screen.getByRole("textbox", { name: "Nombre visible" });
    fireEvent.change(name, { target: { value: "A" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(account.updateProfile).not.toHaveBeenCalled();
    expect(name.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(name, { target: { value: " Ana Pérez " } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(account.updateProfile.mock.calls[0][0]).toEqual({ displayName: "Ana Pérez" });
    expect(screen.getByRole("status").textContent).toBe("Tu nombre se actualizó correctamente.");
  });

  it("locks the bottom logout action while a request is pending", async () => {
    let resolveLogout!: () => void;
    base.logout.mockImplementation(() => new Promise<void>((resolve) => { resolveLogout = resolve; }));
    render(<AccountClient />);
    const button = screen.getByRole("button", { name: "Cerrar sesión" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(base.logout).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.textContent).toBe("Cerrando sesión…");
    await act(async () => { resolveLogout(); });
  });

  it("focuses a logout error and permits a retry without losing the profile", async () => {
    base.logout.mockRejectedValueOnce(new Error("No pudimos cerrar la sesión."));
    const user = userEvent.setup();
    render(<AccountClient />);
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("No pudimos cerrar la sesión.");
    await waitFor(() => expect(document.activeElement).toBe(alert));
    expect(screen.getByRole("heading", { name: "Ana Prueba" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(base.logout).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("preserves refresh errors and the existing retry action", async () => {
    useProductMock.mockReturnValue({ ...base, error: "No pudimos actualizar tu cuenta." });
    const user = userEvent.setup();
    render(<AccountClient />);
    expect(screen.getByRole("alert").textContent).toContain("No pudimos actualizar tu cuenta.");
    await user.click(screen.getByRole("button", { name: "Reintentar actualización" }));
    expect(base.refresh).toHaveBeenCalledTimes(1);
  });
});
