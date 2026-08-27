export type GamingErrorCode =
  | "INVALID_JSON"
  | "SESSION_REQUIRED"
  | "SESSION_NOT_FOUND"
  | "GAME_NOT_FOUND"
  | "DRAW_NOT_AVAILABLE"
  | "INSUFFICIENT_BALANCE"
  | "ACCOUNT_LIMIT_INCREASE"
  | "ACCOUNT_PAUSE_SHORTENED"
  | "ACCOUNT_PAUSED"
  | "ACCOUNT_TIME_LIMIT"
  | "ACCOUNT_AMOUNT_LIMIT"
  | "ACCOUNT_SESSION_CHANGED"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "PLAY_NOT_FOUND"
  | "TICKET_NOT_FOUND"
  | "INVALID_RESULT";

export class GamingDomainError extends Error {
  readonly code: GamingErrorCode;

  constructor(code: GamingErrorCode, message: string) {
    super(message);
    this.name = "GamingDomainError";
    this.code = code;
  }
}
