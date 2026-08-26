import type {
  BackofficeClient,
  BackofficeSession,
} from "@/lib/backoffice";
import type {
  GamingPlay,
  GamingResult,
  GamingTicket,
  PlacePlayResponse,
} from "@/lib/gaming/types";
import type {
  MockPlay,
  MockResult,
  MockSession,
  MockTicket,
  PlayResponse,
} from "@/lib/product/api-types";

import type {
  ProductAuthenticationResponse,
  ProductGateway,
  ProductGatewayMutationOptions,
  ProductGatewayRequestOptions,
  ProductPlayCommand,
  ProductSnapshot,
  ProductTopUpInput,
} from "./contracts";
import {
  assertPlayResponseMatchesCommand,
  assertTopUpResponseMatchesInput,
} from "./response-contract";

export class ProductGatewayCapabilityError extends Error {
  readonly capability: "wallet";

  constructor(capability: "wallet") {
    super(
      "La billetera requiere endpoints explícitos del backoffice antes de habilitarse.",
    );
    this.name = "ProductGatewayCapabilityError";
    this.capability = capability;
  }
}

export interface BackofficeProductGatewayConfig {
  client: BackofficeClient;
  walletAvailable?: boolean;
}

function toMockSession(session: BackofficeSession): MockSession {
  return { ...session };
}

function toMockPlay(play: GamingPlay): MockPlay {
  return {
    id: play.id,
    ticketId: play.ticketId,
    family: play.family,
    gameId: play.gameId,
    gameName: play.gameName,
    amount: play.amount,
    prize: play.prize,
    status: play.status,
    createdAt: play.createdAt,
    drawId: play.drawId ?? undefined,
    selection: play.selection,
    result: play.result,
    resultNumbers: play.resultNumbers ? [...play.resultNumbers] : null,
    matches: play.matches,
  };
}

function toMockTicket(ticket: GamingTicket): MockTicket {
  return {
    id: ticket.id,
    code: ticket.code,
    playId: ticket.playId,
    gameId: ticket.gameId,
    gameName: ticket.gameName,
    family: ticket.family,
    drawId: ticket.drawId,
    amount: ticket.amount,
    currency: ticket.currency,
    prize: ticket.prize,
    status: ticket.status,
    selection: ticket.selection,
    resultNumbers: ticket.resultNumbers ? [...ticket.resultNumbers] : null,
    createdAt: ticket.issuedAt,
    issuedAt: ticket.issuedAt,
  };
}

function toMockResult(result: GamingResult): MockResult {
  return {
    id: result.id,
    drawId: result.drawId ?? undefined,
    gameId: result.gameId,
    gameName: result.gameName,
    source: result.source,
    result: result.result,
    resultNumbers: [...result.resultNumbers],
    occurredAt: result.occurredAt,
  };
}

function toPlayResponse(response: PlacePlayResponse): PlayResponse {
  return {
    play: toMockPlay(response.play),
    ticket: toMockTicket(response.ticket),
    session: { ...response.session },
    replayed: response.replayed,
  };
}

export class BackofficeProductGateway implements ProductGateway {
  readonly mode = "backoffice" as const;
  readonly capabilities;

  private readonly client: BackofficeClient;

  constructor(config: BackofficeProductGatewayConfig) {
    this.client = config.client;
    this.capabilities = {
      wallet: Boolean(config.walletAvailable),
      persistentRegistration: true,
    } as const;
  }

  async bootstrap(options?: ProductGatewayRequestOptions): Promise<ProductSnapshot> {
    const [sessionResponse, catalogResponse, resultsResponse] = await Promise.all([
      this.client.getSession(options),
      this.client.getCatalog(options),
      this.client.getResults({}, options),
    ]);
    const playsResponse = sessionResponse.session
      ? await this.client.getPlays({}, options)
      : { plays: [] };
    return {
      session: sessionResponse.session
        ? toMockSession(sessionResponse.session)
        : null,
      catalog: catalogResponse.catalog,
      plays: playsResponse.plays.map(toMockPlay),
      results: resultsResponse.results.map(toMockResult),
    };
  }

  async requestPlay(
    command: ProductPlayCommand,
    options?: ProductGatewayMutationOptions,
  ) {
    const mutationOptions = {
      signal: options?.signal,
      idempotencyKey: options?.idempotencyKey,
    };
    const response =
      command.kind === "instant"
        ? await this.client.placeInstantPlay(
            command.input,
            mutationOptions,
          )
        : await this.client.placeTraditionalPlay(
            command.input,
            mutationOptions,
          );
    return assertPlayResponseMatchesCommand(toPlayResponse(response), command);
  }

  async getResults(options?: ProductGatewayRequestOptions) {
    const data = await this.client.getResults({}, options);
    return data.results.map(toMockResult);
  }

  async login(
    input: { documentOrPhone: string; password: string },
    options?: ProductGatewayRequestOptions,
  ): Promise<ProductAuthenticationResponse> {
    const data = await this.client.login(input, options);
    return { session: toMockSession(data.session), source: "backoffice" };
  }

  async register(
    input: Parameters<BackofficeClient["register"]>[0],
    options?: ProductGatewayRequestOptions,
  ): Promise<ProductAuthenticationResponse> {
    const data = await this.client.register(input, options);
    return { session: toMockSession(data.session), source: "backoffice" };
  }

  logout(options?: ProductGatewayRequestOptions) {
    return this.client.logout(options);
  }

  async getMovements(options?: ProductGatewayRequestOptions) {
    this.requireWallet();
    const data = await this.client.getMovements({}, options);
    return data.movements ?? [];
  }

  async topUp(
    input: ProductTopUpInput,
    options?: ProductGatewayMutationOptions,
  ) {
    this.requireWallet();
    const data = await this.client.topUp(input, options);
    return assertTopUpResponseMatchesInput(
      { ...data, session: { ...data.session } },
      input,
    );
  }

  private requireWallet() {
    if (!this.capabilities.wallet) {
      throw new ProductGatewayCapabilityError("wallet");
    }
  }
}

export function createBackofficeProductGateway(
  config: BackofficeProductGatewayConfig,
) {
  return new BackofficeProductGateway(config);
}
