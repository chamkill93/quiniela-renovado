import { type NextRequest } from "next/server";

import { mockGamingProvider } from "@/lib/gaming/server";

import { apiError, jsonWithSession, requireSessionId } from "../../_shared/http";

export async function GET(request: NextRequest) {
  try {
    const sessionId = requireSessionId(request);
    return jsonWithSession(
      { movements: mockGamingProvider.listMovements(sessionId) },
      sessionId,
    );
  } catch (error) {
    return apiError(error);
  }
}
