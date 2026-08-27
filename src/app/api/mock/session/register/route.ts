import { z } from "zod";
import type { NextRequest } from "next/server";
import { accountProfileSchema } from "@/lib/account/contracts";
import { mockLoginRequestSchema } from "@/lib/gaming/schemas";
import { mockGamingProvider } from "@/lib/gaming/server";
import { apiError, jsonWithSession, MOCK_SESSION_COOKIE, readJson } from "../../_shared/http";

const registerSchema = mockLoginRequestSchema.extend({
  displayName: accountProfileSchema.shape.displayName,
  acceptedTerms: z.literal(true),
});

export async function POST(request: NextRequest) {
  try {
    const input = registerSchema.parse(await readJson(request));
    const previousSession = request.cookies.get(MOCK_SESSION_COOKIE)?.value;
    if (previousSession) mockGamingProvider.deleteSession(previousSession);
    // Establish a server session; credentials are not retained by this local service.
    const session = mockGamingProvider.createSession({ displayName: input.displayName });
    return jsonWithSession({ session }, session.id);
  } catch (error) { return apiError(error); }
}
