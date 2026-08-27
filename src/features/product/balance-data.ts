import { WALLET_MIN_AMOUNT, WALLET_MAX_AMOUNT, type TopupMethod, type WalletMovement, type WalletMovementType } from "@/lib/gaming/types";

export type WalletOperation = "deposit" | "withdrawal";
export type WalletChannel = "card" | "qr" | "cash" | "phone";
export type MovementFilter = "ALL" | "TOPUP" | "WITHDRAWAL" | "OTHER";
export type MovementPeriod = "ALL" | "7D" | "30D";

export { WALLET_MIN_AMOUNT, WALLET_MAX_AMOUNT };
export const WALLET_QUICK_AMOUNTS = [20_000, 50_000, 100_000, 200_000] as const;

export const WALLET_CHANNELS = [
  { id: "card", label: "Tarjeta", description: "Débito o crédito", method: "CARD", icon: "card" },
  { id: "qr", label: "QR", description: "Billetera digital", method: "QR", icon: "qr" },
  { id: "cash", label: "Efectivo", description: "Punto autorizado", method: "CASH_POINT", icon: "cash" },
  { id: "phone", label: "Telefonía", description: "Tigo, Claro y Personal", method: "TIGO", icon: "phone" },
] as const;

export const PHONE_OPERATORS = [
  { method: "TIGO", label: "Tigo" },
  { method: "CLARO", label: "Claro" },
  { method: "PERSONAL", label: "Personal" },
] as const;

const METHOD_LABELS: Record<TopupMethod, string> = {
  CARD: "Tarjeta",
  QR: "QR",
  CASH_POINT: "Efectivo",
  PUNTO_RECARGA: "Efectivo",
  BANK_TRANSFER: "Transferencia",
  TIGO: "Tigo",
  CLARO: "Claro",
  PERSONAL: "Personal",
};

const MOVEMENT_LABELS: Record<WalletMovementType, string> = {
  TOPUP: "Depósito",
  WITHDRAWAL: "Retiro",
  STAKE: "Jugada",
  PRIZE: "Premio",
  REFUND: "Reintegro",
};

export function walletMethodLabel(method: TopupMethod | null) {
  return method ? METHOD_LABELS[method] ?? "Otro canal" : "Cuenta quinie.LA";
}

export function walletMovementLabel(type: WalletMovementType) {
  return MOVEMENT_LABELS[type] ?? "Movimiento";
}

export function walletChannelForMethod(method: TopupMethod | null): WalletChannel | null {
  if (method === "CARD") return "card";
  if (method === "QR") return "qr";
  if (method === "CASH_POINT" || method === "PUNTO_RECARGA") return "cash";
  if (method === "TIGO" || method === "CLARO" || method === "PERSONAL") return "phone";
  return null;
}

export function walletReference(movement: WalletMovement) {
  return movement.referenceId || movement.id;
}

export function walletDate(value: string, part: "date" | "time" = "date") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-PY", {
    ...(part === "date" ? { day: "2-digit", month: "short", year: "numeric" } as const : { hour: "2-digit", minute: "2-digit" } as const),
    timeZone: "America/Asuncion",
  }).format(date);
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function filterWalletMovements(
  movements: readonly WalletMovement[],
  { type = "ALL", method = "ALL", period = "ALL", query = "" }: {
    type?: MovementFilter;
    method?: TopupMethod | "ALL";
    period?: MovementPeriod;
    query?: string;
  } = {},
  now = Date.now(),
) {
  const search = normalizeSearch(query);
  const cutoff = period === "ALL" ? null : now - (period === "7D" ? 7 : 30) * 86_400_000;
  return movements.filter((movement) => {
    if (type === "OTHER" && (movement.type === "TOPUP" || movement.type === "WITHDRAWAL")) return false;
    if (type !== "ALL" && type !== "OTHER" && movement.type !== type) return false;
    if (method !== "ALL" && movement.method !== method && !(method === "CASH_POINT" && movement.method === "PUNTO_RECARGA")) return false;
    if (cutoff !== null && !(new Date(movement.createdAt).getTime() >= cutoff)) return false;
    if (search && !normalizeSearch(`${walletMovementLabel(movement.type)} ${walletMethodLabel(movement.method)} ${walletReference(movement)} ${movement.id}`).includes(search)) return false;
    return true;
  }).sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
}

export function summarizeWalletMovements(movements: readonly WalletMovement[]) {
  return movements.reduce((summary, movement) => {
    if (movement.type === "TOPUP") {
      summary.deposits += movement.amount;
      summary.depositCount += 1;
    } else if (movement.type === "WITHDRAWAL") {
      summary.withdrawals += Math.abs(movement.amount);
      summary.withdrawalCount += 1;
    }
    return summary;
  }, { deposits: 0, withdrawals: 0, depositCount: 0, withdrawalCount: 0 });
}

/** Accept only whole guaraní amounts; never silently turn decimals into larger amounts. */
export function parseWalletAmount(value: string): number | null {
  const input = value.trim();
  if (!/^\d+$/.test(input) && !/^\d{1,3}(?:\.\d{3})+$/.test(input)) return null;
  const amount = Number(input.replaceAll(".", ""));
  return Number.isSafeInteger(amount) ? amount : null;
}

export function walletAmountError(value: string, operation: WalletOperation, balance: number): string | null {
  const amount = parseWalletAmount(value);
  if (amount === null) return "Ingresá un importe entero en guaraníes, sin decimales.";
  if (amount < WALLET_MIN_AMOUNT) return "El importe mínimo es Gs. 10.000.";
  if (amount > WALLET_MAX_AMOUNT) return "El importe máximo por operación es Gs. 5.000.000.";
  if (operation === "withdrawal" && amount > balance) return "El importe supera tu saldo disponible. Elegí un monto menor.";
  return null;
}
