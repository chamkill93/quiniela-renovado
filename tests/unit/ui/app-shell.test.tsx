// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/AppShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

afterEach(cleanup);

describe("AppShell navigation", () => {
  it("replaces mobile Quiniela with Reglas and keeps Jugar in the center", () => {
    render(<AppShell><main>Inicio</main></AppShell>);
    const navigation = within(screen.getByRole("navigation", { name: "Navegación móvil" }));
    const links = navigation.getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "Inicio", "Reglas", "Jugar", "Resultados", "Cuenta",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/", "/reglas", "/quinielas", "/resultados", "/cuenta",
    ]);
    expect(navigation.getByRole("link", { name: "Reglas" }).querySelector("svg path")).not.toBeNull();
    expect(navigation.queryByRole("link", { name: /Quiniela/i })).toBeNull();
  });

  it("marks Reglas as active only on the rules page", () => {
    const { rerender } = render(<AppShell currentPath="/reglas"><main>Reglas</main></AppShell>);
    const navigation = within(screen.getByRole("navigation", { name: "Navegación móvil" }));
    expect(navigation.getAllByRole("link", { current: "page" })).toEqual([
      navigation.getByRole("link", { name: "Reglas" }),
    ]);

    rerender(<AppShell currentPath="/quinielas"><main>Quinielas</main></AppShell>);
    expect(navigation.getByRole("link", { name: "Reglas" }).getAttribute("aria-current")).toBeNull();
    expect(navigation.getByRole("link", { name: "Jugar" }).getAttribute("href")).toBe("/quinielas");
  });

  it("preserves both Quinielas and Reglas in the desktop sidebar", () => {
    render(<AppShell currentPath="/quinielas/sapyaite"><main>Sapy’aite</main></AppShell>);
    const navigation = within(screen.getByRole("navigation", { name: "Navegación principal" }));
    const quinielas = navigation.getByRole("link", { name: "Quinielas" });
    expect(quinielas.getAttribute("href")).toBe("/quinielas");
    expect(quinielas.getAttribute("aria-current")).toBe("page");
    expect(navigation.getByRole("link", { name: "Reglas" }).getAttribute("href")).toBe("/reglas");
  });

  it("keeps the footer logo and links without repeating the Paraguay tagline", () => {
    render(<AppShell><main>Quiniela online · Paraguay</main></AppShell>);
    const footer = within(screen.getByRole("navigation", { name: "Información y ayuda" }).closest("footer")!);

    expect(footer.getByRole("img", { name: "quinie.LA" })).toBeTruthy();
    expect(footer.queryByText("Quiniela online · Paraguay")).toBeNull();
    expect(footer.getAllByRole("link")).toHaveLength(5);
    expect(within(screen.getByRole("main")).getByText("Quiniela online · Paraguay")).toBeTruthy();
  });
});
