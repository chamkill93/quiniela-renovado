import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

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
  it("keeps the gate enabled unless the deployment explicitly publishes the site", () => {
    expect(isDevAccessRequired()).toBe(true);

    process.env.DEV_ACCESS_REQUIRED = "FALSE";
    expect(isDevAccessRequired()).toBe(true);

    process.env.DEV_ACCESS_REQUIRED = "false";
    expect(isDevAccessRequired()).toBe(false);
  });

  it("closes the DEV access endpoint when the site is public", async () => {
    process.env.DEV_ACCESS_REQUIRED = "false";

    const response = await POST(
      accessRequest(JSON.stringify({ code: DEFAULT_DEV_ACCESS_CODE })),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: "No encontrado." });
    expect(response.cookies.get(DEV_ACCESS_COOKIE_NAME)).toBeUndefined();
  });

  it("uses the requested default code and compares it exactly", () => {
    expect(isValidDevAccessCode(DEFAULT_DEV_ACCESS_CODE)).toBe(true);
    expect(isValidDevAccessCode("admin123#")).toBe(false);
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

  it("accepts Admin123# and stores an HttpOnly session cookie", async () => {
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
