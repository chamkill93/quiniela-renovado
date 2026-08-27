import type { NextRequest } from "next/server";
import { mockGamingProvider } from "@/lib/gaming/server";
import { apiError, jsonWithSession, readJson, requireIdempotencyKey, requireAccountSessionId } from "../../_shared/http";

export async function POST(request: NextRequest) {
  try {
    const sessionId = requireAccountSessionId(request);
    const response = mockGamingProvider.saveAccountLimits(sessionId, await readJson(request), requireIdempotencyKey(request));
    return jsonWithSession(response, sessionId);
  } catch (error) { return apiError(error); }
}
