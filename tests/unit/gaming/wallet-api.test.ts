import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_SESSION_COOKIE } from "@/app/api/mock/_shared/http";
import { GET as getMovements } from "@/app/api/mock/wallet/movements/route";
import { POST as topUp } from "@/app/api/mock/wallet/topup/route";
import { POST as withdraw } from "@/app/api/mock/wallet/withdrawal/route";
import { backofficeResponseParsers } from "@/lib/backoffice/validation";
import { mockGamingProvider } from "@/lib/gaming/server";
import type { MockSessionView } from "@/lib/gaming/types";

vi.mock("@/lib/gaming/server", async () => {
  const { MockGamingProvider } = await import("@/lib/gaming/mock-provider");
  return {
    mockGamingProvider: new MockGamingProvider({
      now: () => new Date("2026-08-27T12:00:00.000Z"),
    }),
  };
});

const routes = [
  { path: "topup", handler: topUp, providerMethod: "topUp", type: "TOPUP", sign: 1, parser: backofficeResponseParsers.walletTopUp },
  { path: "withdrawal", handler: withdraw, providerMethod: "withdraw", type: "WITHDRAWAL", sign: -1, parser: backofficeResponseParsers.walletWithdrawal },
] as const;
type WalletRoute = (typeof routes)[number];
let session: MockSessionView;

function request(
  route: WalletRoute,
  {
    cookieSession = session.id,
    expectedSession = cookieSession,
    key = "wallet-api-operation",
    body = { amount: 50_000, method: "QR" },
    rawBody,
  }: {
    cookieSession?: string | null;
    expectedSession?: string | null;
    key?: string | null;
    body?: unknown;
    rawBody?: string;
  } = {},
) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (cookieSession !== null) headers.set("Cookie", MOCK_SESSION_COOKIE + "=" + cookieSession);
  if (expectedSession !== null) headers.set("X-Account-Session", expectedSession);
  if (key !== null) headers.set("Idempotency-Key", key);
  return new NextRequest("https://quinie.example/api/mock/wallet/" + route.path, {
    method: "POST", headers, body: rawBody ?? JSON.stringify(body),
  });
}

async function expectApiError(response: NextResponse, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.cookies.get(MOCK_SESSION_COOKIE)).toBeUndefined();
  expect(await response.json()).toMatchObject({ error: { code } });
}

beforeEach(() => {
  vi.stubEnv("SESSION_COOKIE_SECURE", "true");
  session = mockGamingProvider.createSession({ displayName: "Ana" });
});

afterEach(() => {
  mockGamingProvider.deleteSession(session.id);
  vi.unstubAllEnvs();
});

describe.each(routes)("wallet API /$path", (route) => {
  it("requires an authenticated live session without creating a replacement", async () => {
    await expectApiError(await route.handler(request(route, { cookieSession: null })), 401, "SESSION_REQUIRED");
    await expectApiError(await route.handler(request(route, { cookieSession: "expired-session" })), 401, "SESSION_NOT_FOUND");
    expect(mockGamingProvider.listMovements(session.id)).toEqual([]);
    expect(mockGamingProvider.hasSession("expired-session")).toBe(false);
  });

  it("requires a valid idempotency key and valid JSON without modifying the balance", async () => {
    await expectApiError(await route.handler(request(route, { key: null })), 400, "IDEMPOTENCY_KEY_REQUIRED");
    await expectApiError(await route.handler(request(route, { key: "bad" })), 400, "VALIDATION_ERROR");
    await expectApiError(await route.handler(request(route, { rawBody: "{" })), 400, "INVALID_JSON");
    expect(mockGamingProvider.getSession(session.id)).toEqual(session);
    expect(mockGamingProvider.listMovements(session.id)).toEqual([]);
  });

  it("rejects a missing or stale displayed session before modifying either wallet", async () => {
    const other = mockGamingProvider.createSession({ displayName: "Otra cuenta" });
    try {
      await expectApiError(await route.handler(request(route, { expectedSession: null })), 409, "ACCOUNT_SESSION_CHANGED");
      await expectApiError(await route.handler(request(route, {
        cookieSession: other.id, expectedSession: session.id,
      })), 409, "ACCOUNT_SESSION_CHANGED");
      expect(mockGamingProvider.getSession(session.id)).toEqual(session);
      expect(mockGamingProvider.getSession(other.id)).toEqual(other);
      expect(mockGamingProvider.listMovements(session.id)).toEqual([]);
      expect(mockGamingProvider.listMovements(other.id)).toEqual([]);
    } finally {
      mockGamingProvider.deleteSession(other.id);
    }
  });

  it.each([
    { amount: 9_999, method: "CARD" },
    { amount: 5_000_001, method: "CARD" },
    { amount: 50_000.5, method: "QR" },
    { amount: "50000", method: "QR" },
    { amount: 50_000, method: "UNSUPPORTED" },
    { amount: 50_000, method: "CARD", cardNumber: "not-collected" },
    { amount: 50_000, method: "TIGO", phone: "not-collected" },
  ])("rejects an invalid command without storing it: %j", async (body) => {
    await expectApiError(await route.handler(request(route, { body })), 400, "VALIDATION_ERROR");
    expect(mockGamingProvider.getSession(session.id)).toEqual(session);
    expect(mockGamingProvider.listMovements(session.id)).toEqual([]);
  });

  it("returns one authoritative movement and a safe cookie on an idempotent retry", async () => {
    const first = await route.handler(request(route));
    const replay = await route.handler(request(route));
    const firstBody = route.parser(await first.json());
    const replayBody = route.parser(await replay.json());

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(firstBody).toMatchObject({
      session: { id: session.id, balance: session.balance + route.sign * 50_000 },
      balanceEntry: { type: route.type, amount: route.sign * 50_000, method: "QR" },
      replayed: false,
    });
    expect(replayBody).toEqual({ ...firstBody, replayed: true });
    expect(first.headers.get("Idempotency-Replayed")).toBe("false");
    expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
    expect(replay.headers.get("Cache-Control")).toBe("no-store");
    expect(replay.cookies.get(MOCK_SESSION_COOKIE)).toMatchObject({
      value: session.id, httpOnly: true, sameSite: "lax", secure: true, path: "/",
    });
    expect(mockGamingProvider.listMovements(session.id)).toEqual([firstBody.balanceEntry]);
    expect(mockGamingProvider.getSession(session.id)).toEqual(firstBody.session);
  });

  it("rejects changed amounts or channels under an existing idempotency key", async () => {
    await route.handler(request(route));
    for (const body of [{ amount: 60_000, method: "QR" }, { amount: 50_000, method: "TIGO" }]) {
      await expectApiError(await route.handler(request(route, { body })), 409, "IDEMPOTENCY_CONFLICT");
    }
    expect(mockGamingProvider.listMovements(session.id)).toHaveLength(1);
    expect(mockGamingProvider.getSession(session.id).balance).toBe(session.balance + route.sign * 50_000);
  });

  it("does not expose internal failures", async () => {
    vi.spyOn(mockGamingProvider, route.providerMethod).mockImplementation(() => {
      throw new Error("internal payment-provider details");
    });
    const response = await route.handler(request(route));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "No pudimos completar la operación." },
    });
    expect(mockGamingProvider.getSession(session.id)).toEqual(session);
  });
});

describe("wallet history and withdrawal safeguards", () => {
  it("requires a session for history and returns only that session's movements", async () => {
    const anonymous = await getMovements(new NextRequest("https://quinie.example/api/mock/wallet/movements"));
    await expectApiError(anonymous, 401, "SESSION_REQUIRED");
    const historyRequest = new NextRequest("https://quinie.example/api/mock/wallet/movements", {
      headers: { Cookie: MOCK_SESSION_COOKIE + "=" + session.id },
    });
    expect(await (await getMovements(historyRequest)).json()).toEqual({ movements: [] });

    const deposit = mockGamingProvider.topUp(session.id, { amount: 10_000, method: "CLARO" }, "history-deposit");
    const withdrawal = mockGamingProvider.withdraw(session.id, { amount: 20_000, method: "PERSONAL" }, "history-withdrawal");
    const result = await getMovements(historyRequest);
    expect(backofficeResponseParsers.walletMovements(await result.json()).movements)
      .toEqual([withdrawal.balanceEntry, deposit.balanceEntry]);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
  });

  it("never overdraws when two withdrawal requests arrive together", async () => {
    const responses = await Promise.all([
      withdraw(request(routes[1], { key: "concurrent-withdrawal-a", body: { amount: 150_000, method: "QR" } })),
      withdraw(request(routes[1], { key: "concurrent-withdrawal-b", body: { amount: 150_000, method: "CASH_POINT" } })),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const rejected = responses.find((response) => response.status === 409)!;
    await expectApiError(rejected, 409, "INSUFFICIENT_BALANCE");
    expect(mockGamingProvider.getSession(session.id).balance).toBe(100_000);
    expect(mockGamingProvider.listMovements(session.id)).toHaveLength(1);
  });

  it("rejects mismatched response balances, incorrect signs and absent channels", () => {
    const response = mockGamingProvider.withdraw(session.id, { amount: 20_000, method: "QR" }, "validate-withdrawal");
    expect(() => backofficeResponseParsers.walletWithdrawal({
      ...response, session: { ...response.session, balance: response.session.balance + 1 },
    })).toThrow();
    expect(() => backofficeResponseParsers.walletWithdrawal({
      ...response, balanceEntry: { ...response.balanceEntry, amount: 20_000 },
    })).toThrow();
    for (const change of [{ amount: 20_000 }, { method: null }]) {
      expect(() => backofficeResponseParsers.walletMovements({
        movements: [{ ...response.balanceEntry, ...change }],
      })).toThrow();
    }
  });
});
