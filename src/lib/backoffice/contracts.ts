import type {
  Currency,
  GamingCatalog,
  GamingPlay,
  GamingResult,
  InstantGameId,
  PlacePlayResponse,
  TraditionalGameId,
} from "@/lib/gaming/types";

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

export interface BootstrapResponse {
  session: BackofficeSession | null;
  catalog: GamingCatalog;
  plays: readonly GamingPlay[];
  results: readonly GamingResult[];
}

export interface CatalogResponse {
  catalog: GamingCatalog;
}

export interface PlaceTraditionalPlayRequest {
  gameId: TraditionalGameId;
  drawId: string;
  amount: number;
  selection: unknown;
}

export interface PlaceInstantPlayRequest {
  gameId: InstantGameId;
  amount: number;
  selection: unknown;
}

export interface PlaysQuery {
  family?: "TRADITIONAL" | "INSTANT";
  status?: GamingPlay["status"];
  cursor?: string;
  limit?: number;
}

export interface PlaysResponse {
  plays: readonly GamingPlay[];
  nextCursor?: string | null;
}

export interface ResultsQuery {
  gameId?: TraditionalGameId | InstantGameId;
  drawId?: string;
  source?: GamingResult["source"];
  cursor?: string;
  limit?: number;
}

export interface ResultsResponse {
  results: readonly GamingResult[];
  nextCursor?: string | null;
}

export type PlacePlayResult = PlacePlayResponse;

/** All paths are supplied by environment-specific composition code. */
export interface BackofficeEndpoints {
  session: string;
  bootstrap: string;
  login: string;
  register: string;
  logout: string;
  catalog: string;
  plays: string;
  traditionalPlays: string;
  instantPlays: string;
  results: string;
}

export interface BackofficeRequestOptions {
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export interface BackofficeMutationOptions extends BackofficeRequestOptions {
  /** Reusing a key lets the backoffice safely replay a submission. */
  idempotencyKey?: string;
}

export interface BackofficeClient {
  getSession(options?: BackofficeRequestOptions): Promise<SessionResponse>;
  bootstrap(options?: BackofficeRequestOptions): Promise<BootstrapResponse>;
  login(
    input: LoginRequest,
    options?: BackofficeRequestOptions,
  ): Promise<AuthenticationResponse>;
  register(
    input: RegisterUserRequest,
    options?: BackofficeRequestOptions,
  ): Promise<AuthenticationResponse>;
  logout(options?: BackofficeRequestOptions): Promise<void>;
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
}
