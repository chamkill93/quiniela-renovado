// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import RouteError from "@/app/error";
import GlobalError from "@/app/global-error";

afterEach(() => {
  cleanup();
});

describe("límites de error de la aplicación", () => {
  it("ofrece reintentar una ruta sin exponer el mensaje interno", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("credencial privada"), {
      digest: "route-123",
    });

    render(<RouteError error={error} reset={reset} />);

    expect(screen.getByRole("heading", { name: "Algo salió mal" })).toBeTruthy();
    expect(screen.getByText("Referencia: route-123")).toBeTruthy();
    expect(screen.queryByText("credencial privada")).toBeNull();
    expect(screen.getByRole("link", { name: "Ir al inicio" }).getAttribute("href"))
      .toBe("/");

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("incluye el documento completo requerido por global-error", () => {
    const reset = vi.fn();
    const error = new Error("fallo de layout");

    const markup = renderToStaticMarkup(
      <GlobalError error={error} reset={reset} />,
    );

    expect(markup).toContain('<html lang="es">');
    expect(markup).toContain("La aplicación necesita recargarse");
    expect(markup).toContain("Reintentar");
    expect(markup).toContain('href="/"');
    expect(markup).not.toContain("fallo de layout");
  });
});
