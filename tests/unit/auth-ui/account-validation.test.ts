import { describe, expect, it } from "vitest";

import {
  accountErrorMessage,
  validateAccountFields,
} from "@/features/product/account-client";

describe("validación de acceso y registro", () => {
  it("mantiene el login compatible sin exigir datos propios del registro", () => {
    expect(
      validateAccountFields({
        mode: "login",
        displayName: "",
        identifier: " admin ",
        password: "ficticia-2026",
        acceptedTerms: false,
      }),
    ).toEqual({});
  });

  it("delega la política de contraseña de login al backoffice", () => {
    expect(
      validateAccountFields({
        mode: "login",
        displayName: "",
        identifier: "12345",
        password: "1234",
        acceptedTerms: false,
      }),
    ).toEqual({});

    expect(
      validateAccountFields({
        mode: "login",
        displayName: "",
        identifier: "12345",
        password: "",
        acceptedTerms: false,
      }),
    ).toMatchObject({ password: "Ingresá tu contraseña." });
  });

  it("indica todos los campos incompletos del registro", () => {
    expect(
      validateAccountFields({
        mode: "register",
        displayName: "A",
        identifier: "  ",
        password: "corta",
        acceptedTerms: false,
      }),
    ).toEqual({
      displayName: "Ingresá un nombre de al menos 2 caracteres.",
      identifier: "Ingresá un documento o teléfono válido.",
      password: "La contraseña debe tener al menos 8 caracteres.",
      acceptedTerms: "Debés aceptar los términos y la política de privacidad.",
    });
  });

  it("acepta un registro completo listo para enviarse al backoffice", () => {
    expect(
      validateAccountFields({
        mode: "register",
        displayName: " Ana ",
        identifier: " 0981000000 ",
        password: "segura-2026",
        acceptedTerms: true,
      }),
    ).toEqual({});
  });

  it("normaliza los fallos previstos sin depender del texto del proveedor", () => {
    expect(accountErrorMessage({ status: 401 }, "login")).toContain("no coincide");
    expect(accountErrorMessage({ code: "USER_EXISTS" }, "register")).toContain("Ya existe");
    expect(accountErrorMessage({ status: 429 }, "login")).toContain("demasiados intentos");
    expect(accountErrorMessage({ code: "BACKOFFICE_TIMEOUT" }, "register")).toContain("no está disponible");
    expect(
      accountErrorMessage({ status: 401, code: "SESSION_EXPIRED" }, "login"),
    ).toContain("sesión venció");
    expect(accountErrorMessage({ status: 440 }, "logout")).toContain("sesión venció");
  });
});
