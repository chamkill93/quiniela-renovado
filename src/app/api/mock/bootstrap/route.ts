import { type NextRequest } from "next/server";

import { mockGamingProvider } from "@/lib/gaming/server";

import { apiError, ensureSession, jsonWithSession } from "../_shared/http";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  try {
    const { sessionId } = ensureSession(request);
    return jsonWithSession(mockGamingProvider.getBootstrap(sessionId), sessionId);
  } catch (error) {
    return apiError(error);
  }
}
