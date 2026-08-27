export const CURRENCY = "PYG" as const;
export const DRAW_POSTURE_COUNT = 14;

export type Currency = typeof CURRENCY;
export type MockRole = "PLAYER" | "ADMIN";
export type PyaeNeutralPolicy = "REFUND" | "LOSS";
export type PlayFamily = "TRADITIONAL" | "INSTANT";
export type PlayStatus = "PENDING" | "WON" | "LOST" | "REFUNDED";

export type TraditionalGameId =
  | "head"
  | "prizes"
  | "invert"
  | "redoblona"
  | "sapyaite-traditional"
  | "megaloto";

export type InstantGameId =
  | "sapyaite"
  | "poa"
  | "pyae"
  | "petei"
  | "mokoi"
  | "mbohapy"
  | "poa5"
  | "poa10"
  | "racha5";

export interface MockSessionView {
  id: string;
  displayName: string;
  role: MockRole;
  balance: number;
  currency: Currency;
}

export interface DrawDefinition {
  id: string;
  label: string;
  family: "QUINIELA" | "MEGALOTO";
  closesAt: string;
  drawsAt: string;
  status: "OPEN";
}

export type TraditionalSelectionDefinition =
  | { kind: "THREE_DIGIT"; position: { min: number; max: number } | null }
  | {
      kind: "REDOBLONA";
      headDigits: 3;
      redoblonaDigits: 2;
      position: { min: 2; max: 14 };
    }
  | {
      kind: "MEGALOTO";
      count: 6;
      min: 1;
      max: 45;
      unique: true;
      modalities: readonly ["MEGA_FULL", "MEGA_POZO"];
    };

export interface TraditionalGameDefinition {
  id: TraditionalGameId;
  name: string;
  description: string;
  iconKey: string;
  drawIds: readonly string[];
  selection: TraditionalSelectionDefinition;
}

export interface MultiplierPrototypePayout {
  prototype: true;
  kind: "MULTIPLIER";
  winMultiplier: number;
}

export interface MatchTier {
  exactMatches: number;
  multiplier: number;
}

export interface MatchTierPrototypePayout {
  prototype: true;
  kind: "MATCH_TIERS";
  tiers: readonly MatchTier[];
  pendingFromMatches?: number;
}

export type PrototypePayout =
  | MultiplierPrototypePayout
  | MatchTierPrototypePayout;

export type InstantSelectionDefinition =
  | { kind: "ENUM"; values: readonly string[] }
  | {
      kind: "HUNDRED_RANGE";
      values: readonly { value: string; label: string }[];
    }
  | { kind: "PADDED_INTEGER"; min: number; max: number; width: 1 | 2 | 3 }
  | {
      kind: "UNIQUE_THREE_DIGIT_NUMBERS";
      count: 3;
      min: 1;
      max: 999;
    };

export interface InstantGameDefinition {
  id: InstantGameId;
  name: string;
  description: string;
  iconKey: string;
  engine:
    | "PARITY"
    | "HUNDRED_RANGE"
    | "OVER_UNDER_500"
    | "LAST_DIGIT"
    | "LAST_TWO_DIGITS"
    | "EXACT_THREE_DIGITS"
    | "MULTI_EXACT"
    | "MULTI_PARITY";
  reels: 1 | 5 | 10;
  rng: { min: 0 | 1; max: 999 };
  selection: InstantSelectionDefinition;
  payout: PrototypePayout;
  neutral500Policy?: PyaeNeutralPolicy;
}

export interface GamingCatalog {
  amounts: readonly number[];
  draws: readonly DrawDefinition[];
  traditional: readonly TraditionalGameDefinition[];
  instant: readonly InstantGameDefinition[];
}

export interface GamingPlay {
  id: string;
  ticketId: string;
  family: PlayFamily;
  gameId: TraditionalGameId | InstantGameId;
  gameName: string;
  selection: unknown;
  drawId: string | null;
  amount: number;
  currency: Currency;
  status: PlayStatus;
  result: string | null;
  resultNumbers: readonly string[] | null;
  ruleResult: string | null;
  matches: number | null;
  payoutMultiplier: number;
  prize: number;
  createdAt: string;
}

export interface GamingTicket {
  id: string;
  code: string;
  playId: string;
  gameId: TraditionalGameId | InstantGameId;
  gameName: string;
  family: PlayFamily;
  selection: unknown;
  drawId: string | null;
  amount: number;
  currency: Currency;
  status: PlayStatus;
  result: string | null;
  resultNumbers: readonly string[] | null;
  ruleResult: string | null;
  prize: number;
  issuedAt: string;
}

export interface PositionedDrawNumber {
  position: number;
  value: string;
}

export interface GamingResult {
  id: string;
  source: "DRAW" | "INSTANT";
  gameId: TraditionalGameId | InstantGameId;
  gameName: string;
  drawId: string | null;
  result: string;
  resultNumbers: readonly string[];
  /** Canonical draw positions, shared across modalities; may be partially published. */
  drawNumbers?: readonly PositionedDrawNumber[];
  occurredAt: string;
}

export interface PlacePlayResponse {
  play: GamingPlay;
  ticket: GamingTicket;
  session: Pick<MockSessionView, "balance" | "currency">;
  replayed: boolean;
}

export const WALLET_MIN_AMOUNT = 10_000;
export const WALLET_MAX_AMOUNT = 5_000_000;
export const WALLET_METHODS = [
  "CARD",
  "BANK_TRANSFER",
  "CASH_POINT",
  "PUNTO_RECARGA",
  "QR",
  "TIGO",
  "CLARO",
  "PERSONAL",
] as const;

export type WalletMovementType = "TOPUP" | "WITHDRAWAL" | "STAKE" | "PRIZE" | "REFUND";
export type TopupMethod = (typeof WALLET_METHODS)[number];

export interface WalletMovement {
  id: string;
  type: WalletMovementType;
  amount: number;
  currency: Currency;
  balanceAfter: number;
  referenceId: string | null;
  method: TopupMethod | null;
  createdAt: string;
}

export interface TopupResponse {
  session: MockSessionView;
  balanceEntry: WalletMovement;
  replayed: boolean;
}

export type WithdrawalResponse = TopupResponse;
