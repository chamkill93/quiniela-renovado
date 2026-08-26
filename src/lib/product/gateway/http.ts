import type { BackofficeHeadersFactory } from "@/lib/backoffice";

export type ProductGatewayFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class ProductGatewayHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ProductGatewayHttpError";
    this.status = status;
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function errorDetails(value: unknown) {
  const root = asRecord(value);
  const nested = asRecord(root?.error);
  const source = nested ?? root;
  return {
    code: typeof source?.code === "string" ? source.code : undefined,
    message: typeof source?.message === "string" ? source.message : undefined,
  };
}

export function resolveProductEndpoint(baseUrl: string, endpoint: string) {
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(endpoint)) return endpoint;
  if (!baseUrl.trim()) return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
}

export async function resolveProductHeaders(
  configured?: HeadersInit | BackofficeHeadersFactory,
) {
  return typeof configured === "function" ? configured() : configured;
}

export async function readProductJson<T>(
  response: Response,
  parser: (value: unknown) => T,
): Promise<T> {
  const rawBody = await response.text();
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : undefined;
  } catch {
    throw new ProductGatewayHttpError(
      response.status,
      "INVALID_GATEWAY_RESPONSE",
      "El servicio devolvió una respuesta inválida.",
    );
  }

  if (!response.ok) {
    const details = errorDetails(body);
    throw new ProductGatewayHttpError(
      response.status,
      details.code ?? `GATEWAY_HTTP_${response.status}`,
      details.message ?? response.statusText ?? "No pudimos completar la operación.",
    );
  }

  try {
    return parser(body);
  } catch (reason) {
    if (reason instanceof ProductGatewayHttpError) throw reason;
    throw new ProductGatewayHttpError(
      response.status,
      "INVALID_GATEWAY_RESPONSE",
      "El servicio devolvió datos incompatibles con el contrato del frontend.",
    );
  }
}

export function createProductIdempotencyKey() {
  return globalThis.crypto.randomUUID();
}

export function isProductGatewayUnauthorizedError(reason: unknown) {
  if (reason === null || typeof reason !== "object") return false;
  const error = reason as { status?: unknown; code?: unknown };
  return (
    error.status === 401 ||
    error.status === 419 ||
    error.status === 440 ||
    error.code === "SESSION_EXPIRED"
  );
}
