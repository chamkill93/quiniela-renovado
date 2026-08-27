import {
  backofficeResponseParsers,
  type BackofficeResponseParser,
} from "@/lib/backoffice";
import { accountSettingsResponseSchema, type AccountGateway, type AccountRequestOptions } from "@/lib/account/contracts";
import type { RegisterUserRequest } from "@/lib/backoffice";
import type {
  GamingPlay,
  GamingResult,
  PlacePlayResponse,
} from "@/lib/gaming/types";
import type {
  MockPlay,
  MockResult,
  PlayResponse,
} from "@/lib/product/api-types";

import type {
  PreviewProductEndpoints,
  ProductAuthenticationResponse,
  ProductGateway,
  ProductGatewayMutationOptions,
  ProductGatewayRequestOptions,
  ProductPlayCommand,
  ProductSnapshot,
  ProductTopUpInput,
  ProductTopUpResponse,
  ProductWithdrawalInput,
  ProductWithdrawalResponse,
} from "./contracts";
import {
  createProductIdempotencyKey,
  ProductGatewayHttpError,
  type ProductGatewayFetch,
  readProductJson,
  resolveProductEndpoint,
} from "./http";
import {
  assertPlayResponseMatchesCommand,
  assertTopUpResponseMatchesInput,
  assertWithdrawalResponseMatchesInput,
} from "./response-contract";

export const PREVIEW_PRODUCT_ENDPOINTS: Readonly<PreviewProductEndpoints> = {
  bootstrap: "/api/mock/bootstrap",
  register: "/api/mock/session/register",
  account: "/api/mock/account",
  accountLimits: "/api/mock/account/limits",
  accountPause: "/api/mock/account/pause",
  accountProfile: "/api/mock/account/profile",
  login: "/api/mock/session/login",
  logout: "/api/mock/session/logout",
  instantPlay: "/api/mock/instant",
  traditionalPlay: "/api/mock/traditional",
  ticket: "/api/mock/tickets/{ticketId}",
  results: "/api/mock/results",
  walletMovements: "/api/mock/wallet/movements",
  walletTopUp: "/api/mock/wallet/topup",
  walletWithdrawal: "/api/mock/wallet/withdrawal",
};

export const DEFAULT_PREVIEW_PRODUCT_TIMEOUT_MS = 15_000;

export interface PreviewProductGatewayConfig {
  baseUrl?: string;
  endpoints?: Partial<PreviewProductEndpoints>;
  fetch?: ProductGatewayFetch;
  /** Hard deadline for the complete preview request, including body parsing. */
  timeoutMs?: number;
}

interface PreviewRequestSignal {
  readonly signal: AbortSignal;
  readonly timedOut: () => boolean;
  readonly cleanup: () => void;
}

function validateTimeoutMs(value: number | undefined) {
  const timeoutMs = value ?? DEFAULT_PREVIEW_PRODUCT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs debe ser un número finito mayor que 0.");
  }
  return timeoutMs;
}

function composeRequestSignal(
  callerSignal: AbortSignal | null | undefined,
  timeoutMs: number,
): PreviewRequestSignal {
  const controller = new AbortController();
  let timeoutReached = false;

  const abortFromCaller = () => {
    controller.abort(
      callerSignal?.reason ??
        new DOMException("Preview request aborted", "AbortError"),
    );
  };

  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeoutHandle = setTimeout(() => {
    timeoutReached = true;
    controller.abort(new DOMException("Preview request timeout", "TimeoutError"));
  }, timeoutMs);

  return {
    signal: controller.signal,
    timedOut: () => timeoutReached,
    cleanup: () => {
      clearTimeout(timeoutHandle);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

/**
 * Races an async transport step against the composed signal. This is required
 * even when `signal` is forwarded because injected fetch implementations and
 * body readers are not guaranteed to honor it.
 */
function runWithSignal<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(
      signal.reason ?? new DOMException("Preview request aborted", "AbortError"),
    );
  }

  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      reject(
        signal.reason ??
          new DOMException("Preview request aborted", "AbortError"),
      );
    };
    signal.addEventListener("abort", abort, { once: true });

    let pending: Promise<T>;
    try {
      pending = operation();
    } catch (reason) {
      signal.removeEventListener("abort", abort);
      reject(reason);
      return;
    }

    pending.then(
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

function callerAbortError(signal: AbortSignal) {
  const reason = signal.reason;
  if (reason instanceof DOMException && reason.name === "AbortError") {
    return reason;
  }
  return new DOMException("Preview request aborted", "AbortError");
}

function toPreviewPlay(play: GamingPlay): MockPlay {
  return {
    ...play,
    resultNumbers: play.resultNumbers ? [...play.resultNumbers] : null,
  };
}

function toPreviewResult(result: GamingResult): MockResult {
  const { drawNumbers, ...legacyResult } = result;
  return {
    ...legacyResult,
    resultNumbers: [...result.resultNumbers],
    ...(drawNumbers ? { drawNumbers: drawNumbers.map((number) => ({ ...number })) } : {}),
  };
}

function toPreviewPlayResponse(response: PlacePlayResponse): PlayResponse {
  return {
    ...response,
    play: toPreviewPlay(response.play),
    ticket: {
      ...response.ticket,
      resultNumbers: response.ticket.resultNumbers
        ? [...response.ticket.resultNumbers]
        : null,
    },
    session: { ...response.session },
  };
}

function previewTicketPath(template: string, ticketId: string) {
  if (!ticketId.trim()) throw new TypeError("ticketId no puede estar vacío.");
  if (!template.includes("{ticketId}")) {
    throw new TypeError(
      "El endpoint ticket debe incluir la plantilla literal '{ticketId}'.",
    );
  }
  return template.replaceAll("{ticketId}", encodeURIComponent(ticketId));
}

export class PreviewProductGateway implements ProductGateway {
  readonly account: AccountGateway = {
    getSettings: async (options) => (await this.get(this.endpoints.account, accountSettingsResponseSchema.parse, options)).settings,
    saveLimits: async (input, options) => (await this.post(this.endpoints.accountLimits, input, accountSettingsResponseSchema.parse, options)).settings,
    pause: async (input, options) => (await this.post(this.endpoints.accountPause, input, accountSettingsResponseSchema.parse, options)).settings,
    updateProfile: async (input, options) => (await this.post(this.endpoints.accountProfile, input, backofficeResponseParsers.authentication, options)).session,
  };
  readonly mode = "preview" as const;
  readonly capabilities = {
    wallet: true,
    withdrawal: true,
    persistentRegistration: false,
  } as const;

  private readonly baseUrl: string;
  private readonly endpoints: Readonly<PreviewProductEndpoints>;
  private readonly fetcher: ProductGatewayFetch;
  private readonly timeoutMs: number;

  constructor(config: PreviewProductGatewayConfig = {}) {
    this.baseUrl = config.baseUrl ?? "";
    this.endpoints = { ...PREVIEW_PRODUCT_ENDPOINTS, ...config.endpoints };
    this.fetcher = config.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = validateTimeoutMs(config.timeoutMs);
  }

  async bootstrap(options?: ProductGatewayRequestOptions): Promise<ProductSnapshot> {
    const data = await this.get(
      this.endpoints.bootstrap,
      backofficeResponseParsers.bootstrap,
      options,
    );
    return {
      session: data.session,
      catalog: data.catalog,
      plays: data.plays.map(toPreviewPlay),
      results: data.results.map(toPreviewResult),
    };
  }

  async requestPlay(
    command: ProductPlayCommand,
    options?: ProductGatewayMutationOptions,
  ) {
    const response = await this.post(
      command.kind === "instant"
        ? this.endpoints.instantPlay
        : this.endpoints.traditionalPlay,
      command.input,
      command.kind === "instant"
        ? backofficeResponseParsers.placeInstantPlay
        : backofficeResponseParsers.placeTraditionalPlay,
      options,
    );
    return assertPlayResponseMatchesCommand(
      toPreviewPlayResponse(response),
      command,
    );
  }

  async getTicket(
    ticketId: string,
    options?: ProductGatewayRequestOptions,
  ) {
    const data = await this.get(
      previewTicketPath(this.endpoints.ticket, ticketId),
      backofficeResponseParsers.ticket,
      options,
    );
    return {
      ...data.ticket,
      resultNumbers: data.ticket.resultNumbers
        ? [...data.ticket.resultNumbers]
        : null,
      createdAt: data.ticket.issuedAt,
    };
  }

  async getResults(options?: ProductGatewayRequestOptions) {
    const data = await this.get(
      this.endpoints.results,
      backofficeResponseParsers.results,
      options,
    );
    return data.results.map(toPreviewResult);
  }

  async login(
    input: { documentOrPhone: string; password: string },
    options?: ProductGatewayRequestOptions,
  ): Promise<ProductAuthenticationResponse> {
    const data = await this.post(
      this.endpoints.login,
      input,
      backofficeResponseParsers.authentication,
      options,
    );
    return { session: data.session, source: "preview-fixture" };
  }

  async register(input: RegisterUserRequest, options?: ProductGatewayRequestOptions): Promise<ProductAuthenticationResponse> {
    const response = await this.post(this.endpoints.register, input, backofficeResponseParsers.authentication, options);
    return { session: response.session, source: "preview-session" };
  }

  async logout(options?: ProductGatewayRequestOptions) {
    await this.post(
      this.endpoints.logout,
      undefined,
      () => undefined,
      options,
    );
  }

  async getMovements(options?: ProductGatewayRequestOptions) {
    const data = await this.get(
      this.endpoints.walletMovements,
      backofficeResponseParsers.walletMovements,
      options,
    );
    return data.movements;
  }

  async topUp(
    input: ProductTopUpInput,
    options?: ProductGatewayMutationOptions,
  ) {
    const response = await this.post<ProductTopUpResponse>(
      this.endpoints.walletTopUp,
      input,
      backofficeResponseParsers.walletTopUp,
      options,
    );
    return assertTopUpResponseMatchesInput(response, input);
  }

  async withdraw(
    input: ProductWithdrawalInput,
    options?: ProductGatewayMutationOptions,
  ) {
    const response = await this.post<ProductWithdrawalResponse>(
      this.endpoints.walletWithdrawal,
      input,
      backofficeResponseParsers.walletWithdrawal,
      options,
    );
    return assertWithdrawalResponseMatchesInput(response, input);
  }

  private get<T>(
    endpoint: string,
    parser: BackofficeResponseParser<T>,
    options?: AccountRequestOptions,
  ) {
    const headers = new Headers({ Accept: "application/json" });
    if (options?.expectedSessionId) headers.set("X-Account-Session", options.expectedSessionId);
    return this.request<T>(endpoint, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: options?.signal,
    }, parser);
  }

  private post<T>(
    endpoint: string,
    body: unknown,
    parser: BackofficeResponseParser<T>,
    options?: AccountRequestOptions,
  ) {
    const headers = new Headers({ Accept: "application/json" });
    if (options?.expectedSessionId) headers.set("X-Account-Session", options.expectedSessionId);
    if (body !== undefined) headers.set("Content-Type", "application/json");
    headers.set(
      "Idempotency-Key",
      options?.idempotencyKey ?? createProductIdempotencyKey(),
    );
    return this.request<T>(endpoint, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: options?.signal,
    }, parser);
  }

  private async request<T>(
    endpoint: string,
    init: RequestInit,
    parser: BackofficeResponseParser<T>,
  ) {
    const callerSignal = init.signal;
    const composed = composeRequestSignal(callerSignal, this.timeoutMs);
    const url = resolveProductEndpoint(this.baseUrl, endpoint);

    try {
      const response = await runWithSignal(
        () =>
          this.fetcher(url, {
            ...init,
            signal: composed.signal,
          }),
        composed.signal,
      );
      return await runWithSignal(
        () => readProductJson(response, parser),
        composed.signal,
      );
    } catch (reason) {
      if (composed.timedOut()) {
        throw new ProductGatewayHttpError(
          0,
          "GATEWAY_TIMEOUT",
          "El servicio no respondió a tiempo. Intentá nuevamente.",
        );
      }
      if (callerSignal?.aborted) throw callerAbortError(callerSignal);
      if (reason instanceof ProductGatewayHttpError) throw reason;
      if (reason instanceof DOMException && reason.name === "AbortError") {
        throw reason;
      }
      throw new ProductGatewayHttpError(
        0,
        "GATEWAY_NETWORK_ERROR",
        "No se pudo conectar con el servicio. Intentá nuevamente.",
      );
    } finally {
      composed.cleanup();
    }
  }
}

export function createPreviewProductGateway(config?: PreviewProductGatewayConfig) {
  return new PreviewProductGateway(config);
}
