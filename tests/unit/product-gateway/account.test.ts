import { describe, expect, it, vi } from "vitest";
import type { AccountSettings } from "@/lib/account/contracts";
import { createPreviewProductGateway, isProductGatewayUnauthorizedError, type ProductGatewayFetch } from "@/lib/product/gateway";

const settings: AccountSettings = {
  sessionId: "account-session",
  scope: "session",
  sessionStartedAt: "2026-08-25T12:00:00.000Z",
  limits: { daily: 1_000, weekly: 2_000, minutes: 60 },
  pausedUntil: null,
  usage: { daily: 500, weekly: 500, minutes: 5 },
};
const session = { id: settings.sessionId, displayName: "Ana López", role: "PLAYER", balance: 250_000, currency: "PYG" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("preview account gateway", () => {
  it("loads validated settings for the expected session with the browser cookie", async () => {
    const fetch = vi.fn<ProductGatewayFetch>().mockResolvedValue(response({ settings }));
    const gateway = createPreviewProductGateway({ fetch });
    await expect(gateway.account!.getSettings({ expectedSessionId: settings.sessionId })).resolves.toEqual(settings);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/mock/account");
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
    expect(init?.credentials ?? "same-origin").toBe("same-origin");
    const headers = new Headers(init?.headers);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("X-Account-Session")).toBe(settings.sessionId);
  });

  it("sends each account mutation to its own route with identity and idempotency headers", async () => {
    const fetch = vi.fn<ProductGatewayFetch>()
      .mockResolvedValueOnce(response({ settings }))
      .mockResolvedValueOnce(response({ settings: { ...settings, pausedUntil: "2026-08-25T12:20:00.000Z" } }))
      .mockResolvedValueOnce(response({ session }));
    const account = createPreviewProductGateway({ fetch }).account!;
    const options = { expectedSessionId: settings.sessionId, idempotencyKey: "account-request-001" };
    await expect(account.saveLimits(settings.limits!, options)).resolves.toEqual(settings);
    await expect(account.pause({ durationMinutes: 15 }, options)).resolves.toMatchObject({ pausedUntil: "2026-08-25T12:20:00.000Z" });
    await expect(account.updateProfile({ displayName: "Ana López" }, options)).resolves.toEqual(session);
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      "/api/mock/account/limits", "/api/mock/account/pause", "/api/mock/account/profile",
    ]);
    expect(fetch.mock.calls.map(([, init]) => JSON.parse(init!.body as string))).toEqual([
      settings.limits, { durationMinutes: 15 }, { displayName: "Ana López" },
    ]);
    for (const [, init] of fetch.mock.calls) {
      expect(init).toMatchObject({ method: "POST", cache: "no-store" });
      expect(init?.credentials ?? "same-origin").toBe("same-origin");
      const headers = new Headers(init?.headers);
      expect(headers.get("X-Account-Session")).toBe(settings.sessionId);
      expect(headers.get("Idempotency-Key")).toBe(options.idempotencyKey);
      expect(headers.get("Content-Type")).toBe("application/json");
    }
  });

  it.each([
    {},
    { settings: { ...settings, scope: "account" } },
    { settings: { ...settings, sessionId: "" } },
    { settings: { ...settings, limits: { daily: 2_000, weekly: 500, minutes: 60 } } },
    { settings: { ...settings, usage: { daily: -1, weekly: 0, minutes: 0 } } },
    { settings: { ...settings, pausedUntil: "tomorrow" } },
  ])("rejects malformed server settings: %j", async (body) => {
    const gateway = createPreviewProductGateway({ fetch: vi.fn(async () => response(body)) });
    await expect(gateway.account!.getSettings()).rejects.toMatchObject({ status: 200, code: "INVALID_GATEWAY_RESPONSE" });
  });

  it.each([[409, "ACCOUNT_SESSION_CHANGED"], [423, "ACCOUNT_PAUSED"]] as const)("keeps account errors separate from expired authentication: %s", async (status, code) => {
    const gateway = createPreviewProductGateway({ fetch: vi.fn(async () => response({ error: { code, message: "No disponible" } }, status)) });
    const error = await gateway.account!.saveLimits(settings.limits!).catch((reason: unknown) => reason);
    expect(error).toMatchObject({ status, code, message: "No disponible" });
    expect(isProductGatewayUnauthorizedError(error)).toBe(false);
  });

  it("propagates caller cancellation for account reads", async () => {
    const controller = new AbortController();
    let transportSignal: AbortSignal | null | undefined;
    const fetch = vi.fn<ProductGatewayFetch>((_input, init) => {
      transportSignal = init?.signal;
      return new Promise<Response>(() => undefined);
    });
    const gateway = createPreviewProductGateway({ fetch });
    const pending = gateway.account!.getSettings({ expectedSessionId: settings.sessionId, signal: controller.signal });
    controller.abort(new DOMException("Closed account panel", "AbortError"));
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(transportSignal?.aborted).toBe(true);
  });
});
