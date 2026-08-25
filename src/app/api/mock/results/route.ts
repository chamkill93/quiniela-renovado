import { type NextRequest } from "next/server";

import { mockGamingProvider } from "@/lib/gaming/server";

import { apiError, jsonWithSession, requireSessionId } from "../_shared/http";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  try {
    const sessionId = requireSessionId(request);
    return jsonWithSession(
      { results: mockGamingProvider.listResults(sessionId) },
      sessionId,
    );
  } catch (error) {
    return apiError(error);
  }
}
