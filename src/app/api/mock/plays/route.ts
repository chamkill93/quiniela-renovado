import { type NextRequest } from "next/server";

import { mockGamingProvider } from "@/lib/gaming/server";

import { apiError, jsonWithSession, requireSessionId } from "../_shared/http";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  try {
    const sessionId = requireSessionId(request);
    return jsonWithSession(
      { plays: mockGamingProvider.listPlays(sessionId) },
      sessionId,
    );
  } catch (error) {
    return apiError(error);
  }
}
