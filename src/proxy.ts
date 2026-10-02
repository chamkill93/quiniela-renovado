import { NextResponse, type NextRequest } from "next/server";

import { isMockApiAvailable } from "@/lib/product/mock-api-guard";
import { DEV_ACCESS_COOKIE_NAME, hasValidDevAccessCookie } from "@/lib/dev-access";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("x-quinie-route-surface");
  headers.set("x-quinie-contador", request.nextUrl.pathname === "/contador" ? "1" : "0");
  const path = request.nextUrl.pathname;
  const publicResource = path === "/contador" || path === "/api/dev-access" || path === "/api/contador-version"
    || path.startsWith("/_next/static/") || path.startsWith("/_next/webpack-hmr")
    // Static public artwork is also fetched internally by Next's image optimizer.
    || path.startsWith("/assets/");
  if (!publicResource && !hasValidDevAccessCookie(request.cookies.get(DEV_ACCESS_COOKIE_NAME)?.value)) {
    if (path.startsWith("/api/") || !["GET", "HEAD"].includes(request.method)) {
      return NextResponse.json({ error: { code: "DEV_ACCESS_REQUIRED", message: "Ingresá el código de acceso." } }, {
        status: 401, headers: { "Cache-Control": "private, no-store" },
      });
    }
    const target = request.nextUrl.clone();
    target.pathname = "/acceso";
    target.search = "";
    const response = NextResponse.rewrite(target, { request: { headers } });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  if (!request.nextUrl.pathname.startsWith("/api/mock/")) {
    const response = NextResponse.next({ request: { headers } });
    if (request.nextUrl.pathname === "/contador") {
      response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    return response;
  }
  if (
    isMockApiAvailable({
      nodeEnv: process.env.NODE_ENV,
      gatewayMode: process.env.NEXT_PUBLIC_PRODUCT_GATEWAY_MODE,
    })
  ) {
    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.json(
    { error: { code: "NOT_FOUND", message: "Not Found" } },
    {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export const config = {
  matcher: "/:path*",
};
