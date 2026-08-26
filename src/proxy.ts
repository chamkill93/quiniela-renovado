import { NextResponse, type NextRequest } from "next/server";

import { isMockApiAvailable } from "@/lib/product/mock-api-guard";

export function proxy(request: NextRequest) {
  void request;
  if (
    isMockApiAvailable({
      nodeEnv: process.env.NODE_ENV,
      gatewayMode: process.env.NEXT_PUBLIC_PRODUCT_GATEWAY_MODE,
    })
  ) {
    return NextResponse.next();
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
  matcher: "/api/mock/:path*",
};
