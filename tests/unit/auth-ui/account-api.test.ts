import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getAccount } from "@/app/api/mock/account/route";
import { POST as saveLimits } from "@/app/api/mock/account/limits/route";
import { POST as pauseAccount } from "@/app/api/mock/account/pause/route";
import { POST as updateProfile } from "@/app/api/mock/account/profile/route";
import { POST as register } from "@/app/api/mock/session/register/route";
import { MOCK_SESSION_COOKIE } from "@/app/api/mock/_shared/http";
import {
  accountLimitsSchema,
  accountPauseSchema,
  accountProfileSchema,
  type AccountSettings,
} from "@/lib/account/contracts";
import { GamingDomainError } from "@/lib/gaming/errors";
import { MOCK_SESSION_TTL_SECONDS } from "@/lib/gaming/mock-provider";

const provider = vi.hoisted(() => ({
  getAccountSettings: vi.fn(),
  saveAccountLimits: vi.fn(),
  pauseAccount: vi.fn(),
  updateAccountProfile: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  hasSession: vi.fn(),
}));

vi.mock("@/lib/gaming/server", () => ({ mockGamingProvider: provider }));

const session = {
  id: "account-current-session",
  displayName: "Ana Cuenta",
  role: "PLAYER" as const,
  balance: 250_000,
  currency: "PYG" as const,
};
const limits = { daily: 50_000, weekly: 200_000, minutes: 60 };
const settings: AccountSettings = {
  sessionId: session.id,
  scope: "session",
  sessionStartedAt: "2026-08-27T12:00:00.000Z",
  limits: null,
  pausedUntil: null,
  usage: { daily: 500, weekly: 1_500, minutes: 5 },
};
const idempotencyKey = "account-api-request-001";

type AccountProviderMethod =
  | "getAccountSettings"
  | "saveAccountLimits"
  | "pauseAccount"
  | "updateAccountProfile";

interface AccountRoute {
  name: string;
  path: string;
  method: "GET" | "POST";
  handler: (request: NextRequest) => NextResponse | Promise<NextResponse>;
  providerMethod: AccountProviderMethod;
  body?: unknown;
  response: object;
}

const mutationRoutes: AccountRoute[] = [
  {
    name: "POST límites",
    path: "/api/mock/account/limits",
    method: "POST",
    handler: saveLimits,
    providerMethod: "saveAccountLimits",
    body: limits,
    response: { settings: { ...settings, limits }, replayed: false },
  },
  {
    name: "POST pausa",
    path: "/api/mock/account/pause",
    method: "POST",
    handler: pauseAccount,
    providerMethod: "pauseAccount",
    body: { durationMinutes: 30 },
    response: {
      settings: { ...settings, pausedUntil: "2026-08-27T12:35:00.000Z" },
      replayed: false,
    },
  },
  {
    name: "POST perfil",
    path: "/api/mock/account/profile",
    method: "POST",
    handler: updateProfile,
    providerMethod: "updateAccountProfile",
    body: { displayName: "Ana Actualizada" },
    response: {
      session: { ...session, displayName: "Ana Actualizada" },
      replayed: false,
    },
  },
];

const accountRoutes: AccountRoute[] = [
  {
    name: "GET cuenta",
    path: "/api/mock/account",
    method: "GET",
    handler: getAccount,
    providerMethod: "getAccountSettings",
    response: { settings },
  },
  ...mutationRoutes,
];

function accountRequest(
  route: AccountRoute,
  {
    cookieSession = session.id,
    expectedSession = session.id,
    key = idempotencyKey,
    rawBody,
  }: {
    cookieSession?: string | null;
    expectedSession?: string | null;
    key?: string | null;
    rawBody?: string;
  } = {},
) {
  const headers = new Headers();
  if (cookieSession !== null) {
    headers.set("Cookie", `${MOCK_SESSION_COOKIE}=${cookieSession}`);
  }
  if (expectedSession !== null) headers.set("X-Account-Session", expectedSession);
  if (route.method === "POST") {
    headers.set("Content-Type", "application/json");
    if (key !== null) headers.set("Idempotency-Key", key);
  }
  return new NextRequest(`https://quinie.example${route.path}`, {
    method: route.method,
    headers,
    body: route.method === "POST" ? rawBody ?? JSON.stringify(route.body) : undefined,
  });
}

function expectSessionCookie(response: NextResponse, expectedId = session.id) {
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.cookies.get(MOCK_SESSION_COOKIE)).toMatchObject({
    name: MOCK_SESSION_COOKIE,
    value: expectedId,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: MOCK_SESSION_TTL_SECONDS,
  });
}

async function expectApiError(response: NextResponse, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.cookies.get(MOCK_SESSION_COOKIE)).toBeUndefined();
  expect(await response.json()).toMatchObject({ error: { code } });
}

function expectProviderUntouched() {
  for (const method of Object.values(provider)) expect(method).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SESSION_COOKIE_SECURE", "true");
  provider.getAccountSettings.mockReturnValue(structuredClone(settings));
  for (const route of mutationRoutes) {
    provider[route.providerMethod].mockReturnValue(structuredClone(route.response));
  }
  provider.createSession.mockReturnValue({ ...session, id: "registered-session" });
  provider.deleteSession.mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(accountRoutes)("API de Cuenta: $name", (route) => {
  it("rechaza la ausencia de cookie sin invocar ni crear una sesión", async () => {
    const response = await route.handler(accountRequest(route, { cookieSession: null }));

    await expectApiError(response, 401, "SESSION_REQUIRED");
    expectProviderUntouched();
  });

  it.each([
    { name: "ausente", expectedSession: null },
    { name: "de otra sesión", expectedSession: "account-previous-session" },
  ])("rechaza el identificador esperado $name antes de leer el body o tocar el proveedor", async ({ expectedSession }) => {
    const response = await route.handler(accountRequest(route, {
      expectedSession,
      rawBody: "{JSON inválido",
    }));

    await expectApiError(response, 409, "ACCOUNT_SESSION_CHANGED");
    expectProviderUntouched();
  });

  it("entrega la respuesta autoritativa y renueva únicamente la cookie correcta", async () => {
    const response = await route.handler(accountRequest(route));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(route.response);
    expectSessionCookie(response);
    expect(provider[route.providerMethod]).toHaveBeenCalledTimes(1);
    if (route.method === "GET") {
      expect(provider[route.providerMethod]).toHaveBeenCalledWith(session.id);
    } else {
      expect(provider[route.providerMethod]).toHaveBeenCalledWith(session.id, route.body, idempotencyKey);
    }
    expect(provider.createSession).not.toHaveBeenCalled();
    expect(provider.deleteSession).not.toHaveBeenCalled();
  });

  it("conserva el 401 de una sesión vencida sin establecer otra cookie", async () => {
    provider[route.providerMethod].mockImplementation(() => {
      throw new GamingDomainError("SESSION_NOT_FOUND", "La sesión expiró.");
    });
    const response = await route.handler(accountRequest(route));

    await expectApiError(response, 401, "SESSION_NOT_FOUND");
    expect(provider.createSession).not.toHaveBeenCalled();
  });

  it("no convierte un fallo inesperado en éxito ni expone detalles internos", async () => {
    provider[route.providerMethod].mockImplementation(() => {
      throw new Error("Detalle interno sensible del proveedor");
    });
    const response = await route.handler(accountRequest(route));

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.cookies.get(MOCK_SESSION_COOKIE)).toBeUndefined();
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "No pudimos completar la operación." },
    });
  });
});

describe.each(mutationRoutes)("Mutaciones de Cuenta: $name", (route) => {
  it("requiere la clave idempotente antes de invocar la mutación", async () => {
    const response = await route.handler(accountRequest(route, { key: null }));

    await expectApiError(response, 400, "IDEMPOTENCY_KEY_REQUIRED");
    expectProviderUntouched();
  });

  it("rechaza JSON inválido sin invocar la mutación", async () => {
    const response = await route.handler(accountRequest(route, { rawBody: "{" }));

    await expectApiError(response, 400, "INVALID_JSON");
    expectProviderUntouched();
  });

  it("reenvía la misma clave en un reintento y conserva la indicación de replay del servidor", async () => {
    provider[route.providerMethod]
      .mockReturnValueOnce({ ...route.response, replayed: false })
      .mockReturnValueOnce({ ...route.response, replayed: true });

    const first = await route.handler(accountRequest(route));
    const retry = await route.handler(accountRequest(route));

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(await first.json()).toEqual({ ...route.response, replayed: false });
    expect(await retry.json()).toEqual({ ...route.response, replayed: true });
    expectSessionCookie(retry);
    expect(provider[route.providerMethod]).toHaveBeenNthCalledWith(1, session.id, route.body, idempotencyKey);
    expect(provider[route.providerMethod]).toHaveBeenNthCalledWith(2, session.id, route.body, idempotencyKey);
  });

  it("conserva el conflicto idempotente sin responder con datos de éxito", async () => {
    provider[route.providerMethod].mockImplementation(() => {
      throw new GamingDomainError("IDEMPOTENCY_CONFLICT", "La clave ya fue utilizada.");
    });
    const response = await route.handler(accountRequest(route));

    await expectApiError(response, 409, "IDEMPOTENCY_CONFLICT");
  });
});

describe("Errores de validación y límites de la API", () => {
  it.each([
    { route: mutationRoutes[0], schema: accountLimitsSchema, input: { ...limits, daily: 0 } },
    { route: mutationRoutes[1], schema: accountPauseSchema, input: { durationMinutes: 45 } },
    { route: mutationRoutes[2], schema: accountProfileSchema, input: { displayName: "A" } },
  ])("devuelve los errores de esquema de $route.name como 400", async ({ route, schema, input }) => {
    provider[route.providerMethod].mockImplementation((_sessionId, body) => schema.parse(body));
    const response = await route.handler(accountRequest(route, { rawBody: JSON.stringify(input) }));

    await expectApiError(response, 400, "VALIDATION_ERROR");
  });

  it.each([
    { code: "ACCOUNT_LIMIT_INCREASE" as const, status: 409 },
    { code: "ACCOUNT_PAUSE_SHORTENED" as const, status: 409 },
    { code: "ACCOUNT_PAUSED" as const, status: 423 },
    { code: "ACCOUNT_TIME_LIMIT" as const, status: 423 },
    { code: "ACCOUNT_AMOUNT_LIMIT" as const, status: 409 },
  ])("mantiene $code como $status sin invalidar la cookie de sesión", async ({ code, status }) => {
    provider.saveAccountLimits.mockImplementation(() => {
      throw new GamingDomainError(code, "La operación no está permitida.");
    });
    const response = await saveLimits(accountRequest(mutationRoutes[0]));

    await expectApiError(response, status, code);
    expect(provider.deleteSession).not.toHaveBeenCalled();
  });
});

describe("Registro mediante una sesión del servidor", () => {
  const registration = {
    displayName: "  Ana Cuenta  ",
    documentOrPhone: "0981000000",
    password: "clave-temporal-2026",
    acceptedTerms: true,
  };

  function registrationRequest(body: unknown = registration, previousSession?: string, rawBody?: string) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (previousSession) headers.set("Cookie", `${MOCK_SESSION_COOKIE}=${previousSession}`);
    return new NextRequest("https://quinie.example/api/mock/session/register", {
      method: "POST",
      headers,
      body: rawBody ?? JSON.stringify(body),
    });
  }

  it("crea una sesión sin cookie previa y no conserva ni devuelve las credenciales", async () => {
    const response = await register(registrationRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ session: { ...session, id: "registered-session" } });
    expectSessionCookie(response, "registered-session");
    expect(provider.createSession).toHaveBeenCalledExactlyOnceWith({ displayName: "Ana Cuenta" });
    expect(provider.deleteSession).not.toHaveBeenCalled();
  });

  it("reemplaza la sesión anterior y establece la cookie con el nuevo identificador", async () => {
    const response = await register(registrationRequest(registration, "previous-session"));

    expect(response.status).toBe(200);
    expect(provider.deleteSession).toHaveBeenCalledExactlyOnceWith("previous-session");
    expect(provider.createSession).toHaveBeenCalledExactlyOnceWith({ displayName: "Ana Cuenta" });
    expect(provider.deleteSession.mock.invocationCallOrder[0]).toBeLessThan(provider.createSession.mock.invocationCallOrder[0]);
    expectSessionCookie(response, "registered-session");
  });

  it.each([
    { name: "nombre inválido", change: { displayName: "A" } },
    { name: "identificador inválido", change: { documentOrPhone: "12" } },
    { name: "contraseña corta", change: { password: "corta" } },
    { name: "consentimiento ausente", change: { acceptedTerms: false } },
  ])("rechaza $name sin eliminar la sesión existente", async ({ change }) => {
    const response = await register(registrationRequest({ ...registration, ...change }, "previous-session"));

    await expectApiError(response, 400, "VALIDATION_ERROR");
    expectProviderUntouched();
  });

  it("rechaza JSON malformado sin eliminar la sesión existente", async () => {
    const response = await register(registrationRequest(registration, "previous-session", "{"));

    await expectApiError(response, 400, "INVALID_JSON");
    expectProviderUntouched();
  });

  it("no confirma un registro si el servidor no pudo crear la sesión", async () => {
    provider.createSession.mockImplementation(() => {
      throw new Error("No se pudo establecer la sesión interna.");
    });
    const response = await register(registrationRequest());

    await expectApiError(response, 500, "INTERNAL_ERROR");
  });
});
