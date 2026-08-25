import { type NextRequest } from "next/server";

import { mockGamingProvider } from "@/lib/gaming/server";

import { apiError, jsonWithSession, requireSessionId } from "../../_shared/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  try {
    const sessionId = requireSessionId(request);
    const { ticketId } = await context.params;
    return jsonWithSession(
      { ticket: mockGamingProvider.getTicket(sessionId, ticketId) },
      sessionId,
    );
  } catch (error) {
    return apiError(error);
  }
}
