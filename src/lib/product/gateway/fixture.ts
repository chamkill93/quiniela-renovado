import type { LoginRequest, RegisterUserRequest } from "@/lib/backoffice";
import type { WalletMovement } from "@/lib/gaming/types";
import type {
  MockResult,
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
  ProductTopUpResponse,
  ProductWithdrawalInput,
  ProductWithdrawalResponse,
} from "./contracts";
import {
  assertPlayResponseMatchesCommand,
  assertTopUpResponseMatchesInput,
  assertWithdrawalResponseMatchesInput,
} from "./response-contract";

export type FixtureProductGatewayOperation =
  | "bootstrap"
  | "login"
  | "register"
  | "requestPlay"
  | "getTicket"
  | "getResults"
  | "getMovements"
  | "topUp"
  | "withdraw"
  | "logout";

export type FixtureProductGatewayFailureFactory = (
  operation: FixtureProductGatewayOperation,
) => Error;

export type FixtureProductGatewayFailure =
  | Error
  | FixtureProductGatewayFailureFactory;

export class FixtureProductGatewayMissingResponseError extends Error {
  readonly operation: FixtureProductGatewayOperation;

  constructor(operation: FixtureProductGatewayOperation) {
    super(`No hay una respuesta fixture configurada para ${operation}.`);
    this.name = "FixtureProductGatewayMissingResponseError";
    this.operation = operation;
  }
}

export interface FixtureAuthenticationResponse {
  session: ProductAuthenticationResponse["session"];
  source?: "preview-fixture";
}

export interface FixtureProductPlay {
  command: ProductPlayCommand;
  response: PlayResponse;
}

/**
 * Immutable response set used by component and end-to-end tests. Supplying a
 * response never authorizes the fixture to calculate or update product state.
 */
export interface FixtureProductGatewayConfig {
  bootstrap?: ProductSnapshot;
  login?: FixtureAuthenticationResponse;
  register?: FixtureAuthenticationResponse;
  plays?: readonly FixtureProductPlay[];
  tickets?: readonly MockTicket[];
  results?: readonly MockResult[];
  movements?: readonly WalletMovement[];
  topUp?: ProductTopUpResponse;
  withdrawal?: ProductWithdrawalResponse;
  /** Immediate, preconfigured transport or domain failures by operation. */
  failures?: Partial<
    Record<FixtureProductGatewayOperation, FixtureProductGatewayFailure>
  >;
}

type FixtureProductGatewayResponses = Omit<
  FixtureProductGatewayConfig,
  "failures"
>;

function cloneFixture<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Compares JSON-shaped commands without depending on property insertion order. */
function fixtureValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => fixtureValuesEqual(value, right[index]))
    );
  }

  if (!isRecord(left) || !isRecord(right)) return false;

  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && fixtureValuesEqual(left[key], right[key]),
    )
  );
}

function throwIfAborted(signal?: AbortSignal) {
  signal?.throwIfAborted();
}

async function fixtureCheckpoint(signal?: AbortSignal) {
  throwIfAborted(signal);
  await Promise.resolve();
  throwIfAborted(signal);
}

/**
 * Fully deterministic frontend adapter. Every business response is injected;
 * calls neither consume fixtures nor derive balances, prizes or results.
 */
export class FixtureProductGateway implements ProductGateway {
  readonly mode = "preview" as const;
  readonly capabilities;

  private readonly fixtures: FixtureProductGatewayResponses;
  private readonly failures: Readonly<
    Partial<Record<FixtureProductGatewayOperation, FixtureProductGatewayFailure>>
  >;

  constructor(config: FixtureProductGatewayConfig = {}) {
    const { failures, ...fixtures } = config;
    this.fixtures = cloneFixture(fixtures);
    this.failures = Object.freeze({ ...failures });
    this.capabilities = Object.freeze({
      wallet:
        this.fixtures.movements !== undefined &&
        this.fixtures.topUp !== undefined,
      withdrawal: this.fixtures.withdrawal !== undefined,
      persistentRegistration: false,
    });
  }

  bootstrap(options?: ProductGatewayRequestOptions) {
    return this.response("bootstrap", this.fixtures.bootstrap, options?.signal);
  }

  async requestPlay(
    command: ProductPlayCommand,
    options?: ProductGatewayMutationOptions,
  ) {
    const fixture = this.fixtures.plays?.find((candidate) =>
      fixtureValuesEqual(candidate.command, command),
    );
    const response = await this.response(
      "requestPlay",
      fixture?.response,
      options?.signal,
    );
    return assertPlayResponseMatchesCommand(response, command);
  }

  getTicket(ticketId: string, options?: ProductGatewayRequestOptions) {
    const fixture = this.fixtures.tickets?.find(
      (candidate) => candidate.id === ticketId,
    );
    return this.response("getTicket", fixture, options?.signal);
  }

  getResults(options?: ProductGatewayRequestOptions) {
    return this.response("getResults", this.fixtures.results, options?.signal);
  }

  async login(
    input: LoginRequest,
    options?: ProductGatewayRequestOptions,
  ): Promise<ProductAuthenticationResponse> {
    void input;
    const fixture = await this.response(
      "login",
      this.fixtures.login,
      options?.signal,
    );
    return { session: fixture.session, source: "preview-fixture" };
  }

  async register(
    input: RegisterUserRequest,
    options?: ProductGatewayRequestOptions,
  ): Promise<ProductAuthenticationResponse> {
    void input;
    const fixture = await this.response(
      "register",
      this.fixtures.register,
      options?.signal,
    );
    return { session: fixture.session, source: "preview-fixture" };
  }

  async logout(options?: ProductGatewayRequestOptions) {
    await fixtureCheckpoint(options?.signal);
    this.throwConfiguredFailure("logout");
  }

  getMovements(options?: ProductGatewayRequestOptions) {
    return this.response(
      "getMovements",
      this.fixtures.movements,
      options?.signal,
    );
  }

  async topUp(
    input: ProductTopUpInput,
    options?: ProductGatewayMutationOptions,
  ) {
    const response = await this.response(
      "topUp",
      this.fixtures.topUp,
      options?.signal,
    );
    return assertTopUpResponseMatchesInput(response, input);
  }

  async withdraw(
    input: ProductWithdrawalInput,
    options?: ProductGatewayMutationOptions,
  ) {
    const response = await this.response(
      "withdraw",
      this.fixtures.withdrawal,
      options?.signal,
    );
    return assertWithdrawalResponseMatchesInput(response, input);
  }

  private async response<T>(
    operation: FixtureProductGatewayOperation,
    fixture: T | undefined,
    signal?: AbortSignal,
  ): Promise<T> {
    await fixtureCheckpoint(signal);
    this.throwConfiguredFailure(operation);
    if (fixture === undefined) {
      throw new FixtureProductGatewayMissingResponseError(operation);
    }
    return cloneFixture(fixture);
  }

  private throwConfiguredFailure(operation: FixtureProductGatewayOperation) {
    const configured = this.failures[operation];
    if (configured === undefined) return;
    throw typeof configured === "function"
      ? configured(operation)
      : configured;
  }
}

export function createFixtureProductGateway(
  config?: FixtureProductGatewayConfig,
) {
  return new FixtureProductGateway(config);
}
