import { NextResponse, type NextRequest } from "next/server";

import { isMockApiAvailable } from "@/lib/product/mock-api-guard";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-quinie-contador", request.nextUrl.pathname === "/contador" ? "1" : "0");
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
  matcher: "/((?!_next/static|_next/image|favicon.ico|assets/).*)",
};
