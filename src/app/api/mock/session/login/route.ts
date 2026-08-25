import { type NextRequest } from "next/server";

import { mockLoginRequestSchema } from "@/lib/gaming/schemas";
import { mockGamingProvider } from "@/lib/gaming/server";

import {
  apiError,
  jsonWithSession,
  MOCK_SESSION_COOKIE,
  readJson,
} from "../../_shared/http";

export async function POST(request: NextRequest) {
  try {
    const input = mockLoginRequestSchema.parse(await readJson(request));
    const previousSessionId = request.cookies.get(MOCK_SESSION_COOKIE)?.value;
    if (previousSessionId) mockGamingProvider.deleteSession(previousSessionId);

    const isAdmin = input.documentOrPhone.toLowerCase() === "admin";
    const session = mockGamingProvider.createSession({
      displayName: isAdmin ? "Administrador" : "Jugador",
      role: isAdmin ? "ADMIN" : "PLAYER",
    });
    return jsonWithSession({ session }, session.id);
  } catch (error) {
    return apiError(error);
  }
}
