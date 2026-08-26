import { describe, expect, it, vi } from "vitest";
import { buildGamingCatalog } from "@/lib/gaming";
import {
  createPreviewProductGateway,
  isProductGatewayUnauthorizedError,
  ProductGatewayHttpError,
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
  selection: "PAR",
  drawId: null,
  amount: 500,
  currency: "PYG",
  status: "LOST",
  result: "497",
  resultNumbers: ["497"],
  ruleResult: "ODD",
  prize: 0,
  issuedAt: "2026-08-25T12:00:00.000Z",
};

describe("PreviewProductGateway", () => {
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

  it("keeps preview registration deterministic and explicitly non-persistent", async () => {
    const fetchMock = vi.fn();
    const gateway = createPreviewProductGateway({ fetch: fetchMock });
    const input = {
      displayName: "Ana Preview",
      documentOrPhone: "1234567",
      password: "not-forwarded",
      acceptedTerms: true,
    };

    const first = await gateway.register(input);
    const second = await gateway.register(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      source: "preview-fixture",
      session: {
        id: "preview-registration-fixture",
        displayName: "Ana Preview",
      },
    });
    expect(gateway.capabilities.persistentRegistration).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps typed play commands to preview transport routes", async () => {
    const responseBody = {
      play: {
        id: "play-1",
        ticketId: "ticket-1",
        family: "INSTANT",
        gameId: "sapyaite",
        gameName: "Sapy’aite",
        selection: "PAR",
        drawId: null,
        amount: 500,
        currency: "PYG",
        prize: 0,
        status: "LOST",
        result: "497",
        resultNumbers: ["497"],
        ruleResult: "ODD",
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
        selection: "PAR",
        drawId: null,
        amount: 500,
        currency: "PYG",
        status: "LOST",
        result: "497",
        resultNumbers: ["497"],
        ruleResult: "ODD",
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
          input: { gameId: "sapyaite", amount: 500, selection: "PAR" },
        },
        { idempotencyKey: "instant-key-001" },
      ),
    ).resolves.toEqual(responseBody);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/mock/instant");
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(
      "instant-key-001",
    );
    expect(init?.body).toBe(
      JSON.stringify({ gameId: "sapyaite", amount: 500, selection: "PAR" }),
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
      message: "No se pudo conectar con el servicio de vista previa.",
    });
  });

  it("rejects a successful HTTP response that violates the shared contract", async () => {
    const gateway = createPreviewProductGateway({
      fetch: vi.fn(async () => jsonResponse({})),
    });

    await expect(
      gateway.requestPlay({
        kind: "instant",
        input: { gameId: "sapyaite", amount: 500, selection: "PAR" },
      }),
    ).rejects.toMatchObject({
      status: 200,
      code: "INVALID_GATEWAY_RESPONSE",
    });
  });
});
