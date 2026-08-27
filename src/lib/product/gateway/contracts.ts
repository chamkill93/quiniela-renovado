import type {
  BackofficeEndpoints,
  LoginRequest,
  PlaceInstantPlayRequest,
  PlaceTraditionalPlayRequest,
  RegisterUserRequest,
} from "@/lib/backoffice";
import type { AccountGateway } from "@/lib/account/contracts";
import type {
  GamingCatalog,
  TopupMethod,
  WalletMovement,
} from "@/lib/gaming/types";
import type {
  MockPlay,
  MockResult,
  MockSession,
  MockTicket,
  PlayResponse,
} from "@/lib/product/api-types";

export type ProductGatewayMode = "preview" | "backoffice";
export type ProductPlayKind = "instant" | "traditional";
export type ProductPlayCommand =
  | { kind: "instant"; input: PlaceInstantPlayRequest }
  | { kind: "traditional"; input: PlaceTraditionalPlayRequest };

export interface ProductGatewayRequestOptions {
  signal?: AbortSignal;
}

export interface ProductGatewayMutationOptions extends ProductGatewayRequestOptions {
  idempotencyKey?: string;
  /** Preview mutations reject a cookie belonging to a different displayed session. */
  expectedSessionId?: string;
}

export interface ProductSnapshot {
  session: MockSession | null;
  catalog: GamingCatalog;
  plays: readonly MockPlay[];
  results: readonly MockResult[];
}

export interface ProductAuthenticationResponse {
  session: MockSession;
  /** Distinguishes isolated fixtures from server sessions and persistent backoffice identity. */
  source: "preview-fixture" | "preview-session" | "backoffice";
}

export interface ProductTopUpInput {
  amount: number;
  method: TopupMethod;
}

export interface ProductTopUpResponse {
  session: MockSession;
  balanceEntry: WalletMovement;
  replayed: boolean;
}

export type ProductWithdrawalInput = ProductTopUpInput;
export type ProductWithdrawalResponse = ProductTopUpResponse;

export interface ProductGatewayCapabilities {
  /** Wallet remains disabled until both external endpoint contracts are supplied. */
  wallet: boolean;
  /** Explicit opt-in; a wallet integration does not imply a withdrawal contract. */
  withdrawal?: boolean;
  /** Preview registration is a fixture; only backoffice mode persists a user. */
  persistentRegistration: boolean;
}

/**
 * Frontend-only boundary. Implementations transport data but never calculate
 * balances, results, payouts or account state.
 */
export interface ProductGateway {
  readonly account?: AccountGateway;
  readonly mode: ProductGatewayMode;
  readonly capabilities: Readonly<ProductGatewayCapabilities>;
  bootstrap(options?: ProductGatewayRequestOptions): Promise<ProductSnapshot>;
  requestPlay(
    command: ProductPlayCommand,
    options?: ProductGatewayMutationOptions,
  ): Promise<PlayResponse>;
  getTicket(
    ticketId: string,
    options?: ProductGatewayRequestOptions,
  ): Promise<MockTicket>;
  getResults(options?: ProductGatewayRequestOptions): Promise<readonly MockResult[]>;
  login(
    input: LoginRequest,
    options?: ProductGatewayRequestOptions,
  ): Promise<ProductAuthenticationResponse>;
  register(
    input: RegisterUserRequest,
    options?: ProductGatewayRequestOptions,
  ): Promise<ProductAuthenticationResponse>;
  logout(options?: ProductGatewayRequestOptions): Promise<void>;
  getMovements(options?: ProductGatewayRequestOptions): Promise<readonly WalletMovement[]>;
  topUp(
    input: ProductTopUpInput,
    options?: ProductGatewayMutationOptions,
  ): Promise<ProductTopUpResponse>;
  withdraw?(
    input: ProductWithdrawalInput,
    options?: ProductGatewayMutationOptions,
  ): Promise<ProductWithdrawalResponse>;
}

export interface PreviewProductEndpoints {
  bootstrap: string;
  register: string;
  account: string;
  accountLimits: string;
  accountPause: string;
  accountProfile: string;
  login: string;
  logout: string;
  instantPlay: string;
  traditionalPlay: string;
  /** Path template containing the literal `{ticketId}` token. */
  ticket: string;
  results: string;
  walletMovements: string;
  walletTopUp: string;
  walletWithdrawal: string;
}

export interface PublicProductGatewayEnvironment {
  NEXT_PUBLIC_PRODUCT_GATEWAY_MODE?: string;
  NEXT_PUBLIC_BACKOFFICE_BASE_URL?: string;
  NEXT_PUBLIC_BACKOFFICE_ENDPOINT_SESSION?: string;
  NEXT_PUBLIC_BACKOFFICE_ENDPOINT_BOOTSTRAP?: string;
  NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGIN?: string;
  NEXT_PUBLIC_BACKOFFICE_ENDPOINT_REGISTER?: string;
  NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGOUT?: string;
  NEXT_PUBLIC_BACKOFFICE_ENDPOINT_CATALOG?: string;
  NEXT_PUBLIC_BACKOFFICE_ENDPOINT_PLAYS?: string;
  NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TRADITIONAL_PLAYS?: string;
  NEXT_PUBLIC_BACKOFFICE_ENDPOINT_INSTANT_PLAYS?: string;
  NEXT_PUBLIC_BACKOFFICE_ENDPOINT_RESULTS?: string;
  NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TICKET?: string;
  NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_MOVEMENTS?: string;
  NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_TOPUP?: string;
  NEXT_PUBLIC_BACKOFFICE_TIMEOUT_MS?: string;
}

export interface ProductBackofficeConfiguration {
  baseUrl: string;
  endpoints: Readonly<BackofficeEndpoints>;
  timeoutMs?: number;
}
