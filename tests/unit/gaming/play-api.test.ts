import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_SESSION_COOKIE } from "@/app/api/mock/_shared/http";
import { POST as instantPlay } from "@/app/api/mock/instant/route";
import { POST as traditionalPlay } from "@/app/api/mock/traditional/route";
import { backofficeResponseParsers } from "@/lib/backoffice/validation";
import { mockGamingProvider } from "@/lib/gaming/server";
import type { MockSessionView } from "@/lib/gaming/types";

const randomSource = vi.hoisted(() => ({ intInclusive: vi.fn(() => 456) }));

vi.mock("@/lib/gaming/server", async () => {
  const { MockGamingProvider } = await import("@/lib/gaming/mock-provider");
  return {
    mockGamingProvider: new MockGamingProvider({
      now: () => new Date("2026-08-27T12:00:00.000Z"),
      randomSource,
    }),
  };
});

const routes = [
  {
    path: "traditional",
    handler: traditionalPlay,
    providerMethod: "placeTraditionalBet",
    body: { gameId: "head", amount: 500, drawId: "early", selection: { number: "123" } },
    parser: backofficeResponseParsers.placeTraditionalPlay,
  },
  {
    path: "instant",
    handler: instantPlay,
    providerMethod: "placeInstantBet",
    body: { gameId: "sapyaite", amount: 500, selection: "123" },
    parser: backofficeResponseParsers.placeInstantPlay,
  },
] as const;
type PlayRoute = (typeof routes)[number];
let session: MockSessionView;

function request(
  route: PlayRoute,
  {
    cookieSession = session.id,
    expectedSession = cookieSession,
    key = "play-api-operation",
    rawBody,
  }: {
    cookieSession?: string | null;
    expectedSession?: string | null;
    key?: string | null;
    rawBody?: string;
  } = {},
) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (cookieSession !== null) headers.set("Cookie", `${MOCK_SESSION_COOKIE}=${cookieSession}`);
  if (expectedSession !== null) headers.set("X-Account-Session", expectedSession);
  if (key !== null) headers.set("Idempotency-Key", key);
  return new NextRequest(`https://quinie.example/api/mock/${route.path}`, {
    method: "POST", headers, body: rawBody ?? JSON.stringify(route.body),
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
  session = mockGamingProvider.createSession({ displayName: "Cuenta A" });
});

afterEach(() => {
  mockGamingProvider.deleteSession(session.id);
  vi.unstubAllEnvs();
});

describe.each(routes)("play API /$path", (route) => {
  it("requires a live session without creating a replacement", async () => {
    await expectApiError(await route.handler(request(route, { cookieSession: null })), 401, "SESSION_REQUIRED");
    await expectApiError(await route.handler(request(route, { cookieSession: "expired-session" })), 401, "SESSION_NOT_FOUND");
    expect(mockGamingProvider.getSession(session.id)).toEqual(session);
    expect(mockGamingProvider.listPlays(session.id)).toEqual([]);
    expect(mockGamingProvider.listMovements(session.id)).toEqual([]);
    expect(mockGamingProvider.hasSession("expired-session")).toBe(false);
  });

  it.each([null, "previous-session"])("checks the displayed session %s before reading JSON or calling the game provider", async (expectedSession) => {
    const mutation = vi.spyOn(mockGamingProvider, route.providerMethod);
    const incoming = request(route, { expectedSession, rawBody: "{invalid JSON" });
    const readBody = vi.spyOn(incoming, "json");

    await expectApiError(await route.handler(incoming), 409, "ACCOUNT_SESSION_CHANGED");

    expect(readBody).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
    expect(randomSource.intInclusive).not.toHaveBeenCalled();
    expect(mockGamingProvider.getSession(session.id)).toEqual(session);
    expect(mockGamingProvider.listPlays(session.id)).toEqual([]);
    expect(mockGamingProvider.listMovements(session.id)).toEqual([]);
  });

  it("rejects a tab showing A after the cookie changes to B without charging or playing in either account", async () => {
    const other = mockGamingProvider.createSession({ displayName: "Cuenta B" });
    const mutation = vi.spyOn(mockGamingProvider, route.providerMethod);
    try {
      await expectApiError(await route.handler(request(route, {
        cookieSession: other.id,
        expectedSession: session.id,
      })), 409, "ACCOUNT_SESSION_CHANGED");

      expect(mutation).not.toHaveBeenCalled();
      expect(randomSource.intInclusive).not.toHaveBeenCalled();
      for (const unchanged of [session, other]) {
        expect(mockGamingProvider.getSession(unchanged.id)).toEqual(unchanged);
        expect(mockGamingProvider.listPlays(unchanged.id)).toEqual([]);
        expect(mockGamingProvider.listMovements(unchanged.id)).toEqual([]);
      }

      // The rejection must not consume the key: B may submit only after refreshing its displayed session.
      const accepted = await route.handler(request(route, { cookieSession: other.id }));
      expect(accepted.status).toBe(200);
      const body = route.parser(await accepted.json());
      expect(body.replayed).toBe(false);
      expect(mockGamingProvider.getSession(other.id).balance).toBe(other.balance - route.body.amount);
      expect(mockGamingProvider.listPlays(other.id)).toHaveLength(1);
      expect(mockGamingProvider.getSession(session.id)).toEqual(session);
    } finally {
      mockGamingProvider.deleteSession(other.id);
    }
  });

  it("retains validation and idempotency safeguards for the matching session", async () => {
    await expectApiError(await route.handler(request(route, { key: null })), 400, "IDEMPOTENCY_KEY_REQUIRED");
    await expectApiError(await route.handler(request(route, { rawBody: "{" })), 400, "INVALID_JSON");
    expect(mockGamingProvider.getSession(session.id)).toEqual(session);
    expect(mockGamingProvider.listPlays(session.id)).toEqual([]);

    const first = await route.handler(request(route));
    const replay = await route.handler(request(route));
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    const firstBody = route.parser(await first.json());
    expect(route.parser(await replay.json())).toEqual({ ...firstBody, replayed: true });
    expect(firstBody.replayed).toBe(false);
    expect(first.headers.get("Idempotency-Replayed")).toBe("false");
    expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
    expect(replay.headers.get("Cache-Control")).toBe("no-store");
    expect(replay.cookies.get(MOCK_SESSION_COOKIE)).toMatchObject({
      value: session.id, httpOnly: true, sameSite: "lax", secure: true, path: "/",
    });
    expect(mockGamingProvider.listPlays(session.id)).toHaveLength(1);
    expect(mockGamingProvider.listMovements(session.id)).toHaveLength(1);
    expect(mockGamingProvider.getSession(session.id).balance).toBe(session.balance - route.body.amount);
  });
});

describe("traditional stake limits", () => {
  it.each(["head", "prizes", "invert", "redoblona"])("rejects a stake above 10,000 for %s without debiting", async (gameId) => {
    const selection = gameId === "redoblona"
      ? { initialNumber: "35", initialUntil: 1, redoblonaNumber: "45", redoblonaUntil: 7 }
      : { number: "123", ...(gameId === "head" ? {} : { position: 2 }) };
    for (const amount of [10_500, 20_000, 50_000]) {
      await expectApiError(await traditionalPlay(request(routes[0], {
        rawBody: JSON.stringify({ gameId, drawId: "early", amount, selection }),
      })), 400, "VALIDATION_ERROR");
    }
    expect(mockGamingProvider.getSession(session.id)).toEqual(session);
    expect(mockGamingProvider.listPlays(session.id)).toEqual([]);
    expect(mockGamingProvider.listMovements(session.id)).toEqual([]);
  });

  it("accepts chip sums, caps each play instead of the draw's lifetime total, and keeps retries idempotent", async () => {
    const summedRequest = { ...routes[0].body, amount: 1_500 };
    const submit = (body: Omit<typeof summedRequest, "drawId"> & { drawId: string }, key: string) => traditionalPlay(request(routes[0], { rawBody: JSON.stringify(body), key }));
    const first = await submit(summedRequest, "summed-stake");
    expect(first.status).toBe(200);
    const receipt = backofficeResponseParsers.placeTraditionalPlay(await first.json());
    expect(receipt.play.amount).toBe(1_500);
    const replay = await submit(summedRequest, "summed-stake");
    expect(backofficeResponseParsers.placeTraditionalPlay(await replay.json())).toEqual({ ...receipt, replayed: true });

    for (const drawId of ["early", "morning", "evening", "night", "early"]) {
      const index = mockGamingProvider.listPlays(session.id).length;
      const response = await submit({ ...summedRequest, amount: 10_000, drawId }, "separate-play-" + index);
      expect(response.status).toBe(200);
      expect(backofficeResponseParsers.placeTraditionalPlay(await response.json()).replayed).toBe(false);
    }
    const plays = mockGamingProvider.listPlays(session.id);
    expect(plays).toHaveLength(6);
    expect(new Set(plays.map((play) => play.id)).size).toBe(6);
    expect(mockGamingProvider.listMovements(session.id)).toHaveLength(6);
    expect(mockGamingProvider.getSession(session.id).balance).toBe(session.balance - 51_500);
  });
});
