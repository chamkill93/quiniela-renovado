import type { PlayResponse } from "@/lib/product/api-types";

import type {
  ProductPlayCommand,
  ProductTopUpInput,
  ProductTopUpResponse,
  ProductWithdrawalInput,
  ProductWithdrawalResponse,
} from "./contracts";

export class ProductGatewayProtocolError extends Error {
  readonly kind = "PROTOCOL" as const;
  readonly code = "INVALID_GATEWAY_RESPONSE";

  constructor(message: string) {
    super(message);
    this.name = "ProductGatewayProtocolError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => structurallyEqual(value, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        structurallyEqual(left[key], right[key]),
    )
  );
}

export function assertPlayResponseMatchesCommand(
  response: PlayResponse,
  command: ProductPlayCommand,
) {
  const expectedFamily = command.kind === "instant" ? "INSTANT" : "TRADITIONAL";
  const expectedDrawId = command.kind === "traditional"
    ? command.input.drawId
    : null;
  const coherent =
    response.play.family === expectedFamily &&
    response.play.gameId === command.input.gameId &&
    response.play.amount === command.input.amount &&
    (response.play.drawId ?? null) === expectedDrawId &&
    structurallyEqual(response.play.selection, command.input.selection) &&
    response.ticket.gameId === command.input.gameId &&
    response.ticket.family === expectedFamily &&
    response.ticket.amount === command.input.amount &&
    (response.ticket.drawId ?? null) === expectedDrawId;

  if (!coherent) {
    throw new ProductGatewayProtocolError(
      "La respuesta de jugada no coincide con el comando enviado al backoffice.",
    );
  }
  return response;
}

export function assertTopUpResponseMatchesInput(
  response: ProductTopUpResponse,
  input: ProductTopUpInput,
) {
  const entry = response.balanceEntry;
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0 ||
    !Number.isSafeInteger(response.session.balance) ||
    response.session.balance < 0 ||
    entry.type !== "TOPUP" ||
    entry.amount !== input.amount ||
    entry.method !== input.method ||
    entry.balanceAfter !== response.session.balance ||
    entry.currency !== response.session.currency
  ) {
    throw new ProductGatewayProtocolError(
      "La respuesta de recarga no coincide con el comando enviado al backoffice.",
    );
  }
  return response;
}

export function assertWithdrawalResponseMatchesInput(
  response: ProductWithdrawalResponse,
  input: ProductWithdrawalInput,
) {
  const entry = response.balanceEntry;
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0 ||
    !Number.isSafeInteger(response.session.balance) ||
    response.session.balance < 0 ||
    entry.type !== "WITHDRAWAL" ||
    entry.amount !== -input.amount ||
    entry.method !== input.method ||
    entry.balanceAfter !== response.session.balance ||
    entry.currency !== response.session.currency
  ) {
    throw new ProductGatewayProtocolError(
      "La respuesta de retiro no coincide con la operación solicitada.",
    );
  }
  return response;
}
