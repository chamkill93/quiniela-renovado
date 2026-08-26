import { describe, expect, it } from "vitest";

import { publicProductErrorMessage } from "@/lib/product/public-error";

describe("publicProductErrorMessage", () => {
  it("neutraliza nombres e infraestructura en errores visibles", () => {
    const message = publicProductErrorMessage(
      new Error("Sin conexión con el backoffice de Codexa y su proveedor KODEXA."),
      "No pudimos completar la operación.",
    );

    expect(message).toBe("Sin conexión con el servicio de servicio y su servicio servicio.");
    expect(message).not.toMatch(/backoffice|proveedor|codexa|kodexa/i);
  });

  it("conserva mensajes públicos genéricos y acepta razones string", () => {
    expect(
      publicProductErrorMessage("  El servicio está temporalmente ocupado.  ", "Fallback"),
    ).toBe("El servicio está temporalmente ocupado.");
  });

  it("usa el fallback para razones sin texto y limita la salida pública", () => {
    expect(publicProductErrorMessage({}, "No pudimos completar la operación.")).toBe(
      "No pudimos completar la operación.",
    );
    expect(publicProductErrorMessage("x".repeat(500), "Fallback")).toHaveLength(300);
  });
});
