import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { proxy } from "@/proxy";
import { createDevAccessCookieValue, DEV_ACCESS_COOKIE_NAME } from "@/lib/dev-access";

it.each(["/api/health", "/api/mock/bootstrap", "/api/mock/wallet/movements", "/api/registro"])("blocks anonymous API %s", (path) => {
  const response = proxy(new NextRequest(`https://quinie.site${path}`));
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it.each(["/", "/gestion", "/cuenta", "/contador/privado", "/registro", "/_next/image?url=/private.png"])("rewrites anonymous %s without running protected code", (path) => {
  const response = proxy(new NextRequest(`https://quinie.site${path}`, { headers: { RSC: "1", "x-quinie-contador": "1", cookie: `${DEV_ACCESS_COOKIE_NAME}=forged` } }));
  expect(response.headers.get("x-middleware-rewrite")).toBe("https://quinie.site/acceso");
});
it("permits authenticated pages", () => {
  const response = proxy(new NextRequest("https://quinie.site/cuenta", { headers: { cookie: `${DEV_ACCESS_COOKIE_NAME}=${createDevAccessCookieValue()}` } }));
  expect(response.headers.get("x-middleware-next")).toBe("1");
});
it("blocks unauthenticated server actions", () => {
  expect(proxy(new NextRequest("https://quinie.site/cuenta", { method: "POST", headers: { "next-action": "test" } })).status).toBe(401);
});
