import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { GamingDomainError, type GamingErrorCode } from "@/lib/gaming/errors";
import { mockGamingProvider } from "@/lib/gaming/server";

export const MOCK_SESSION_COOKIE = "quinie_mock_session";

function shouldUseSecureCookie(): boolean {
  const explicit = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;

  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      return new URL(appUrl).protocol === "https:";
    } catch {
      // Fall through to the production-safe default when APP_URL is malformed.
    }
  }
  return process.env.NODE_ENV === "production";
}

const STATUS_BY_CODE: Record<GamingErrorCode, number> = {
  INVALID_JSON: 400,
  SESSION_REQUIRED: 401,
  SESSION_NOT_FOUND: 401,
  GAME_NOT_FOUND: 404,
  DRAW_NOT_AVAILABLE: 409,
  INSUFFICIENT_BALANCE: 409,
  IDEMPOTENCY_KEY_REQUIRED: 400,
  IDEMPOTENCY_CONFLICT: 409,
  PLAY_NOT_FOUND: 404,
  TICKET_NOT_FOUND: 404,
  INVALID_RESULT: 500,
};

export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new GamingDomainError("INVALID_JSON", "El cuerpo debe ser JSON válido.");
  }
}

export function requireSessionId(request: NextRequest): string {
  const sessionId = request.cookies.get(MOCK_SESSION_COOKIE)?.value;
  if (!sessionId) {
    throw new GamingDomainError("SESSION_REQUIRED", "Ingresá para continuar.");
  }
  return sessionId;
}

export function ensureSession(request: NextRequest): {
  sessionId: string;
  created: boolean;
} {
  const existing = request.cookies.get(MOCK_SESSION_COOKIE)?.value;
  if (existing && mockGamingProvider.hasSession(existing)) {
    return { sessionId: existing, created: false };
  }
  const session = mockGamingProvider.createSession();
  return { sessionId: session.id, created: true };
}

export function requireIdempotencyKey(request: NextRequest): string {
  const key = request.headers.get("Idempotency-Key");
  if (!key) {
    throw new GamingDomainError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key es obligatorio para completar la operación.",
    );
  }
  return key;
}

export function jsonWithSession(
  body: unknown,
  sessionId: string,
  init?: ResponseInit,
): NextResponse {
  const response = NextResponse.json(body, init);
  response.cookies.set(MOCK_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(MOCK_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 0,
  });
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Revisá los datos enviados.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (error instanceof GamingDomainError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      {
        status: STATUS_BY_CODE[error.code],
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "No pudimos completar la operación.",
      },
    },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
