import {
  backofficeResponseParsers,
  type BackofficeResponseParser,
} from "@/lib/backoffice";
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
} from "./response-contract";

export const PREVIEW_PRODUCT_ENDPOINTS: Readonly<PreviewProductEndpoints> = {
  bootstrap: "/api/mock/bootstrap",
  login: "/api/mock/session/login",
  logout: "/api/mock/session/logout",
  instantPlay: "/api/mock/instant",
  traditionalPlay: "/api/mock/traditional",
  ticket: "/api/mock/tickets/{ticketId}",
  results: "/api/mock/results",
  walletMovements: "/api/mock/wallet/movements",
  walletTopUp: "/api/mock/wallet/topup",
};

export interface PreviewProductGatewayConfig {
  baseUrl?: string;
  endpoints?: Partial<PreviewProductEndpoints>;
  fetch?: ProductGatewayFetch;
}

/** Explicit, deterministic and non-persistent preview registration fixture. */
function previewRegistrationFixture(
  displayName: string,
): ProductAuthenticationResponse {
  return {
    source: "preview-fixture",
    session: {
      id: "preview-registration-fixture",
      displayName: displayName.trim() || "Usuario preview",
      role: "PLAYER",
      balance: 250_000,
      currency: "PYG",
    },
  };
}

function toPreviewPlay(play: GamingPlay): MockPlay {
  return {
    ...play,
    resultNumbers: play.resultNumbers ? [...play.resultNumbers] : null,
  };
}

function toPreviewResult(result: GamingResult): MockResult {
  return {
    ...result,
    resultNumbers: [...result.resultNumbers],
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
  readonly mode = "preview" as const;
  readonly capabilities = {
    wallet: true,
    persistentRegistration: false,
  } as const;

  private readonly baseUrl: string;
  private readonly endpoints: Readonly<PreviewProductEndpoints>;
  private readonly fetcher: ProductGatewayFetch;

  constructor(config: PreviewProductGatewayConfig = {}) {
    this.baseUrl = config.baseUrl ?? "";
    this.endpoints = { ...PREVIEW_PRODUCT_ENDPOINTS, ...config.endpoints };
    this.fetcher = config.fetch ?? ((input, init) => fetch(input, init));
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

  async register(input: { displayName: string }) {
    return previewRegistrationFixture(input.displayName);
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

  private get<T>(
    endpoint: string,
    parser: BackofficeResponseParser<T>,
    options?: ProductGatewayRequestOptions,
  ) {
    return this.request<T>(endpoint, {
      method: "GET",
      cache: "no-store",
      signal: options?.signal,
    }, parser);
  }

  private post<T>(
    endpoint: string,
    body: unknown,
    parser: BackofficeResponseParser<T>,
    options?: ProductGatewayMutationOptions,
  ) {
    const headers = new Headers({ Accept: "application/json" });
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
    let response: Response;
    try {
      response = await this.fetcher(
        resolveProductEndpoint(this.baseUrl, endpoint),
        init,
      );
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") {
        throw reason;
      }
      throw new ProductGatewayHttpError(
        0,
        "GATEWAY_NETWORK_ERROR",
        "No se pudo conectar con el servicio de vista previa.",
      );
    }
    return readProductJson(response, parser);
  }
}

export function createPreviewProductGateway(config?: PreviewProductGatewayConfig) {
  return new PreviewProductGateway(config);
}
