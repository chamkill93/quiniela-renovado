import type {
  Currency,
  GamingCatalog,
  GamingPlay,
  GamingResult,
  GamingTicket,
  InstantGameId,
  PlacePlayResponse,
  TopupMethod,
  TopupResponse,
  TraditionalGameId,
  WalletMovement,
} from "@/lib/gaming/types";
import type {
  InstantPlayRequest,
  TraditionalPlayRequest,
} from "@/lib/gaming/schemas";

/** The roles currently understood by the frontend. */
export type BackofficeUserRole = "PLAYER" | "ADMIN";

/** Authenticated user data required to render the application shell. */
export interface BackofficeSession {
  id: string;
  displayName: string;
  role: BackofficeUserRole;
  balance: number;
  currency: Currency;
}

export interface SessionResponse {
  session: BackofficeSession | null;
}

export interface LoginRequest {
  documentOrPhone: string;
  password: string;
}

/**
 * Registration payload forwarded to the backoffice without local validation or
 * account-creation logic.
 */
export interface RegisterUserRequest {
  displayName: string;
  documentOrPhone: string;
  password: string;
  email?: string;
  phone?: string;
  acceptedTerms: boolean;
}

export interface AuthenticationResponse {
  session: BackofficeSession;
}

export interface CursorPage {
  nextCursor?: string | null;
}

export interface BackofficeApiIssue {
  code?: string;
  field?: string;
  path?: readonly (string | number)[];
  message?: string;
}

export interface BackofficeApiError {
  code: string;
  message: string;
  details?: unknown;
  issues?: readonly BackofficeApiIssue[] | unknown;
}

export interface BackofficeApiErrorEnvelope {
  error: BackofficeApiError;
}

export interface BootstrapResponse {
  session: BackofficeSession | null;
  catalog: GamingCatalog;
  plays: readonly GamingPlay[];
  results: readonly GamingResult[];
}

export interface CatalogResponse {
  catalog: GamingCatalog;
}

/** Canonical discriminated request consumed by the current frontend forms. */
export type PlaceTraditionalPlayRequest = TraditionalPlayRequest;

/** Canonical discriminated request consumed by the current frontend forms. */
export type PlaceInstantPlayRequest = InstantPlayRequest;

export interface PlaysQuery {
  family?: "TRADITIONAL" | "INSTANT";
  status?: GamingPlay["status"];
  cursor?: string;
  limit?: number;
}

export interface PlaysResponse extends CursorPage {
  plays: readonly GamingPlay[];
}

export interface ResultsQuery {
  gameId?: TraditionalGameId | InstantGameId;
  drawId?: string;
  source?: GamingResult["source"];
  cursor?: string;
  limit?: number;
}

export interface ResultsResponse extends CursorPage {
  results: readonly GamingResult[];
}

export type PlacePlayResult = PlacePlayResponse;

export interface WalletMovementsQuery {
  cursor?: string;
  limit?: number;
}

export interface WalletMovementsResponse extends CursorPage {
  movements: readonly WalletMovement[];
}

/**
 * Minimal wallet command forwarded to the external backoffice. Limits,
 * payment authorization and accepted methods remain backoffice concerns.
 */
export interface WalletTopUpRequest {
  amount: number;
  method: TopupMethod;
}

export type WalletTopUpResponse = TopupResponse;

export interface TicketResponse {
  ticket: GamingTicket;
}

/** All paths are supplied by environment-specific composition code. */
export interface BackofficeEndpoints {
  session: string;
  /** Optional compatibility endpoint; product hydration composes capabilities. */
  bootstrap?: string;
  login: string;
  register: string;
  logout: string;
  catalog: string;
  plays: string;
  traditionalPlays: string;
  instantPlays: string;
  results: string;
  /** Optional because the external wallet contract has not been supplied. */
  walletMovements?: string;
  /** Optional because the external wallet contract has not been supplied. */
  walletTopUp?: string;
  /**
   * Optional path template for ticket lookup. When configured it must contain
   * the literal `{ticketId}` token; the client URL-encodes its replacement.
   */
  ticket?: string;
}

export interface BackofficeRequestOptions {
  signal?: AbortSignal;
  headers?: HeadersInit;
  /** Per-request timeout in milliseconds. `0` disables the client timeout. */
  timeoutMs?: number;
}

export interface BackofficeMutationOptions extends BackofficeRequestOptions {
  /** Reusing a key lets the backoffice safely replay a submission. */
  idempotencyKey?: string;
}

export interface AuthGateway {
  getSession(options?: BackofficeRequestOptions): Promise<SessionResponse>;
  login(
    input: LoginRequest,
    options?: BackofficeRequestOptions,
  ): Promise<AuthenticationResponse>;
  register(
    input: RegisterUserRequest,
    options?: BackofficeRequestOptions,
  ): Promise<AuthenticationResponse>;
  logout(options?: BackofficeRequestOptions): Promise<void>;
}

export interface GamingGateway {
  bootstrap(options?: BackofficeRequestOptions): Promise<BootstrapResponse>;
  getCatalog(options?: BackofficeRequestOptions): Promise<CatalogResponse>;
  getPlays(
    query?: PlaysQuery,
    options?: BackofficeRequestOptions,
  ): Promise<PlaysResponse>;
  placeTraditionalPlay(
    input: PlaceTraditionalPlayRequest,
    options?: BackofficeMutationOptions,
  ): Promise<PlacePlayResult>;
  placeInstantPlay(
    input: PlaceInstantPlayRequest,
    options?: BackofficeMutationOptions,
  ): Promise<PlacePlayResult>;
  getResults(
    query?: ResultsQuery,
    options?: BackofficeRequestOptions,
  ): Promise<ResultsResponse>;
  getTicket(
    ticketId: string,
    options?: BackofficeRequestOptions,
  ): Promise<TicketResponse>;
}

export interface WalletGateway {
  getMovements(
    query?: WalletMovementsQuery,
    options?: BackofficeRequestOptions,
  ): Promise<WalletMovementsResponse>;
  topUp(
    input: WalletTopUpRequest,
    options?: BackofficeMutationOptions,
  ): Promise<WalletTopUpResponse>;
}

/** Complete frontend-facing boundary implemented by the external backoffice. */
export interface BackofficeGateway
  extends AuthGateway,
    GamingGateway,
    WalletGateway {}

/** @deprecated Compatibility name; use `BackofficeGateway` in new code. */
export type BackofficeClient = BackofficeGateway;
