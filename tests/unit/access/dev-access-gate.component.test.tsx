// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DevAccessGate } from "@/features/access/dev-access-gate";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

afterEach(() => {
  cleanup();
  refresh.mockReset();
  vi.unstubAllGlobals();
});

describe("DEV access gate", () => {
  it("presents the Quiniela welcome and an accessible password form", () => {
    render(<DevAccessGate />);

    expect(screen.getByRole("img", { name: "quinie.LA" })).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Bienvenido a la página DEV de Quiniela",
      }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Código de acceso").getAttribute("type")).toBe("password");
    expect(screen.getByRole("button", { name: "Entrar a la página" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Solicitar acceso por WhatsApp al +595 994 792277" }),
    ).toHaveProperty("href", "https://wa.me/595994792277");
    expect(screen.getByText("Área de Desarrollo / Proyectos")).toBeTruthy();
  });

  it("can reveal and hide the entered code", async () => {
    const user = userEvent.setup();
    render(<DevAccessGate />);
    const input = screen.getByLabelText("Código de acceso");

    await user.click(screen.getByRole("button", { name: "Mostrar código" }));
    expect(input.getAttribute("type")).toBe("text");

    await user.click(screen.getByRole("button", { name: "Ocultar código" }));
    expect(input.getAttribute("type")).toBe("password");
  });

  it("shows the server message when the code is rejected", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "El código no es correcto. Volvé a intentarlo." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<DevAccessGate />);

    await user.type(screen.getByLabelText("Código de acceso"), "Incorrecto");
    await user.click(screen.getByRole("button", { name: "Entrar a la página" }));

    expect((await screen.findByRole("alert")).textContent).toContain("El código no es correcto");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes the server layout after a successful validation", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<DevAccessGate />);

    await user.type(screen.getByLabelText("Código de acceso"), "Admin123#");
    await user.click(screen.getByRole("button", { name: "Entrar a la página" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dev-access",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "Admin123#" }),
      }),
    );
  });
});
