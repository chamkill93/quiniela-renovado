// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { AccountClient } from "@/features/product/account-client";
import { buildGamingCatalog } from "@/lib/gaming";
import type { MockSession } from "@/lib/product/api-types";
import {
  createFixtureProductGateway,
  ProductGatewayHttpError,
  type FixtureProductGatewayConfig,
  type ProductGateway,
  type ProductSnapshot,
} from "@/lib/product/gateway";
import { ProductProvider } from "@/providers/product-provider";

const catalog = buildGamingCatalog(
  "REFUND",
  new Date("2026-08-25T12:00:00.000Z"),
);

const session: MockSession = {
  id: "fixture-account",
  displayName: "Ana Fixture",
  role: "PLAYER",
  balance: 25_000,
  currency: "PYG",
};

const loggedOutSnapshot: ProductSnapshot = {
  session: null,
  catalog,
  plays: [],
  results: [],
};

const authenticatedSnapshot: ProductSnapshot = {
  ...loggedOutSnapshot,
  session,
};

type BootstrapStep = ProductSnapshot | Error;
const originalRequestAnimationFrame = window.requestAnimationFrame;

function gatewayWithBootstrapSequence(
  fixtures: FixtureProductGatewayConfig,
  steps: readonly BootstrapStep[],
) {
  const fixture = createFixtureProductGateway(fixtures);
  let bootstrapCalls = 0;

  const gateway: ProductGateway = {
    mode: fixture.mode,
    capabilities: fixture.capabilities,
    async bootstrap(options) {
      options?.signal?.throwIfAborted();
      await Promise.resolve();
      options?.signal?.throwIfAborted();

      const index = Math.min(bootstrapCalls, steps.length - 1);
      bootstrapCalls += 1;
      const step = steps[index];
      if (step instanceof Error) throw step;
      return structuredClone(step);
    },
    requestPlay: fixture.requestPlay.bind(fixture),
    getResults: fixture.getResults.bind(fixture),
    login: fixture.login.bind(fixture),
    register: fixture.register.bind(fixture),
    logout: fixture.logout.bind(fixture),
    getMovements: fixture.getMovements.bind(fixture),
    topUp: fixture.topUp.bind(fixture),
  };

  return {
    gateway,
    getBootstrapCalls: () => bootstrapCalls,
  };
}

function renderAccount(gateway: ProductGateway) {
  const user = userEvent.setup();
  render(
    <ProductProvider gateway={gateway}>
      <AccountClient />
    </ProductProvider>,
  );
  return user;
}

function fixtureConfig(
  overrides: FixtureProductGatewayConfig = {},
): FixtureProductGatewayConfig {
  return {
    bootstrap: loggedOutSnapshot,
    login: { session },
    register: { session },
    ...overrides,
  };
}

function submitButton(name: "Ingresar" | "Crear cuenta") {
  const matches = screen.getAllByRole("button", { name });
  return matches[matches.length - 1];
}

beforeAll(() => {
  window.requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(performance.now());
    return 1;
  };
});

afterAll(() => {
  window.requestAnimationFrame = originalRequestAnimationFrame;
});

afterEach(() => {
  cleanup();
});

describe("AccountClient integrado con ProductProvider", () => {
  it("inicia sesión y limpia identificador y contraseña después del logout", async () => {
    const { gateway, getBootstrapCalls } = gatewayWithBootstrapSequence(
      fixtureConfig(),
      [loggedOutSnapshot, authenticatedSnapshot],
    );
    const user = renderAccount(gateway);

    await screen.findByRole("heading", { name: "Ingresá a tu cuenta" });
    await user.type(
      screen.getByRole("textbox", { name: "Documento o teléfono" }),
      "0981000000",
    );
    await user.type(screen.getByLabelText("Contraseña"), "clave-temporal");
    await user.click(submitButton("Ingresar"));

    expect(await screen.findByRole("heading", { name: "Cuenta" })).toBeTruthy();
    expect(screen.getByText("Ana Fixture")).toBeTruthy();
    await waitFor(() => expect(getBootstrapCalls()).toBe(2));

    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await screen.findByRole("heading", { name: "Ingresá a tu cuenta" });
    expect(
      screen.getByRole<HTMLInputElement>("textbox", {
        name: "Documento o teléfono",
      }).value,
    ).toBe("");
    expect(screen.getByLabelText<HTMLInputElement>("Contraseña").value).toBe("");
  });

  it("muestra INVALID_CREDENTIALS como fallo local sin inventar sesión vencida", async () => {
    const invalidCredentials = new ProductGatewayHttpError(
      401,
      "INVALID_CREDENTIALS",
      "Respuesta sensible que la interfaz no debe mostrar",
    );
    const gateway = createFixtureProductGateway(
      fixtureConfig({ failures: { login: invalidCredentials } }),
    );
    const user = renderAccount(gateway);

    await screen.findByRole("heading", { name: "Ingresá a tu cuenta" });
    await user.type(
      screen.getByRole("textbox", { name: "Documento o teléfono" }),
      "1234567",
    );
    await user.type(screen.getByLabelText("Contraseña"), "incorrecta");
    await user.click(submitButton("Ingresar"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("no coincide con una cuenta activa");
    expect(alert.textContent).not.toContain("Respuesta sensible");
    expect(screen.queryByText("Tu sesión venció. Ingresá nuevamente.")).toBeNull();
    expect(screen.getByRole("heading", { name: "Ingresá a tu cuenta" })).toBeTruthy();
  });

  it.each([
    {
      label: "límite de intentos",
      failure: new ProductGatewayHttpError(
        429,
        "RATE_LIMITED",
        "Detalle privado de rate limit",
      ),
      expected: "demasiados intentos",
    },
    {
      label: "backoffice indisponible",
      failure: new ProductGatewayHttpError(
        503,
        "BACKOFFICE_UNAVAILABLE",
        "Detalle privado de indisponibilidad",
      ),
      expected: "backoffice no está disponible",
    },
    {
      label: "timeout",
      failure: new ProductGatewayHttpError(
        0,
        "BACKOFFICE_TIMEOUT",
        "Detalle privado del timeout",
      ),
      expected: "backoffice no está disponible",
    },
    {
      label: "error de red",
      failure: new ProductGatewayHttpError(
        0,
        "BACKOFFICE_NETWORK_ERROR",
        "Detalle privado de la red",
      ),
      expected: "backoffice no está disponible",
    },
    {
      label: "sesión expirada",
      failure: new ProductGatewayHttpError(
        419,
        "SESSION_EXPIRED",
        "Detalle privado de la sesión",
      ),
      expected: "sesión venció",
    },
    {
      label: "error inesperado",
      failure: new Error("Fallo inesperado controlado por el fixture"),
      expected: "Fallo inesperado controlado por el fixture",
    },
  ])("presenta el estado de red/autenticación: $label", async ({ failure, expected }) => {
    const gateway = createFixtureProductGateway(
      fixtureConfig({ failures: { login: failure } }),
    );
    const user = renderAccount(gateway);

    await screen.findByRole("heading", { name: "Ingresá a tu cuenta" });
    await user.type(
      screen.getByRole("textbox", { name: "Documento o teléfono" }),
      "1234567",
    );
    await user.type(screen.getByLabelText("Contraseña"), "clave-fixture");
    await user.click(submitButton("Ingresar"));

    expect((await screen.findByRole("alert")).textContent).toContain(expected);
    expect(screen.getByRole("heading", { name: "Ingresá a tu cuenta" })).toBeTruthy();
  });

  it("bloquea el doble submit mientras el conector de login sigue pendiente", async () => {
    const sequence = gatewayWithBootstrapSequence(
      fixtureConfig(),
      [loggedOutSnapshot, authenticatedSnapshot],
    );
    let resolveLogin!: (value: {
      session: MockSession;
      source: "preview-fixture";
    }) => void;
    const pendingLogin = new Promise<{
      session: MockSession;
      source: "preview-fixture";
    }>((resolve) => {
      resolveLogin = resolve;
    });
    let loginCalls = 0;
    const gateway: ProductGateway = {
      ...sequence.gateway,
      login: async () => {
        loginCalls += 1;
        return pendingLogin;
      },
    };
    const user = renderAccount(gateway);

    await screen.findByRole("heading", { name: "Ingresá a tu cuenta" });
    await user.type(
      screen.getByRole("textbox", { name: "Documento o teléfono" }),
      "1234567",
    );
    await user.type(screen.getByLabelText("Contraseña"), "clave-fixture");
    const form = submitButton("Ingresar").closest("form");
    if (!form) throw new Error("El botón de ingreso debe pertenecer al formulario.");

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(loginCalls).toBe(1);
    resolveLogin({ session, source: "preview-fixture" });
    expect(await screen.findByRole("heading", { name: "Cuenta" })).toBeTruthy();
    await waitFor(() => expect(sequence.getBootstrapCalls()).toBe(2));
  });

  it("marca los campos inválidos con ARIA y enfoca el primer error", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig());
    const user = renderAccount(gateway);

    await screen.findByRole("heading", { name: "Ingresá a tu cuenta" });
    const identifier = screen.getByRole("textbox", {
      name: "Documento o teléfono",
    });
    await user.click(submitButton("Ingresar"));

    expect(document.activeElement).toBe(identifier);
    expect(identifier.getAttribute("aria-invalid")).toBe("true");
    expect(identifier.getAttribute("aria-describedby")).toBe("identifier-error");
    expect(screen.getByRole("alert").getAttribute("tabindex")).toBe("-1");
    expect(screen.getByText("Ingresá un documento o teléfono válido.")).toBeTruthy();
  });

  it("identifica explícitamente el registro fixture como no persistente", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig());
    const user = renderAccount(gateway);

    await screen.findByRole("heading", { name: "Ingresá a tu cuenta" });
    await user.click(screen.getByRole("button", { name: "Registrarme" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre visible" }), "Ana");
    await user.type(
      screen.getByRole("textbox", { name: "Documento o teléfono" }),
      "0981000000",
    );
    await user.type(screen.getByLabelText("Contraseña"), "registro-seguro");
    await user.click(
      screen.getByRole("checkbox", {
        name: "Acepto los términos de uso y la política de privacidad.",
      }),
    );
    await user.click(submitButton("Crear cuenta"));

    expect(await screen.findByRole("heading", { name: "Cuenta" })).toBeTruthy();
    expect((await screen.findByRole("status")).textContent).toContain(
      "Registro simulado para esta vista previa; no se creó una cuenta persistente.",
    );
    expect(screen.getByText("Fixture de vista previa")).toBeTruthy();
  });

  it("normaliza USER_EXISTS durante el registro sin iniciar una sesión", async () => {
    const gateway = createFixtureProductGateway(
      fixtureConfig({
        failures: {
          register: new ProductGatewayHttpError(
            409,
            "USER_EXISTS",
            "Detalle privado del proveedor",
          ),
        },
      }),
    );
    const user = renderAccount(gateway);

    await screen.findByRole("heading", { name: "Ingresá a tu cuenta" });
    await user.click(screen.getByRole("button", { name: "Registrarme" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre visible" }), "Ana");
    await user.type(
      screen.getByRole("textbox", { name: "Documento o teléfono" }),
      "0981000000",
    );
    await user.type(screen.getByLabelText("Contraseña"), "registro-seguro");
    await user.click(
      screen.getByRole("checkbox", {
        name: "Acepto los términos de uso y la política de privacidad.",
      }),
    );
    await user.click(submitButton("Crear cuenta"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Ya existe una cuenta");
    expect(alert.textContent).not.toContain("Detalle privado");
    expect(screen.getByRole("heading", { name: "Creá tu cuenta" })).toBeTruthy();
  });

  it("expone el error de bootstrap y permite reintentar con el mismo gateway", async () => {
    const unavailable = new ProductGatewayHttpError(
      0,
      "GATEWAY_NETWORK_ERROR",
      "Sin conexión con el backoffice fixture.",
    );
    const { gateway, getBootstrapCalls } = gatewayWithBootstrapSequence(
      fixtureConfig(),
      [unavailable, loggedOutSnapshot],
    );
    const user = renderAccount(gateway);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Sin conexión con el backoffice fixture.",
    );
    expect(getBootstrapCalls()).toBe(1);

    await user.click(screen.getByRole("button", { name: "Reintentar conexión" }));

    await waitFor(() => expect(getBootstrapCalls()).toBe(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByRole("heading", { name: "Ingresá a tu cuenta" })).toBeTruthy();
  });
});
