import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGamingCatalog } from "@/lib/gaming";
import { DRAW_POSTURE_COUNT } from "@/lib/gaming/types";
import {
  createPreviewProductGateway,
  createProductIdempotencyKey,
  DEFAULT_PREVIEW_PRODUCT_TIMEOUT_MS,
  isProductGatewayUnauthorizedError,
  ProductGatewayHttpError,
  type ProductGatewayFetch,
  type ProductTopUpResponse,
} from "@/lib/product/gateway";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const catalog = buildGamingCatalog(
  "REFUND",
  new Date("2026-08-25T12:00:00.000Z"),
);

const ticketFixture = {
  id: "ticket / 1",
  code: "QL-TICKET1",
  playId: "play-1",
  gameId: "sapyaite",
  gameName: "Sapy’aite",
  family: "INSTANT",
  selection: "007",
  drawId: null,
  amount: 500,
  currency: "PYG",
  status: "LOST",
  result: "497",
  resultNumbers: ["497"],
  ruleResult: "497",
  prize: 0,
  issuedAt: "2026-08-25T12:00:00.000Z",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PreviewProductGateway", () => {
  it("uses cryptographic random bytes when UUID generation is unavailable over local HTTP", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.forEach((_, index) => { bytes[index] = index; });
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(createProductIdempotencyKey()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("prefers the browser UUID implementation when it is available", () => {
    const randomUUID = vi.fn(() => "12345678-1234-4123-8123-123456789abc");
    const getRandomValues = vi.fn();
    vi.stubGlobal("crypto", { randomUUID, getRandomValues });

    expect(createProductIdempotencyKey()).toBe("12345678-1234-4123-8123-123456789abc");
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it("fails safely when the browser has no cryptographic source", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => createProductIdempotencyKey()).toThrow("referencia segura");
  });

  it.each(["CARD", "QR", "CASH_POINT", "TIGO", "CLARO", "PERSONAL"] as const)(
    "transports deposits and withdrawals through %s with distinct endpoints and idempotency keys",
    async (method) => {
      const deposit: ProductTopUpResponse = {
        session: { id: "wallet-user", displayName: "Ana", role: "PLAYER", balance: 70_000, currency: "PYG" },
        balanceEntry: {
          id: "deposit-1", type: "TOPUP", amount: 20_000, currency: "PYG", balanceAfter: 70_000,
          referenceId: "DEP-1", method, createdAt: "2026-08-27T12:00:00.000Z",
        },
        replayed: false,
      };
      const withdrawal: ProductTopUpResponse = {
        session: { ...deposit.session, balance: 50_000 },
        balanceEntry: { ...deposit.balanceEntry, id: "withdrawal-1", type: "WITHDRAWAL", amount: -20_000, balanceAfter: 50_000, referenceId: "RET-1" },
        replayed: false,
      };
      const fetchMock = vi.fn<ProductGatewayFetch>()
        .mockResolvedValueOnce(jsonResponse(deposit))
        .mockResolvedValueOnce(jsonResponse(withdrawal));
      const gateway = createPreviewProductGateway({ fetch: fetchMock });
      const input = { amount: 20_000, method };

      await expect(gateway.topUp(input, { idempotencyKey: "deposit-key", expectedSessionId: "wallet-user" })).resolves.toEqual(deposit);
      await expect(gateway.withdraw(input, { idempotencyKey: "withdrawal-key", expectedSessionId: "wallet-user" })).resolves.toEqual(withdrawal);

      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
        "/api/mock/wallet/topup", "/api/mock/wallet/withdrawal",
      ]);
      expect(fetchMock.mock.calls.map(([, init]) => new Headers(init?.headers).get("Idempotency-Key")))
        .toEqual(["deposit-key", "withdrawal-key"]);
      for (const [, init] of fetchMock.mock.calls) {
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).get("X-Account-Session")).toBe("wallet-user");
        expect(JSON.parse(String(init?.body))).toEqual(input);
      }
    },
  );

  it("rejects a malformed successful withdrawal before it reaches product state", async () => {
    const gateway = createPreviewProductGateway({
      fetch: vi.fn(async () => jsonResponse({
        session: { id: "wallet-user", displayName: "Ana", role: "PLAYER", balance: 30_000, currency: "PYG" },
        balanceEntry: { id: "withdrawal-1", type: "WITHDRAWAL", amount: 20_000, currency: "PYG", balanceAfter: 30_000, referenceId: "RET-1", method: "QR", createdAt: "2026-08-27T12:00:00.000Z" },
        replayed: false,
      })),
    });
    await expect(gateway.withdraw({ amount: 20_000, method: "QR" })).rejects.toMatchObject({ code: "INVALID_GATEWAY_RESPONSE" });
  });

  it("adapts the existing preview routes behind product operations", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/bootstrap")) {
        return jsonResponse({
          session: {
            id: "preview-session",
            displayName: "Preview",
            role: "PLAYER",
            balance: 250_000,
            currency: "PYG",
          },
          catalog,
          plays: [],
          results: [],
        });
      }
      if (url.endsWith("/results")) return jsonResponse({ results: [] });
      if (url.endsWith("/movements")) return jsonResponse({ movements: [] });
      throw new Error(`Unexpected preview request: ${url}`);
    });
    const gateway = createPreviewProductGateway({ fetch: fetchMock });

    await expect(gateway.bootstrap()).resolves.toMatchObject({
      session: { id: "preview-session" },
      catalog,
      plays: [],
      results: [],
    });
    await expect(gateway.getResults()).resolves.toEqual([]);
    await expect(gateway.getMovements()).resolves.toEqual([]);

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "/api/mock/bootstrap",
      "/api/mock/results",
      "/api/mock/wallet/movements",
    ]);
  });

  it("preserves explicit draw positions through bootstrap and refresh without inferring legacy positions", async () => {
    const legacyResult = {
      id: "legacy-draw",
      source: "DRAW",
      gameId: "prizes",
      gameName: "A los Premios",
      drawId: "early",
      result: "325",
      resultNumbers: ["325"],
      occurredAt: "2026-08-25T12:00:00.000Z",
    };
    const drawNumbers = [{ position: DRAW_POSTURE_COUNT, value: "007" }, { position: 1, value: "497" }];
    const positionedResult = { ...legacyResult, id: "positioned-draw", drawNumbers };
    const results = [positionedResult, legacyResult];
    const gateway = createPreviewProductGateway({
      fetch: vi.fn(async (input) => jsonResponse(String(input).endsWith("/bootstrap") ? {
        session: { id: "preview-session", displayName: "Preview", role: "PLAYER", balance: 250_000, currency: "PYG" },
        catalog,
        plays: [],
        results,
      } : { results })),
    });

    const snapshot = await gateway.bootstrap();
    const refreshed = await gateway.getResults();
    expect(snapshot.results).toEqual(results);
    expect(refreshed).toEqual(results);
    expect(snapshot.results[1]).not.toHaveProperty("drawNumbers");
    snapshot.results[0].drawNumbers![0].value = "changed-by-consumer";
    expect(drawNumbers[0].value).toBe("007");
    expect(refreshed[0].drawNumbers?.[0].value).toBe("007");
  });

  it("establishes a server session on registration without claiming persistent identity", async () => {
    const fetchMock = vi.fn<ProductGatewayFetch>(async () => jsonResponse({ session: { id: "registered-session", displayName: "Ana Preview", role: "PLAYER", balance: 250_000, currency: "PYG" } }));
    const gateway = createPreviewProductGateway({ fetch: fetchMock });
    const input = {
      displayName: "Ana Preview",
      documentOrPhone: "1234567",
      password: "secure-password",
      acceptedTerms: true,
    };

    const first = await gateway.register(input);
    expect(first).toMatchObject({
      source: "preview-session",
      session: {
        id: "registered-session",
        displayName: "Ana Preview",
      },
    });
    expect(gateway.capabilities.persistentRegistration).toBe(false);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mock/session/register");
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual(input);
  });

  it("maps typed play commands to preview transport routes", async () => {
    const responseBody = {
      play: {
        id: "play-1",
        ticketId: "ticket-1",
        family: "INSTANT",
        gameId: "sapyaite",
        gameName: "Sapy’aite",
        selection: "007",
        drawId: null,
        amount: 500,
        currency: "PYG",
        prize: 0,
        status: "LOST",
        result: "497",
        resultNumbers: ["497"],
        ruleResult: "497",
        matches: null,
        payoutMultiplier: 0,
        createdAt: "2026-08-25T12:00:00.000Z",
      },
      ticket: {
        id: "ticket-1",
        code: "QL-TICKET1",
        playId: "play-1",
        gameId: "sapyaite",
        gameName: "Sapy’aite",
        family: "INSTANT",
        selection: "007",
        drawId: null,
        amount: 500,
        currency: "PYG",
        status: "LOST",
        result: "497",
        resultNumbers: ["497"],
        ruleResult: "497",
        prize: 0,
        issuedAt: "2026-08-25T12:00:00.000Z",
      },
      session: { balance: 249_500, currency: "PYG" },
      replayed: false,
    };
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return jsonResponse(responseBody);
      },
    );
    const gateway = createPreviewProductGateway({ fetch: fetchMock });

    await expect(
      gateway.requestPlay(
        {
          kind: "instant",
          input: { gameId: "sapyaite", amount: 500, selection: "007" },
        },
        { idempotencyKey: "instant-key-001", expectedSessionId: "preview-session" },
      ),
    ).resolves.toEqual(responseBody);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/mock/instant");
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(
      "instant-key-001",
    );
    expect(new Headers(init?.headers).get("X-Account-Session")).toBe("preview-session");
    expect(init?.body).toBe(
      JSON.stringify({ gameId: "sapyaite", amount: 500, selection: "007" }),
    );
  });

  it("loads an authoritative ticket through the existing encoded preview route", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return jsonResponse({ ticket: ticketFixture });
      },
    );
    const gateway = createPreviewProductGateway({ fetch: fetchMock });

    await expect(gateway.getTicket("ticket / 1")).resolves.toMatchObject({
      id: "ticket / 1",
      code: "QL-TICKET1",
      playId: "play-1",
      resultNumbers: ["497"],
      createdAt: ticketFixture.issuedAt,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/mock/tickets/ticket%20%2F%201");
    expect(init?.method).toBe("GET");
  });

  it("rejects an invalid ticket template before issuing a request", async () => {
    const fetchMock = vi.fn();
    const gateway = createPreviewProductGateway({
      endpoints: { ticket: "/api/mock/tickets" },
      fetch: fetchMock,
    });

    await expect(gateway.getTicket("ticket-1")).rejects.toThrow("{ticketId}");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes HTTP failures and recognizes expired sessions", async () => {
    const gateway = createPreviewProductGateway({
      fetch: vi.fn(async () =>
        jsonResponse(
          { error: { code: "SESSION_EXPIRED", message: "Sesión vencida" } },
          401,
        ),
      ),
    });

    const error = await gateway.bootstrap().catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ProductGatewayHttpError);
    expect(isProductGatewayUnauthorizedError(error)).toBe(true);
    expect(isProductGatewayUnauthorizedError({ code: "SESSION_EXPIRED" })).toBe(
      true,
    );
    expect(isProductGatewayUnauthorizedError({ status: 419 })).toBe(true);
    expect(isProductGatewayUnauthorizedError({ status: 440 })).toBe(true);
    expect(isProductGatewayUnauthorizedError({ status: 500 })).toBe(false);
  });

  it("normalizes preview network failures without leaking fetch details", async () => {
    const gateway = createPreviewProductGateway({
      fetch: vi.fn(async () => {
        throw new TypeError("socket detail");
      }),
    });

    await expect(gateway.bootstrap()).rejects.toMatchObject({
      status: 0,
      code: "GATEWAY_NETWORK_ERROR",
      message: "No se pudo conectar con el servicio. Intentá nuevamente.",
    });
  });

  it("applies the 15 second bootstrap deadline even when fetch ignores AbortSignal", async () => {
    vi.useFakeTimers();
    let transportSignal: AbortSignal | null | undefined;
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) => {
        transportSignal = init?.signal;
        return new Promise<Response>(() => undefined);
      },
    );
    const gateway = createPreviewProductGateway({ fetch: fetchMock });

    const assertion = expect(gateway.bootstrap()).rejects.toMatchObject({
      name: "ProductGatewayHttpError",
      status: 0,
      code: "GATEWAY_TIMEOUT",
      message: "El servicio no respondió a tiempo. Intentá nuevamente.",
    });

    await vi.advanceTimersByTimeAsync(DEFAULT_PREVIEW_PRODUCT_TIMEOUT_MS - 1);
    expect(transportSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(transportSignal?.aborted).toBe(true);
  });

  it("times out a stuck mutation and leaves the gateway ready for the next request", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<ProductGatewayFetch>()
      .mockImplementationOnce(
        () => new Promise<Response>(() => undefined),
      )
      .mockImplementationOnce(async () => jsonResponse({ results: [] }));
    const gateway = createPreviewProductGateway({
      fetch: fetchMock,
      timeoutMs: 25,
    });
    const command = {
      kind: "instant" as const,
      input: { gameId: "sapyaite", amount: 500, selection: "007" },
    } as const;

    const timeoutAssertion = expect(
      gateway.requestPlay(command),
    ).rejects.toMatchObject({
      status: 0,
      code: "GATEWAY_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(25);
    await timeoutAssertion;

    await expect(gateway.getResults()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("composes caller cancellation and settles even when fetch ignores it", async () => {
    let transportSignal: AbortSignal | null | undefined;
    let transportStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      transportStarted = resolve;
    });
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) => {
        transportSignal = init?.signal;
        transportStarted();
        return new Promise<Response>(() => undefined);
      },
    );
    const controller = new AbortController();
    const gateway = createPreviewProductGateway({ fetch: fetchMock });

    const pending = gateway.bootstrap({ signal: controller.signal });
    await started;
    controller.abort(new DOMException("User navigated", "AbortError"));

    await expect(pending).rejects.toMatchObject({
      name: "AbortError",
      message: "User navigated",
    });
    expect(transportSignal?.aborted).toBe(true);
  });

  it("rejects a successful HTTP response that violates the shared contract", async () => {
    const gateway = createPreviewProductGateway({
      fetch: vi.fn(async () => jsonResponse({})),
    });

    await expect(
      gateway.requestPlay({
        kind: "instant",
        input: { gameId: "sapyaite", amount: 500, selection: "007" },
      }),
    ).rejects.toMatchObject({
      status: 200,
      code: "INVALID_GATEWAY_RESPONSE",
    });
  });
});
