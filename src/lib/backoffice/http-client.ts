import { ZodError } from "zod";

import type {
  AuthenticationResponse,
  BackofficeApiError,
  BackofficeClient,
  BackofficeEndpoints,
  BackofficeMutationOptions,
  BackofficeRequestOptions,
  BootstrapResponse,
  CatalogResponse,
  LoginRequest,
  PlaceInstantPlayRequest,
  PlacePlayResult,
  PlaceTraditionalPlayRequest,
  PlaysQuery,
  PlaysResponse,
  RegisterUserRequest,
  ResultsQuery,
  ResultsResponse,
  SessionResponse,
  TicketResponse,
  WalletMovementsQuery,
  WalletMovementsResponse,
  WalletTopUpRequest,
  WalletTopUpResponse,
} from "./contracts";
import {
  backofficeResponseParsers,
  type BackofficeResponseParser,
} from "./validation";

export type BackofficeFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type BackofficeHeadersFactory = () =>
  | HeadersInit
  | Promise<HeadersInit>;

export interface HttpBackofficeClientConfig {
  /** Absolute external URL or a same-origin base path. */
  baseUrl: string;
  /** Environment-specific paths; no local API route is assumed. */
  endpoints: Readonly<BackofficeEndpoints>;
  /** Static headers or a lazy factory for short-lived auth/CSRF values. */
  headers?: HeadersInit | BackofficeHeadersFactory;
  /** Injectable for tests, React Native or a custom observability wrapper. */
  fetch?: BackofficeFetch;
  /** Default request timeout in milliseconds. `0` disables it. */
  timeoutMs?: number;
}

interface RequestDescriptor<T> {
  method: "GET" | "POST";
  path: string;
  parser: BackofficeResponseParser<T>;
  body?: unknown;
  options?: BackofficeRequestOptions;
  idempotencyKey?: string;
  allowEmpty?: boolean;
}

export type BackofficeFailureKind =
  | "HTTP"
  | "NETWORK"
  | "TIMEOUT"
  | "ABORT"
  | "PROTOCOL";

export class BackofficeHttpError extends Error {
  readonly kind = "HTTP" as const;
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;
  readonly method: string;
  readonly url: string;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
    method: string;
    url: string;
  }) {
    super(input.message);
    this.name = "BackofficeHttpError";
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
    this.requestId = input.requestId;
    this.method = input.method;
    this.url = input.url;
  }
}

export type BackofficeProtocolFailureReason =
  | "INVALID_JSON"
  | "INVALID_PAYLOAD"
  | "EMPTY_PAYLOAD";

export class BackofficeProtocolError extends Error {
  readonly kind = "PROTOCOL" as const;
  readonly code = "INVALID_BACKOFFICE_RESPONSE";
  readonly status: number;
  readonly requestId?: string;
  readonly method: string;
  readonly url: string;
  readonly reason: BackofficeProtocolFailureReason;
  readonly details?: unknown;

  constructor(input: {
    status: number;
    requestId?: string;
    method: string;
    url: string;
    reason: BackofficeProtocolFailureReason;
    details?: unknown;
    cause?: unknown;
  }) {
    const messages: Record<BackofficeProtocolFailureReason, string> = {
      INVALID_JSON: "El backoffice devolvió una respuesta que no es JSON válido.",
      INVALID_PAYLOAD:
        "El backoffice devolvió datos incompatibles con el contrato del frontend.",
      EMPTY_PAYLOAD: "El backoffice devolvió una respuesta vacía inesperada.",
    };
    super(messages[input.reason], { cause: input.cause });
    this.name = "BackofficeProtocolError";
    this.status = input.status;
    this.requestId = input.requestId;
    this.method = input.method;
    this.url = input.url;
    this.reason = input.reason;
    this.details = input.details;
  }
}

abstract class BackofficeTransportError extends Error {
  abstract readonly kind: "NETWORK" | "TIMEOUT" | "ABORT";
  abstract readonly code: string;
  readonly method: string;
  readonly url: string;

  protected constructor(
    message: string,
    input: { method: string; url: string; cause?: unknown },
  ) {
    super(message, { cause: input.cause });
    this.method = input.method;
    this.url = input.url;
  }
}

export class BackofficeNetworkError extends BackofficeTransportError {
  readonly kind = "NETWORK" as const;
  readonly code = "BACKOFFICE_NETWORK_ERROR";

  constructor(input: { method: string; url: string; cause?: unknown }) {
    super("No se pudo conectar con el backoffice.", input);
    this.name = "BackofficeNetworkError";
  }
}

export class BackofficeTimeoutError extends BackofficeTransportError {
  readonly kind = "TIMEOUT" as const;
  readonly code = "BACKOFFICE_TIMEOUT";
  readonly timeoutMs: number;

  constructor(input: {
    method: string;
    url: string;
    timeoutMs: number;
    cause?: unknown;
  }) {
    super(`El backoffice no respondió dentro de ${input.timeoutMs} ms.`, input);
    this.name = "BackofficeTimeoutError";
    this.timeoutMs = input.timeoutMs;
  }
}

export class BackofficeAbortError extends BackofficeTransportError {
  readonly kind = "ABORT" as const;
  readonly code = "BACKOFFICE_ABORTED";

  constructor(input: { method: string; url: string; cause?: unknown }) {
    super("La solicitud al backoffice fue cancelada.", input);
    this.name = "BackofficeAbortError";
  }
}

export class BackofficeCapabilityError extends Error {
  readonly code = "BACKOFFICE_CAPABILITY_NOT_CONFIGURED";
  readonly endpoint: keyof BackofficeEndpoints;

  constructor(endpoint: keyof BackofficeEndpoints) {
    super(
      `La capacidad '${endpoint}' no está configurada para este backoffice.`,
    );
    this.name = "BackofficeCapabilityError";
    this.endpoint = endpoint;
  }
}

function isAbsoluteUrl(value: string) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value);
}

function resolveEndpoint(baseUrl: string, endpoint: string) {
  if (isAbsoluteUrl(endpoint)) return endpoint;
  return `${baseUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
}

function withSearchParams(
  url: string,
  values: Readonly<Record<string, string | number | undefined>>,
) {
  const parameters = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) parameters.set(key, String(value));
  });
  const query = parameters.toString();
  if (!query) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function parseErrorShape(value: unknown): Partial<BackofficeApiError> {
  const root = asRecord(value);
  if (!root) return {};

  const nested = asRecord(root.error);
  const source = nested ?? root;
  return {
    code: typeof source.code === "string" ? source.code : undefined,
    message:
      typeof source.message === "string"
        ? source.message
        : typeof root.error === "string"
          ? root.error
          : undefined,
    details: source.details ?? source.issues,
    issues: source.issues,
  };
}

function responseRequestId(response: Response) {
  return (
    response.headers.get("x-request-id") ??
    response.headers.get("x-correlation-id") ??
    undefined
  );
}

function fallbackHttpCode(status: number) {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 419 || status === 440) return "SESSION_EXPIRED";
  if (status === 403) return "FORBIDDEN";
  return `BACKOFFICE_HTTP_${status}`;
}

async function toHttpError(
  response: Response,
  method: string,
  url: string,
) {
  // Body reads remain part of the transport. If they are aborted or time out,
  // let the outer request classifier preserve that distinction.
  const rawBody = await response.text();
  let parsedBody: unknown;
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : undefined;
  } catch {
    parsedBody = undefined;
  }

  const payload = parseErrorShape(parsedBody);
  return new BackofficeHttpError({
    status: response.status,
    code: payload.code ?? fallbackHttpCode(response.status),
    message:
      payload.message ||
      rawBody.trim() ||
      response.statusText ||
      `Error HTTP ${response.status} del backoffice.`,
    details: payload.details ?? payload.issues,
    requestId: responseRequestId(response),
    method,
    url,
  });
}

function validatedTimeout(value: number | undefined, label: string) {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} debe ser un número finito mayor o igual a 0.`);
  }
  return value;
}

interface ComposedSignal {
  signal: AbortSignal;
  timedOut: () => boolean;
  cleanup: () => void;
}

function composeSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): ComposedSignal {
  const controller = new AbortController();
  let timeoutReached = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  if (timeoutMs > 0 && !controller.signal.aborted) {
    timeoutHandle = setTimeout(() => {
      timeoutReached = true;
      controller.abort(new DOMException("Backoffice timeout", "TimeoutError"));
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    timedOut: () => timeoutReached,
    cleanup: () => {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

function awaitWithSignal<T>(promise: Promise<T>, signal: AbortSignal) {
  if (signal.aborted) {
    return Promise.reject(
      signal.reason ?? new DOMException("Backoffice request aborted", "AbortError"),
    );
  }

  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      reject(
        signal.reason ??
          new DOMException("Backoffice request aborted", "AbortError"),
      );
    };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (reason) => {
        signal.removeEventListener("abort", abort);
        reject(reason);
      },
    );
  });
}

function isKnownBackofficeError(error: unknown) {
  return (
    error instanceof BackofficeHttpError ||
    error instanceof BackofficeProtocolError ||
    error instanceof BackofficeNetworkError ||
    error instanceof BackofficeTimeoutError ||
    error instanceof BackofficeAbortError ||
    error instanceof BackofficeCapabilityError
  );
}

function validationDetails(error: unknown) {
  return error instanceof ZodError ? error.issues : undefined;
}

function ticketPath(template: string, ticketId: string) {
  if (!ticketId.trim()) throw new TypeError("ticketId no puede estar vacío.");
  if (!template.includes("{ticketId}")) {
    throw new TypeError(
      "El endpoint ticket debe incluir la plantilla literal '{ticketId}'.",
    );
  }
  return template.replaceAll("{ticketId}", encodeURIComponent(ticketId));
}

export class HttpBackofficeClient implements BackofficeClient {
  private readonly baseUrl: string;
  private readonly endpoints: Readonly<BackofficeEndpoints>;
  private readonly configuredHeaders?: HeadersInit | BackofficeHeadersFactory;
  private readonly fetcher: BackofficeFetch;
  private readonly timeoutMs: number;

  constructor(config: HttpBackofficeClientConfig) {
    if (!config.baseUrl.trim()) {
      throw new TypeError("HttpBackofficeClient requiere un baseUrl.");
    }

    this.baseUrl = config.baseUrl;
    this.endpoints = { ...config.endpoints };
    this.configuredHeaders = config.headers;
    this.fetcher = config.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs =
      validatedTimeout(config.timeoutMs, "timeoutMs") ?? 15_000;
  }

  getSession(options?: BackofficeRequestOptions) {
    return this.request<SessionResponse>({
      method: "GET",
      path: this.endpoints.session,
      parser: backofficeResponseParsers.session,
      options,
    });
  }

  bootstrap(options?: BackofficeRequestOptions) {
    return this.request<BootstrapResponse>({
      method: "GET",
      path: this.requireEndpoint("bootstrap"),
      parser: backofficeResponseParsers.bootstrap,
      options,
    });
  }

  login(input: LoginRequest, options?: BackofficeRequestOptions) {
    return this.request<AuthenticationResponse>({
      method: "POST",
      path: this.endpoints.login,
      parser: backofficeResponseParsers.authentication,
      body: input,
      options,
    });
  }

  register(input: RegisterUserRequest, options?: BackofficeRequestOptions) {
    return this.request<AuthenticationResponse>({
      method: "POST",
      path: this.endpoints.register,
      parser: backofficeResponseParsers.authentication,
      body: input,
      options,
    });
  }

  async logout(options?: BackofficeRequestOptions) {
    await this.request<void>({
      method: "POST",
      path: this.endpoints.logout,
      parser: () => undefined,
      options,
      allowEmpty: true,
    });
  }

  getCatalog(options?: BackofficeRequestOptions) {
    return this.request<CatalogResponse>({
      method: "GET",
      path: this.endpoints.catalog,
      parser: backofficeResponseParsers.catalog,
      options,
    });
  }

  getPlays(query: PlaysQuery = {}, options?: BackofficeRequestOptions) {
    const path = withSearchParams(this.endpoints.plays, {
      family: query.family,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
    return this.request<PlaysResponse>({
      method: "GET",
      path,
      parser: backofficeResponseParsers.plays,
      options,
    });
  }

  placeTraditionalPlay(
    input: PlaceTraditionalPlayRequest,
    options?: BackofficeMutationOptions,
  ) {
    return this.request<PlacePlayResult>({
      method: "POST",
      path: this.endpoints.traditionalPlays,
      parser: backofficeResponseParsers.placeTraditionalPlay,
      body: input,
      options,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  placeInstantPlay(
    input: PlaceInstantPlayRequest,
    options?: BackofficeMutationOptions,
  ) {
    return this.request<PlacePlayResult>({
      method: "POST",
      path: this.endpoints.instantPlays,
      parser: backofficeResponseParsers.placeInstantPlay,
      body: input,
      options,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  getResults(query: ResultsQuery = {}, options?: BackofficeRequestOptions) {
    const path = withSearchParams(this.endpoints.results, {
      gameId: query.gameId,
      drawId: query.drawId,
      source: query.source,
      cursor: query.cursor,
      limit: query.limit,
    });
    return this.request<ResultsResponse>({
      method: "GET",
      path,
      parser: backofficeResponseParsers.results,
      options,
    });
  }

  async getMovements(
    query: WalletMovementsQuery = {},
    options?: BackofficeRequestOptions,
  ) {
    const path = withSearchParams(this.requireEndpoint("walletMovements"), {
      cursor: query.cursor,
      limit: query.limit,
    });
    return await this.request<WalletMovementsResponse>({
      method: "GET",
      path,
      parser: backofficeResponseParsers.walletMovements,
      options,
    });
  }

  async topUp(
    input: WalletTopUpRequest,
    options?: BackofficeMutationOptions,
  ) {
    return await this.request<WalletTopUpResponse>({
      method: "POST",
      path: this.requireEndpoint("walletTopUp"),
      parser: backofficeResponseParsers.walletTopUp,
      body: input,
      options,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  async getTicket(ticketId: string, options?: BackofficeRequestOptions) {
    const path = ticketPath(this.requireEndpoint("ticket"), ticketId);
    return await this.request<TicketResponse>({
      method: "GET",
      path,
      parser: backofficeResponseParsers.ticket,
      options,
    });
  }

  private requireEndpoint(
    endpoint: "bootstrap" | "walletMovements" | "walletTopUp" | "ticket",
  ) {
    const value = this.endpoints[endpoint];
    if (!value?.trim()) throw new BackofficeCapabilityError(endpoint);
    return value;
  }

  private async request<T>(descriptor: RequestDescriptor<T>): Promise<T> {
    const url = resolveEndpoint(this.baseUrl, descriptor.path);
    const requestTimeout =
      validatedTimeout(descriptor.options?.timeoutMs, "options.timeoutMs") ??
      this.timeoutMs;
    const composed = composeSignal(descriptor.options?.signal, requestTimeout);

    try {
      const headers = await awaitWithSignal(
        this.buildHeaders(
          descriptor.body !== undefined,
          descriptor.options?.headers,
          descriptor.idempotencyKey,
        ),
        composed.signal,
      );
      if (composed.signal.aborted) {
        throw composed.signal.reason ??
          new DOMException("Backoffice request aborted", "AbortError");
      }
      const response = await this.fetcher(url, {
        method: descriptor.method,
        headers,
        body:
          descriptor.body === undefined
            ? undefined
            : JSON.stringify(descriptor.body),
        cache: "no-store",
        credentials: "include",
        signal: composed.signal,
      });

      if (!response.ok) {
        throw await toHttpError(response, descriptor.method, url);
      }

      const rawBody = await response.text();
      if (!rawBody) {
        if (descriptor.allowEmpty) return descriptor.parser(undefined);
        throw new BackofficeProtocolError({
          status: response.status,
          requestId: responseRequestId(response),
          method: descriptor.method,
          url,
          reason: "EMPTY_PAYLOAD",
        });
      }

      let value: unknown;
      try {
        value = JSON.parse(rawBody);
      } catch (cause) {
        throw new BackofficeProtocolError({
          status: response.status,
          requestId: responseRequestId(response),
          method: descriptor.method,
          url,
          reason: "INVALID_JSON",
          cause,
        });
      }

      try {
        return descriptor.parser(value);
      } catch (cause) {
        throw new BackofficeProtocolError({
          status: response.status,
          requestId: responseRequestId(response),
          method: descriptor.method,
          url,
          reason: "INVALID_PAYLOAD",
          details: validationDetails(cause),
          cause,
        });
      }
    } catch (cause) {
      if (isKnownBackofficeError(cause)) throw cause;
      if (composed.timedOut()) {
        throw new BackofficeTimeoutError({
          method: descriptor.method,
          url,
          timeoutMs: requestTimeout,
          cause,
        });
      }
      if (descriptor.options?.signal?.aborted || composed.signal.aborted) {
        throw new BackofficeAbortError({
          method: descriptor.method,
          url,
          cause,
        });
      }
      throw new BackofficeNetworkError({
        method: descriptor.method,
        url,
        cause,
      });
    } finally {
      composed.cleanup();
    }
  }

  private async buildHeaders(
    hasBody: boolean,
    requestHeaders?: HeadersInit,
    idempotencyKey?: string,
  ) {
    const headers = new Headers({ Accept: "application/json" });
    const configuredHeaders =
      typeof this.configuredHeaders === "function"
        ? await this.configuredHeaders()
        : this.configuredHeaders;

    new Headers(configuredHeaders).forEach((value, key) => {
      headers.set(key, value);
    });
    new Headers(requestHeaders).forEach((value, key) => {
      headers.set(key, value);
    });

    if (hasBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
    return headers;
  }
}

export function createBackofficeClient(config: HttpBackofficeClientConfig) {
  return new HttpBackofficeClient(config);
}
