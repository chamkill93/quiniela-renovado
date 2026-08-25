import type {
  AuthenticationResponse,
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
} from "./contracts";

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
}

interface BackofficeErrorShape {
  code?: string;
  message?: string;
  details?: unknown;
  issues?: unknown;
}

interface RequestDescriptor {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  options?: BackofficeRequestOptions;
  idempotencyKey?: string;
}

export class BackofficeHttpError extends Error {
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

export class BackofficeProtocolError extends Error {
  readonly code = "INVALID_BACKOFFICE_RESPONSE";
  readonly status: number;
  readonly requestId?: string;
  readonly url: string;

  constructor(input: {
    status: number;
    requestId?: string;
    url: string;
    cause?: unknown;
  }) {
    super("El backoffice devolvió una respuesta que no es JSON válido.", {
      cause: input.cause,
    });
    this.name = "BackofficeProtocolError";
    this.status = input.status;
    this.requestId = input.requestId;
    this.url = input.url;
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

function parseErrorShape(value: unknown): BackofficeErrorShape {
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

async function toHttpError(
  response: Response,
  method: string,
  url: string,
) {
  const rawBody = await response.text().catch(() => "");
  let parsedBody: unknown;
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : undefined;
  } catch {
    parsedBody = undefined;
  }

  const payload = parseErrorShape(parsedBody);
  const requestId =
    response.headers.get("x-request-id") ??
    response.headers.get("x-correlation-id") ??
    undefined;

  return new BackofficeHttpError({
    status: response.status,
    code: payload.code ?? `BACKOFFICE_HTTP_${response.status}`,
    message:
      payload.message ||
      rawBody.trim() ||
      response.statusText ||
      `Error HTTP ${response.status} del backoffice.`,
    details: payload.details ?? payload.issues,
    requestId,
    method,
    url,
  });
}

export class HttpBackofficeClient implements BackofficeClient {
  private readonly baseUrl: string;
  private readonly endpoints: Readonly<BackofficeEndpoints>;
  private readonly configuredHeaders?: HeadersInit | BackofficeHeadersFactory;
  private readonly fetcher: BackofficeFetch;

  constructor(config: HttpBackofficeClientConfig) {
    if (!config.baseUrl.trim()) {
      throw new TypeError("HttpBackofficeClient requiere un baseUrl.");
    }

    this.baseUrl = config.baseUrl;
    this.endpoints = { ...config.endpoints };
    this.configuredHeaders = config.headers;
    this.fetcher = config.fetch ?? ((input, init) => fetch(input, init));
  }

  getSession(options?: BackofficeRequestOptions) {
    return this.request<SessionResponse>({
      method: "GET",
      path: this.endpoints.session,
      options,
    });
  }

  bootstrap(options?: BackofficeRequestOptions) {
    return this.request<BootstrapResponse>({
      method: "GET",
      path: this.endpoints.bootstrap,
      options,
    });
  }

  login(input: LoginRequest, options?: BackofficeRequestOptions) {
    return this.request<AuthenticationResponse>({
      method: "POST",
      path: this.endpoints.login,
      body: input,
      options,
    });
  }

  register(input: RegisterUserRequest, options?: BackofficeRequestOptions) {
    return this.request<AuthenticationResponse>({
      method: "POST",
      path: this.endpoints.register,
      body: input,
      options,
    });
  }

  async logout(options?: BackofficeRequestOptions) {
    await this.request<unknown>({
      method: "POST",
      path: this.endpoints.logout,
      options,
    });
  }

  getCatalog(options?: BackofficeRequestOptions) {
    return this.request<CatalogResponse>({
      method: "GET",
      path: this.endpoints.catalog,
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
    return this.request<PlaysResponse>({ method: "GET", path, options });
  }

  placeTraditionalPlay(
    input: PlaceTraditionalPlayRequest,
    options?: BackofficeMutationOptions,
  ) {
    return this.request<PlacePlayResult>({
      method: "POST",
      path: this.endpoints.traditionalPlays,
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
    return this.request<ResultsResponse>({ method: "GET", path, options });
  }

  private async request<T>(descriptor: RequestDescriptor): Promise<T> {
    const url = resolveEndpoint(this.baseUrl, descriptor.path);
    const headers = await this.buildHeaders(
      descriptor.body !== undefined,
      descriptor.options?.headers,
      descriptor.idempotencyKey,
    );
    const response = await this.fetcher(url, {
      method: descriptor.method,
      headers,
      body:
        descriptor.body === undefined
          ? undefined
          : JSON.stringify(descriptor.body),
      cache: "no-store",
      credentials: "include",
      signal: descriptor.options?.signal,
    });

    if (!response.ok) {
      throw await toHttpError(response, descriptor.method, url);
    }

    if (response.status === 204) return undefined as T;

    const rawBody = await response.text();
    if (!rawBody) return undefined as T;

    try {
      return JSON.parse(rawBody) as T;
    } catch (cause) {
      throw new BackofficeProtocolError({
        status: response.status,
        requestId:
          response.headers.get("x-request-id") ??
          response.headers.get("x-correlation-id") ??
          undefined,
        url,
        cause,
      });
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
