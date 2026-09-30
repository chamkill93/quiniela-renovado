import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";

import { POST } from "@/app/api/dev-access/route";
import {
  createDevAccessCookieValue,
  DEFAULT_DEV_ACCESS_CODE,
  DEV_ACCESS_COOKIE_NAME,
  hasValidDevAccessCookie,
  isDevAccessRequired,
  isValidDevAccessCode,
} from "@/lib/dev-access";

function accessRequest(body: string) {
  return new NextRequest("https://quinie.example/api/dev-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

beforeEach(() => {
  delete process.env.DEV_ACCESS_REQUIRED;
  delete process.env.DEV_ACCESS_CODE;
  delete process.env.DEV_ACCESS_COOKIE_SECRET;
});

afterEach(() => {
  delete process.env.DEV_ACCESS_REQUIRED;
  delete process.env.DEV_ACCESS_CODE;
  delete process.env.DEV_ACCESS_COOKIE_SECRET;
});

describe("DEV access", () => {
  it("rejects old deployment cookies and migrates the old default password", () => {
    process.env.DEV_ACCESS_CODE = "Admin123#";
    process.env.DEV_ACCESS_COOKIE_SECRET = "independent-secret";
    const oldToken = createHmac("sha256", "independent-secret").update("quinie-dev-access:v1").digest("base64url");
    expect(hasValidDevAccessCookie(oldToken)).toBe(false);
    expect(isValidDevAccessCode("Admin123#")).toBe(false);
    expect(isValidDevAccessCode("admin123#")).toBe(true);
    const currentToken = createDevAccessCookieValue();
    process.env.DEV_ACCESS_CODE = "rotated-password";
    expect(hasValidDevAccessCookie(currentToken)).toBe(false);
  });
  it("keeps the gate mandatory even with an obsolete deployment flag", () => {
    expect(isDevAccessRequired()).toBe(true);

    process.env.DEV_ACCESS_REQUIRED = "FALSE";
    expect(isDevAccessRequired()).toBe(true);

    process.env.DEV_ACCESS_REQUIRED = "false";
    expect(isDevAccessRequired()).toBe(true);
  });

  it("keeps login available with an obsolete public-site flag", async () => {
    process.env.DEV_ACCESS_REQUIRED = "false";

    const response = await POST(
      accessRequest(JSON.stringify({ code: DEFAULT_DEV_ACCESS_CODE })),
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get(DEV_ACCESS_COOKIE_NAME)).toBeDefined();
  });

  it("uses the requested default code and compares it exactly", () => {
    expect(isValidDevAccessCode(DEFAULT_DEV_ACCESS_CODE)).toBe(true);
    expect(isValidDevAccessCode("Admin123#")).toBe(false);
    expect(isValidDevAccessCode(`${DEFAULT_DEV_ACCESS_CODE} `)).toBe(false);
  });

  it("creates a verifiable cookie token without exposing the code", () => {
    const token = createDevAccessCookieValue();

    expect(token).not.toContain(DEFAULT_DEV_ACCESS_CODE);
    expect(hasValidDevAccessCookie(token)).toBe(true);
    expect(hasValidDevAccessCookie("forged-token")).toBe(false);
  });

  it("rejects an incorrect code without setting a cookie", async () => {
    const response = await POST(accessRequest(JSON.stringify({ code: "incorrecto" })));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      message: "El código no es correcto. Volvé a intentarlo.",
    });
    expect(response.cookies.get(DEV_ACCESS_COOKIE_NAME)).toBeUndefined();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("accepts the new code and stores an HttpOnly session cookie", async () => {
    const response = await POST(
      accessRequest(JSON.stringify({ code: DEFAULT_DEV_ACCESS_CODE })),
    );
    const cookie = response.cookies.get(DEV_ACCESS_COOKIE_NAME);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(cookie).toMatchObject({
      name: DEV_ACCESS_COOKIE_NAME,
      httpOnly: true,
      path: "/",
      sameSite: "strict",
    });
    expect(hasValidDevAccessCookie(cookie?.value)).toBe(true);
  });

  it("returns a safe validation message for malformed JSON", async () => {
    const response = await POST(accessRequest("{"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: "Ingresá un código de acceso válido.",
    });
  });
});
