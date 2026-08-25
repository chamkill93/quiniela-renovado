export type UserRole = "PLAYER" | "ADMIN";

export interface MockSession {
  id: string;
  displayName: string;
  role: UserRole;
  balance: number;
  currency: "PYG" | string;
}

export interface MockPlay {
  id: string;
  ticketId?: string;
  family?: "INSTANT" | "TRADITIONAL";
  gameId: string;
  gameName?: string;
  amount: number;
  prize: number;
  status: "PENDING" | "WON" | "LOST" | "REFUNDED" | string;
  createdAt: string;
  drawId?: string;
  selection?: unknown;
  result?: string | null;
  resultNumbers?: string[] | null;
  matches?: number | null;
}

export interface MockTicket {
  id: string;
  code?: string;
  playId: string;
  gameName?: string;
  amount: number;
  prize?: number;
  status?: string;
  selection?: unknown;
  resultNumbers?: string[] | null;
  createdAt?: string;
  issuedAt?: string;
}

export interface MockResult {
  id: string;
  drawId?: string;
  label?: string;
  gameId?: string;
  gameName?: string;
  source?: "DRAW" | "INSTANT";
  numbers?: string[];
  resultNumbers?: string[];
  result?: string;
  occurredAt?: string;
  publishedAt?: string;
}

export interface BootstrapResponse {
  session: MockSession;
  catalog: {
    traditional: unknown[];
    instant: unknown[];
    draws: unknown[];
    amounts: number[];
  };
  plays: MockPlay[];
  results: MockResult[];
}

export interface PlayResponse {
  play: MockPlay;
  ticket: MockTicket;
  session: Pick<MockSession, "balance"> & Partial<MockSession>;
  replayed: boolean;
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string; issues?: unknown };
}
