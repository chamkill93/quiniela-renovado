import type { NextRequest } from "next/server";
import { mockGamingProvider } from "@/lib/gaming/server";
import { apiError, jsonWithSession, requireAccountSessionId } from "../_shared/http";

export function GET(request: NextRequest) {
  try {
    const sessionId = requireAccountSessionId(request);
    return jsonWithSession({ settings: mockGamingProvider.getAccountSettings(sessionId) }, sessionId);
  } catch (error) { return apiError(error); }
}
