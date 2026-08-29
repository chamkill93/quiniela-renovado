import { NextRequest, NextResponse } from "next/server";

import {
  createDevAccessCookieValue,
  DEV_ACCESS_COOKIE_NAME,
  isValidDevAccessCode,
} from "@/lib/dev-access";

export const runtime = "nodejs";

function jsonResponse(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: "Ingresá un código de acceso válido." }, 400);
  }

  const code =
    body && typeof body === "object" && "code" in body
      ? (body as { code?: unknown }).code
      : undefined;

  if (!isValidDevAccessCode(code)) {
    return jsonResponse({ message: "El código no es correcto. Volvé a intentarlo." }, 401);
  }

  const response = jsonResponse({ ok: true }, 200);
  response.cookies.set({
    name: DEV_ACCESS_COOKIE_NAME,
    value: createDevAccessCookieValue(),
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}
