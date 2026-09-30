import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { proxy } from "@/proxy";

it("marks only the countdown as independent and unindexed", () => {
  const response = proxy(new NextRequest("https://quinie.site/contador"));
  expect(response.headers.get("x-middleware-request-x-quinie-contador")).toBe("1");
  expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
});

it.each(["/", "/cuenta", "/ayuda", "/contador-otro"])("does not let a supplied header bypass the layout at %s", (path) => {
  const response = proxy(new NextRequest(`https://quinie.site${path}`, { headers: { "x-quinie-contador": "1" } }));
  expect(response.headers.get("x-middleware-request-x-quinie-contador")).toBe("0");
  expect(response.headers.get("x-middleware-rewrite")).toBe("https://quinie.site/acceso");
  expect(response.headers.get("X-Robots-Tag")).toBeNull();
});
