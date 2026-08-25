import { NextResponse, type NextRequest } from "next/server";

import { mockGamingProvider } from "@/lib/gaming/server";

import { clearSessionCookie, MOCK_SESSION_COOKIE } from "../../_shared/http";

export function POST(request: NextRequest) {
  const sessionId = request.cookies.get(MOCK_SESSION_COOKIE)?.value;
  if (sessionId) mockGamingProvider.deleteSession(sessionId);

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  clearSessionCookie(response);
  return response;
}
