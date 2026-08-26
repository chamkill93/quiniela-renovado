import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { isMockApiAvailable } from "@/lib/product/mock-api-guard";
import { proxy } from "@/proxy";

describe("mock API access policy", () => {
  it.each([
    {
      label: "explicit preview in production",
      nodeEnv: "production",
      gatewayMode: "preview",
      expected: true,
    },
    {
      label: "explicit backoffice in production",
      nodeEnv: "production",
      gatewayMode: "backoffice",
      expected: false,
    },
    {
      label: "missing mode in production",
      nodeEnv: "production",
      gatewayMode: undefined,
      expected: false,
    },
    {
      label: "missing mode in development",
      nodeEnv: "development",
      gatewayMode: undefined,
      expected: true,
    },
    {
      label: "missing mode in tests",
      nodeEnv: "test",
      gatewayMode: "  ",
      expected: true,
    },
    {
      label: "explicit backoffice in development",
      nodeEnv: "development",
      gatewayMode: "backoffice",
      expected: false,
    },
    {
      label: "invalid explicit mode",
      nodeEnv: "development",
      gatewayMode: "unknown",
      expected: false,
    },
  ])("resolves $label", ({ nodeEnv, gatewayMode, expected }) => {
    expect(isMockApiAvailable({ nodeEnv, gatewayMode })).toBe(expected);
  });
});

describe("mock API proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a non-cacheable 404 in backoffice mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_PRODUCT_GATEWAY_MODE", "backoffice");

    const response = proxy(
      new NextRequest("https://quinie.example/api/mock/bootstrap"),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Not Found" },
    });
  });

  it("continues to the preview handler only in explicit production preview", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_PRODUCT_GATEWAY_MODE", " PREVIEW ");

    const response = proxy(
      new NextRequest("https://quinie.example/api/mock/results"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
