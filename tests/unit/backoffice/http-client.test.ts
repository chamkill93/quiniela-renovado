import { describe, expect, it, vi } from "vitest";

import type {
  BackofficeEndpoints,
  BackofficeFetch,
  BackofficeSession,
} from "@/lib/backoffice";
import {
  BackofficeHttpError,
  BackofficeProtocolError,
  createBackofficeClient,
} from "@/lib/backoffice";

const endpoints = {
  session: "auth/session",
  bootstrap: "app/bootstrap",
  login: "auth/login",
  register: "auth/register",
  logout: "auth/logout",
  catalog: "gaming/catalog",
  plays: "gaming/plays",
  traditionalPlays: "gaming/plays/traditional",
  instantPlays: "gaming/plays/instant",
  results: "gaming/results",
} satisfies BackofficeEndpoints;

const session: BackofficeSession = {
  id: "user-1",
  displayName: "Ana",
  role: "PLAYER",
  balance: 25_000,
  currency: "PYG",
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

function createFetchMock() {
  return vi.fn<BackofficeFetch>();
}

describe("HttpBackofficeClient", () => {
  it("uses the configured base URL, includes credentials and forwards AbortSignal", async () => {
    const fetchMock = createFetchMock();
    fetchMock.mockResolvedValue(jsonResponse({ session }));
    const controller = new AbortController();
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example/v2/",
      endpoints,
      headers: async () => ({ "X-Tenant": "quinie-la" }),
      fetch: fetchMock,
    });

    await expect(
      client.getSession({
        signal: controller.signal,
        headers: { "X-Screen": "account" },
      }),
    ).resolves.toEqual({ session });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://backoffice.example/v2/auth/session");
    expect(init).toMatchObject({
      method: "GET",
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });
    const headers = new Headers(init?.headers);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("X-Tenant")).toBe("quinie-la");
    expect(headers.get("X-Screen")).toBe("account");
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("forwards login and registration payloads without local business logic", async () => {
    const fetchMock = createFetchMock();
    fetchMock.mockImplementation(async () => jsonResponse({ session }));
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example/v2",
      endpoints,
      fetch: fetchMock,
    });
    const login = { documentOrPhone: "1234567", password: "secret" };
    const registration = {
      displayName: "Ana",
      documentOrPhone: "1234567",
      password: "secret",
      phone: "+595981000000",
      acceptedTerms: true,
    };

    await client.login(login);
    await client.register(registration);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://backoffice.example/v2/auth/login",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify(login),
      credentials: "include",
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://backoffice.example/v2/auth/register",
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify(registration),
      credentials: "include",
    });
    expect(
      new Headers(fetchMock.mock.calls[1][1]?.headers).get("Content-Type"),
    ).toBe("application/json");
  });

  it("covers catalog, history, play submission, results and logout endpoints", async () => {
    const fetchMock = createFetchMock();
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === "POST" && !init.body
        ? new Response(null, { status: 204 })
        : jsonResponse({ ok: true }),
    );
    const client = createBackofficeClient({
      baseUrl: "/backoffice-gateway",
      endpoints,
      fetch: fetchMock,
    });

    await client.bootstrap();
    await client.getCatalog();
    await client.getPlays({
      family: "INSTANT",
      status: "WON",
      cursor: "page 2",
      limit: 20,
    });
    await client.placeTraditionalPlay(
      { gameId: "head", drawId: "draw-1", amount: 500, selection: "497" },
      { idempotencyKey: "traditional-1" },
    );
    await client.placeInstantPlay(
      { gameId: "mbohapy", amount: 1_000, selection: "497" },
      { idempotencyKey: "instant-1" },
    );
    await client.getResults({
      gameId: "mbohapy",
      source: "INSTANT",
      cursor: "result 2",
      limit: 10,
    });
    await client.logout();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/backoffice-gateway/app/bootstrap",
      "/backoffice-gateway/gaming/catalog",
      "/backoffice-gateway/gaming/plays?family=INSTANT&status=WON&cursor=page+2&limit=20",
      "/backoffice-gateway/gaming/plays/traditional",
      "/backoffice-gateway/gaming/plays/instant",
      "/backoffice-gateway/gaming/results?gameId=mbohapy&source=INSTANT&cursor=result+2&limit=10",
      "/backoffice-gateway/auth/logout",
    ]);
    expect(
      new Headers(fetchMock.mock.calls[3][1]?.headers).get("Idempotency-Key"),
    ).toBe("traditional-1");
    expect(
      new Headers(fetchMock.mock.calls[4][1]?.headers).get("Idempotency-Key"),
    ).toBe("instant-1");
    expect(fetchMock.mock.calls.every(([, init]) => init?.credentials === "include")).toBe(true);
  });

  it("normalizes structured HTTP failures into BackofficeHttpError", async () => {
    const fetchMock = createFetchMock();
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Credenciales inválidas.",
            issues: [{ field: "password" }],
          },
        },
        { status: 401, headers: { "X-Request-Id": "request-42" } },
      ),
    );
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });

    const failure = await client
      .login({ documentOrPhone: "123", password: "bad" })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(BackofficeHttpError);
    expect(failure).toMatchObject({
      name: "BackofficeHttpError",
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Credenciales inválidas.",
      details: [{ field: "password" }],
      requestId: "request-42",
      method: "POST",
      url: "https://backoffice.example/auth/login",
    });
  });

  it("provides stable fallback metadata for non-JSON HTTP failures", async () => {
    const fetchMock = createFetchMock();
    fetchMock.mockResolvedValue(
      new Response("Backoffice unavailable", { status: 503 }),
    );
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });

    await expect(client.getCatalog()).rejects.toMatchObject({
      status: 503,
      code: "BACKOFFICE_HTTP_503",
      message: "Backoffice unavailable",
    });
  });

  it("distinguishes a successful but malformed payload from an HTTP error", async () => {
    const fetchMock = createFetchMock();
    fetchMock.mockResolvedValue(
      new Response("not-json", {
        status: 200,
        headers: { "X-Correlation-Id": "correlation-7" },
      }),
    );
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });

    await expect(client.bootstrap()).rejects.toMatchObject({
      name: "BackofficeProtocolError",
      code: "INVALID_BACKOFFICE_RESPONSE",
      status: 200,
      requestId: "correlation-7",
    } satisfies Partial<BackofficeProtocolError>);
  });

  it("accepts an absolute endpoint override and rejects an empty base URL", async () => {
    const fetchMock = createFetchMock();
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }));
    const absoluteEndpoints = {
      ...endpoints,
      results: "https://results.example/public/latest",
    };
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example/v2",
      endpoints: absoluteEndpoints,
      fetch: fetchMock,
    });

    await client.getResults();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://results.example/public/latest",
    );
    expect(() =>
      createBackofficeClient({ baseUrl: " ", endpoints, fetch: fetchMock }),
    ).toThrow(TypeError);
  });
});
