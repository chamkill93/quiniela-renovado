import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  BackofficeEndpoints,
  BackofficeFetch,
  BackofficeSession,
} from "@/lib/backoffice";
import {
  BackofficeAbortError,
  BackofficeCapabilityError,
  BackofficeHttpError,
  BackofficeNetworkError,
  BackofficeProtocolError,
  BackofficeTimeoutError,
  createBackofficeClient,
} from "@/lib/backoffice";
import { buildGamingCatalog } from "@/lib/gaming";
import type {
  GamingPlay,
  GamingTicket,
  PlacePlayResponse,
  TopupResponse,
  WalletMovement,
} from "@/lib/gaming/types";

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

const catalog = buildGamingCatalog("REFUND", new Date("2026-08-25T12:00:00Z"));

const play: GamingPlay = {
  id: "play-1",
  ticketId: "ticket-1",
  family: "INSTANT",
  gameId: "mbohapy",
  gameName: "Mbohapy",
  selection: "497",
  drawId: null,
  amount: 500,
  currency: "PYG",
  status: "WON",
  result: "497",
  resultNumbers: ["497"],
  ruleResult: "EXACT",
  matches: 1,
  payoutMultiplier: 700,
  prize: 350_000,
  createdAt: "2026-08-25T12:00:00Z",
};

const ticket: GamingTicket = {
  id: "ticket-1",
  code: "QL-TICKET1",
  playId: "play-1",
  gameId: "mbohapy",
  gameName: "Mbohapy",
  family: "INSTANT",
  selection: "497",
  drawId: null,
  amount: 500,
  currency: "PYG",
  status: "WON",
  result: "497",
  resultNumbers: ["497"],
  ruleResult: "EXACT",
  prize: 350_000,
  issuedAt: "2026-08-25T12:00:00Z",
};

const placePlayResponse: PlacePlayResponse = {
  play,
  ticket,
  session: { balance: 374_500, currency: "PYG" },
  replayed: false,
};

const traditionalPlacePlayResponse: PlacePlayResponse = {
  play: {
    ...play,
    family: "TRADITIONAL",
    gameId: "head",
    gameName: "A la Cabeza",
    drawId: "early",
    status: "PENDING",
    result: null,
    resultNumbers: null,
    ruleResult: null,
    matches: null,
    payoutMultiplier: 0,
    prize: 0,
  },
  ticket: {
    ...ticket,
    family: "TRADITIONAL",
    gameId: "head",
    gameName: "A la Cabeza",
    drawId: "early",
    status: "PENDING",
    result: null,
    resultNumbers: null,
    ruleResult: null,
    prize: 0,
  },
  session: { balance: 24_500, currency: "PYG" },
  replayed: false,
};

const movement: WalletMovement = {
  id: "movement-1",
  type: "TOPUP",
  amount: 50_000,
  currency: "PYG",
  balanceAfter: 75_000,
  referenceId: "topup-1",
  method: "CARD",
  createdAt: "2026-08-25T12:00:00Z",
};

const topUpResponse: TopupResponse = {
  session: { ...session, balance: 75_000 },
  balanceEntry: movement,
  replayed: false,
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

function validResponseFor(url: RequestInfo | URL, init?: RequestInit) {
  const value = String(url);
  if (value.includes("app/bootstrap")) {
    return jsonResponse({ session, catalog, plays: [], results: [] });
  }
  if (value.includes("gaming/catalog")) return jsonResponse({ catalog });
  if (value.includes("gaming/plays?") || value.endsWith("gaming/plays")) {
    return jsonResponse({ plays: [] });
  }
  if (value.includes("gaming/plays/traditional")) {
    return jsonResponse(traditionalPlacePlayResponse);
  }
  if (value.includes("gaming/plays/instant")) return jsonResponse(placePlayResponse);
  if (value.includes("gaming/results")) return jsonResponse({ results: [] });
  if (init?.method === "POST" && !init.body) {
    return new Response(null, { status: 204 });
  }
  return jsonResponse({ session });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("HttpBackofficeClient", () => {
  it("uses the configured base URL, credentials and composed AbortSignal", async () => {
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
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.signal).not.toBe(controller.signal);
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
    fetchMock.mockImplementation(async (input, init) =>
      validResponseFor(input, init),
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
      {
        gameId: "head",
        drawId: "draw-1",
        amount: 500,
        selection: { number: "497" },
      },
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
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.credentials === "include"),
    ).toBe(true);
  });

  it("normalizes structured HTTP failures and preserves session error codes", async () => {
    const fetchMock = createFetchMock();
    fetchMock.mockResolvedValueOnce(
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
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 419 }));
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
      kind: "HTTP",
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Credenciales inválidas.",
      details: [{ field: "password" }],
      requestId: "request-42",
      method: "POST",
      url: "https://backoffice.example/auth/login",
    });
    await expect(client.getSession()).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
    await expect(client.getSession()).rejects.toMatchObject({
      status: 419,
      code: "SESSION_EXPIRED",
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

  it("rejects invalid JSON, empty bodies and valid JSON with an invalid DTO", async () => {
    const fetchMock = createFetchMock();
    fetchMock.mockResolvedValueOnce(
      new Response("not-json", {
        status: 200,
        headers: { "X-Correlation-Id": "correlation-7" },
      }),
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ session: { id: 7 } }));
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });

    await expect(client.bootstrap()).rejects.toMatchObject({
      name: "BackofficeProtocolError",
      kind: "PROTOCOL",
      code: "INVALID_BACKOFFICE_RESPONSE",
      reason: "INVALID_JSON",
      status: 200,
      requestId: "correlation-7",
    } satisfies Partial<BackofficeProtocolError>);
    await expect(client.getSession()).rejects.toMatchObject({
      reason: "EMPTY_PAYLOAD",
    });
    const invalidDto = await client
      .getSession()
      .catch((error: unknown) => error);
    expect(invalidDto).toBeInstanceOf(BackofficeProtocolError);
    expect(invalidDto).toMatchObject({ reason: "INVALID_PAYLOAD" });
    expect((invalidDto as BackofficeProtocolError).details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.arrayContaining(["session"]) }),
      ]),
    );
  });

  it("rejects non-ISO dates before they reach date formatting in the UI", async () => {
    const invalidCatalog = {
      ...catalog,
      draws: catalog.draws.map((draw, index) =>
        index === 0 ? { ...draw, closesAt: "mañana" } : draw,
      ),
    };
    const fetchMock = createFetchMock();
    fetchMock.mockResolvedValue(
      jsonResponse({ session, catalog: invalidCatalog, plays: [], results: [] }),
    );
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });

    const failure = await client.bootstrap().catch((reason: unknown) => reason);
    expect(failure).toMatchObject({ reason: "INVALID_PAYLOAD" });
    expect((failure as BackofficeProtocolError).details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.arrayContaining(["catalog", "draws", 0, "closesAt"]),
        }),
      ]),
    );
  });

  it("rejects fractional or non-positive PYG amounts from the catalog", async () => {
    const fetchMock = createFetchMock();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ catalog: { ...catalog, amounts: [-500] } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ catalog: { ...catalog, amounts: [500.5] } }),
      );
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });

    await expect(client.getCatalog()).rejects.toMatchObject({
      reason: "INVALID_PAYLOAD",
    });
    await expect(client.getCatalog()).rejects.toMatchObject({
      reason: "INVALID_PAYLOAD",
    });
  });

  it("rejects catalog definitions incompatible with the rendered game", async () => {
    const invalidCatalog = {
      ...catalog,
      instant: catalog.instant.map((game) =>
        game.id === "poa10" ? { ...game, reels: 5 } : game,
      ),
    };
    const fetchMock = createFetchMock();
    fetchMock.mockResolvedValue(jsonResponse({ catalog: invalidCatalog }));
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });

    await expect(client.getCatalog()).rejects.toMatchObject({
      reason: "INVALID_PAYLOAD",
    });
  });

  it("rejects the legacy parity contract for Sapy’aite", async () => {
    const invalidCatalog = {
      ...catalog,
      instant: catalog.instant.map((game) =>
        game.id === "sapyaite"
          ? {
              ...game,
              engine: "PARITY",
              rng: { min: 1, max: 999 },
              selection: { kind: "ENUM", values: ["PAR", "IMPAR"] },
            }
          : game,
      ),
    };
    const fetchMock = createFetchMock();
    fetchMock.mockResolvedValue(jsonResponse({ catalog: invalidCatalog }));
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });

    await expect(client.getCatalog()).rejects.toMatchObject({
      reason: "INVALID_PAYLOAD",
    });
  });

  it("accepts an authoritative exact Sapy’aite result at the 000 boundary", async () => {
    const exactResponse: PlacePlayResponse = {
      ...placePlayResponse,
      play: {
        ...placePlayResponse.play,
        gameId: "sapyaite",
        gameName: "Sapy’aite",
        selection: "000",
        result: "000",
        resultNumbers: ["000"],
        ruleResult: "000",
        matches: null,
      },
      ticket: {
        ...placePlayResponse.ticket,
        gameId: "sapyaite",
        gameName: "Sapy’aite",
        selection: "000",
        result: "000",
        resultNumbers: ["000"],
        ruleResult: "000",
      },
    };
    const fetchMock = createFetchMock();
    fetchMock.mockResolvedValue(jsonResponse(exactResponse));
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });

    await expect(
      client.placeInstantPlay({
        gameId: "sapyaite",
        amount: 500,
        selection: "000",
      }),
    ).resolves.toEqual(exactResponse);
  });

  it("rejects an instant play without its authoritative reel results", async () => {
    const invalidResponse = {
      ...placePlayResponse,
      play: {
        ...placePlayResponse.play,
        status: "PENDING",
        result: null,
        resultNumbers: null,
      },
      ticket: {
        ...placePlayResponse.ticket,
        status: "PENDING",
        result: null,
        resultNumbers: null,
      },
    };
    const fetchMock = createFetchMock();
    fetchMock.mockResolvedValue(jsonResponse(invalidResponse));
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });

    await expect(
      client.placeInstantPlay({
        gameId: "sapyaite",
        amount: 500,
        selection: "007",
      }),
    ).rejects.toMatchObject({ reason: "INVALID_PAYLOAD" });
  });

  it("supports optional wallet and ticket contracts without assuming their paths", async () => {
    const fetchMock = createFetchMock();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("wallet/movements")) {
        return jsonResponse({ movements: [movement], nextCursor: "next" });
      }
      if (url.includes("wallet/top-up")) return jsonResponse(topUpResponse);
      return jsonResponse({ ticket });
    });
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example/v2",
      endpoints: {
        ...endpoints,
        walletMovements: "wallet/movements",
        walletTopUp: "wallet/top-up",
        ticket: "gaming/tickets/{ticketId}",
      },
      fetch: fetchMock,
    });

    await expect(
      client.getMovements({ cursor: "page 2", limit: 10 }),
    ).resolves.toEqual({ movements: [movement], nextCursor: "next" });
    await expect(
      client.topUp(
        { amount: 50_000, method: "CARD" },
        { idempotencyKey: "topup-key" },
      ),
    ).resolves.toEqual(topUpResponse);
    await expect(client.getTicket("ticket / 1")).resolves.toEqual({ ticket });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://backoffice.example/v2/wallet/movements?cursor=page+2&limit=10",
      "https://backoffice.example/v2/wallet/top-up",
      "https://backoffice.example/v2/gaming/tickets/ticket%20%2F%201",
    ]);
    expect(
      new Headers(fetchMock.mock.calls[1][1]?.headers).get("Idempotency-Key"),
    ).toBe("topup-key");
  });

  it("fails locally when an optional capability or ticket template is absent", async () => {
    const fetchMock = createFetchMock();
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });
    await expect(client.getMovements()).rejects.toBeInstanceOf(
      BackofficeCapabilityError,
    );
    await expect(client.topUp({ amount: 500, method: "CARD" })).rejects.toMatchObject({
      endpoint: "walletTopUp",
    });
    await expect(client.getTicket("ticket-1")).rejects.toMatchObject({
      endpoint: "ticket",
    });

    const invalidTemplateClient = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints: { ...endpoints, ticket: "gaming/tickets" },
      fetch: fetchMock,
    });
    await expect(invalidTemplateClient.getTicket("ticket-1")).rejects.toThrow(
      "{ticketId}",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes network failures", async () => {
    const fetchMock = createFetchMock();
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });

    await expect(client.getSession()).rejects.toMatchObject({
      name: "BackofficeNetworkError",
      kind: "NETWORK",
      code: "BACKOFFICE_NETWORK_ERROR",
      method: "GET",
      url: "https://backoffice.example/auth/session",
    } satisfies Partial<BackofficeNetworkError>);
  });

  it("forwards caller cancellation and normalizes it separately from timeout", async () => {
    const fetchMock = createFetchMock();
    let transportSignal: AbortSignal | null | undefined;
    let markTransportStarted: (() => void) | undefined;
    const transportStarted = new Promise<void>((resolve) => {
      markTransportStarted = resolve;
    });
    fetchMock.mockImplementation(async (_input, init) => {
      transportSignal = init?.signal;
      markTransportStarted?.();
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      });
    });
    const controller = new AbortController();
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });

    const result = client.getSession({ signal: controller.signal });
    await transportStarted;
    controller.abort(new DOMException("User navigated", "AbortError"));

    await expect(result).rejects.toMatchObject({
      name: "BackofficeAbortError",
      kind: "ABORT",
      code: "BACKOFFICE_ABORTED",
    } satisfies Partial<BackofficeAbortError>);
    expect(transportSignal?.aborted).toBe(true);
  });

  it("enforces configurable timeout and keeps it distinct from abort", async () => {
    vi.useFakeTimers();
    const fetchMock = createFetchMock();
    fetchMock.mockImplementation(async (_input, init) => {
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      });
    });
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
      timeoutMs: 25,
    });

    const assertion = expect(client.getSession()).rejects.toMatchObject({
      name: "BackofficeTimeoutError",
      kind: "TIMEOUT",
      code: "BACKOFFICE_TIMEOUT",
      timeoutMs: 25,
    } satisfies Partial<BackofficeTimeoutError>);
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });

  it("includes an asynchronous header factory in the request timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = createFetchMock();
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
      headers: () => new Promise<HeadersInit>(() => undefined),
      timeoutMs: 25,
    });

    const assertion = expect(client.getSession()).rejects.toMatchObject({
      name: "BackofficeTimeoutError",
      kind: "TIMEOUT",
      code: "BACKOFFICE_TIMEOUT",
      timeoutMs: 25,
    } satisfies Partial<BackofficeTimeoutError>);
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps timeout classification while reading an HTTP error body", async () => {
    vi.useFakeTimers();
    const fetchMock = createFetchMock();
    fetchMock.mockImplementation(async (_input, init) => {
      const response = new Response(null, { status: 503 });
      vi.spyOn(response, "text").mockImplementation(
        () =>
          new Promise<string>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(init.signal?.reason),
              { once: true },
            );
          }),
      );
      return response;
    });
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
      timeoutMs: 25,
    });

    const assertion = expect(client.getSession()).rejects.toMatchObject({
      name: "BackofficeTimeoutError",
      kind: "TIMEOUT",
      code: "BACKOFFICE_TIMEOUT",
      timeoutMs: 25,
    } satisfies Partial<BackofficeTimeoutError>);
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });

  it("keeps caller abort classification while reading an HTTP error body", async () => {
    const fetchMock = createFetchMock();
    let bodyReadStarted: (() => void) | undefined;
    const readingBody = new Promise<void>((resolve) => {
      bodyReadStarted = resolve;
    });
    fetchMock.mockImplementation(async (_input, init) => {
      const response = new Response(null, { status: 503 });
      vi.spyOn(response, "text").mockImplementation(
        () =>
          new Promise<string>((_resolve, reject) => {
            bodyReadStarted?.();
            init?.signal?.addEventListener(
              "abort",
              () => reject(init.signal?.reason),
              { once: true },
            );
          }),
      );
      return response;
    });
    const controller = new AbortController();
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example",
      endpoints,
      fetch: fetchMock,
    });

    const result = client.getSession({ signal: controller.signal });
    await readingBody;
    controller.abort(new DOMException("User navigated", "AbortError"));

    await expect(result).rejects.toMatchObject({
      name: "BackofficeAbortError",
      kind: "ABORT",
      code: "BACKOFFICE_ABORTED",
    } satisfies Partial<BackofficeAbortError>);
  });

  it("accepts an absolute endpoint and validates timeout configuration", async () => {
    const fetchMock = createFetchMock();
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }));
    const client = createBackofficeClient({
      baseUrl: "https://backoffice.example/v2",
      endpoints: {
        ...endpoints,
        results: "https://results.example/public/latest",
      },
      fetch: fetchMock,
      timeoutMs: 0,
    });

    await client.getResults();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://results.example/public/latest",
    );
    expect(() =>
      createBackofficeClient({ baseUrl: " ", endpoints, fetch: fetchMock }),
    ).toThrow(TypeError);
    expect(() =>
      createBackofficeClient({
        baseUrl: "https://backoffice.example",
        endpoints,
        fetch: fetchMock,
        timeoutMs: -1,
      }),
    ).toThrow("timeoutMs");
  });
});
