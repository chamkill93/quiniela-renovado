import { type NextRequest } from "next/server";

import { mockGamingProvider } from "@/lib/gaming/server";

import {
  apiError,
  jsonWithSession,
  readJson,
  requireAccountSessionId,
  requireIdempotencyKey,
} from "../_shared/http";

export async function POST(request: NextRequest) {
  try {
    const sessionId = requireAccountSessionId(request);
    const responseBody = mockGamingProvider.placeTraditionalBet(
      sessionId,
      await readJson(request),
      requireIdempotencyKey(request),
    );
    const response = jsonWithSession(responseBody, sessionId);
    response.headers.set("Idempotency-Replayed", String(responseBody.replayed));
    return response;
  } catch (error) {
    return apiError(error);
  }
}
