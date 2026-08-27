// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TopupMethod, WalletMovement } from "@/lib/gaming/types";
import type { WalletChannel, WalletOperation } from "@/features/product/balance-data";

const { useProductMock, requestTopUpMock, requestWithdrawalMock } = vi.hoisted(() => ({
  useProductMock: vi.fn(),
  requestTopUpMock: vi.fn(),
  requestWithdrawalMock: vi.fn(),
}));

vi.mock("@/providers/product-provider", () => ({ useProduct: useProductMock }));

import { BalanceOperationForm } from "@/features/product/balance-operation-form";
import { BalanceClient } from "@/features/product/balance-client";

const session = {
  id: "wallet-player",
  displayName: "Ana",
  role: "PLAYER" as const,
  balance: 120_000,
  currency: "PYG" as const,
};

function response(operation: WalletOperation, amount = 50_000, method: TopupMethod = "CARD") {
  const signedAmount = operation === "deposit" ? amount : -amount;
  const balance = session.balance + signedAmount;
  const balanceEntry: WalletMovement = {
    id: "movement-confirmed",
    type: operation === "deposit" ? "TOPUP" : "WITHDRAWAL",
    amount: signedAmount,
    currency: "PYG",
    balanceAfter: balance,
    referenceId: "QL-RECEIPT-1001",
    method,
    createdAt: "2026-08-27T15:00:00.000Z",
  };
  return { session: { ...session, balance }, balanceEntry, replayed: false };
}

const baseState = {
  session,
  loading: false,
  error: null,
  unauthorized: false,
  movements: [] as WalletMovement[],
  movementsLoading: false,
  movementsError: null,
  walletAvailable: true,
  withdrawalAvailable: true,
  gatewayMode: "preview",
  refresh: vi.fn(),
  refreshMovements: vi.fn(),
  requestTopUp: requestTopUpMock,
  requestWithdrawal: requestWithdrawalMock,
  getPendingWalletOperationKey: () => undefined,
};

function renderOperation(operation: WalletOperation = "deposit", initialChannel?: WalletChannel) {
  const onBusyChange = vi.fn();
  const onComplete = vi.fn();
  const onDone = vi.fn();
  const user = userEvent.setup();
  const view = render(<BalanceOperationForm
    operation={operation}
    initialChannel={initialChannel}
    onBusyChange={onBusyChange}
    onComplete={onComplete}
    onDone={onDone}
  />);
  return { ...view, user, onBusyChange, onComplete, onDone };
}

const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;

beforeAll(() => {
  window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame = (frame) => window.clearTimeout(frame);
});

afterAll(() => {
  window.requestAnimationFrame = originalRequestAnimationFrame;
  window.cancelAnimationFrame = originalCancelAnimationFrame;
});

beforeEach(() => {
  useProductMock.mockReset();
  requestTopUpMock.mockReset();
  requestWithdrawalMock.mockReset();
  requestTopUpMock.mockImplementation(async ({ amount, method }) => response("deposit", amount, method));
  requestWithdrawalMock.mockImplementation(async ({ amount, method }) => response("withdrawal", amount, method));
  useProductMock.mockReturnValue(baseState);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

afterEach(cleanup);

describe.each(["deposit", "withdrawal"] as const)("operación de saldo: %s", (operation) => {
  const isDeposit = operation === "deposit";
  const confirmLabel = isDeposit ? "Confirmar depósito" : "Confirmar retiro";
  const successLabel = isDeposit ? "Depósito realizado" : "Retiro realizado";

  it.each([
    { channel: "Tarjeta", method: "CARD", operator: null },
    { channel: "QR", method: "QR", operator: null },
    { channel: "Efectivo", method: "CASH_POINT", operator: null },
    { channel: "Telefonía", method: "TIGO", operator: "Tigo" },
    { channel: "Telefonía", method: "CLARO", operator: "Claro" },
    { channel: "Telefonía", method: "PERSONAL", operator: "Personal" },
  ] as const)("confirma por $method sólo después de revisar y muestra el comprobante devuelto", async ({ channel, method, operator }) => {
    const { user, onComplete, onDone } = renderOperation(operation);
    const request = isDeposit ? requestTopUpMock : requestWithdrawalMock;
    const otherRequest = isDeposit ? requestWithdrawalMock : requestTopUpMock;

    await user.click(screen.getByRole("radio", { name: channel }));
    if (operator) await user.click(screen.getByRole("radio", { name: operator }));
    expect(request).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByRole("heading", { name: isDeposit ? "Revisá tu depósito" : "Revisá tu retiro" })).toBeTruthy();
    expect(screen.getByText(operator ?? channel, { selector: "dd" })).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: confirmLabel }));

    expect(request).toHaveBeenCalledExactlyOnceWith({ amount: 50_000, method }, expect.any(String));
    expect(otherRequest).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: successLabel })).toBeTruthy();
    expect(screen.getByText("QL-RECEIPT-1001")).toBeTruthy();
    expect(screen.getByText(isDeposit ? "+Gs. 50.000" : "−Gs. 50.000")).toBeTruthy();
    expect(onComplete).toHaveBeenCalledExactlyOnceWith(response(operation, 50_000, method).balanceEntry);
    expect(document.body.textContent).not.toMatch(/\bdemo\b|\bpruebas?\b|fixture/i);
    expect(screen.queryByLabelText(/número de tarjeta|CVV|PIN/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Ver movimientos" }));
    expect(onDone).toHaveBeenCalledOnce();
  });
});

describe("validación y seguridad de las operaciones", () => {
  it.each([
    ["10.5", "sin decimales"],
    ["10,5", "sin decimales"],
    ["9.999", "mínimo"],
    ["5.000.001", "máximo"],
  ])("impide avanzar con el importe %s y asocia el error al campo", async (amount, message) => {
    const { user } = renderOperation();
    const input = screen.getByRole("textbox", { name: "Importe a cargar" });
    await user.clear(input);
    await user.type(input, amount);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(message);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole("button", { name: "Confirmar depósito" })).toBeNull();
    expect(requestTopUpMock).not.toHaveBeenCalled();
  });

  it("limita las sugerencias de retiro al saldo y permite usar el saldo exacto", async () => {
    const { user } = renderOperation("withdrawal");
    const input = screen.getByRole("textbox", { name: "Importe a retirar" }) as HTMLInputElement;
    expect((screen.getByRole("button", { name: "Gs. 200.000" }) as HTMLButtonElement).disabled).toBe(true);
    await user.clear(input);
    await user.type(input, "120.001");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert").textContent).toContain("saldo disponible");
    expect(requestWithdrawalMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Usar máximo" }));
    expect(input.value).toBe("120.000");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar retiro" }));
    expect(requestWithdrawalMock).toHaveBeenCalledExactlyOnceWith({ amount: 120_000, method: "CARD" }, expect.any(String));
    expect(await screen.findByText("Gs. 0")).toBeTruthy();
  });

  it.each(["deposit", "withdrawal"] as const)("bloquea envíos repetidos de %s y la edición mientras espera una respuesta", async (operation) => {
    let resolveRequest!: (value: ReturnType<typeof response>) => void;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => { resolveRequest = resolve; });
    const request = operation === "deposit" ? requestTopUpMock : requestWithdrawalMock;
    request.mockReturnValue(pending);
    const { user, onBusyChange, onComplete, container } = renderOperation(operation);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    const form = container.querySelector("form")!;

    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(request).toHaveBeenCalledOnce();
    expect(form.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "Procesando…" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Volver" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    await act(async () => resolveRequest(response(operation)));

    expect(await screen.findByRole("heading", { name: operation === "deposit" ? "Depósito realizado" : "Retiro realizado" })).toBeTruthy();
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it.each(["deposit", "withdrawal"] as const)("reintenta %s con la misma clave y oculta detalles internos", async (operation) => {
    const request = operation === "deposit" ? requestTopUpMock : requestWithdrawalMock;
    const confirmLabel = operation === "deposit" ? "Confirmar depósito" : "Confirmar retiro";
    const successLabel = operation === "deposit" ? "Depósito realizado" : "Retiro realizado";
    request.mockRejectedValueOnce(new Error("private connector response token=secret"));
    const { user } = renderOperation(operation);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: confirmLabel }));
    expect((await screen.findByRole("alert")).textContent).toContain("sin duplicar");
    expect(document.body.textContent).not.toContain("token=secret");
    expect(screen.queryByRole("heading", { name: successLabel })).toBeNull();
    const firstKey = request.mock.calls[0][1];

    await user.click(screen.getByRole("button", { name: confirmLabel }));
    expect(await screen.findByRole("heading", { name: successLabel })).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][1]).toBe(firstKey);
  });

  it("crea otra clave cuando el usuario modifica una operación que falló", async () => {
    requestTopUpMock.mockRejectedValueOnce(new Error("request failed"));
    const { user } = renderOperation();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar depósito" }));
    await screen.findByRole("alert");
    const firstKey = requestTopUpMock.mock.calls[0][1];
    await user.click(screen.getByRole("button", { name: "Volver" }));
    await user.click(screen.getByRole("radio", { name: "QR" }));
    await user.click(screen.getByRole("button", { name: "Gs. 20.000" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar depósito" }));

    expect(await screen.findByRole("heading", { name: "Depósito realizado" })).toBeTruthy();
    expect(requestTopUpMock.mock.calls[1][0]).toEqual({ amount: 20_000, method: "QR" });
    expect(requestTopUpMock.mock.calls[1][1]).not.toBe(firstKey);
  });

  it("informa un saldo rechazado por el servidor sin inventar un retiro exitoso", async () => {
    requestWithdrawalMock.mockRejectedValueOnce({ code: "INSUFFICIENT_BALANCE", message: "private balance" });
    const { user, onComplete } = renderOperation("withdrawal");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar retiro" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Tu saldo cambió");
    expect(document.body.textContent).not.toContain("private balance");
    expect(screen.queryByRole("heading", { name: "Retiro realizado" })).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("mantiene la clave al reintentar el mismo monto escrito sin separador de miles", async () => {
    requestTopUpMock.mockRejectedValueOnce(new Error("response interrupted"));
    const { user } = renderOperation();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar depósito" }));
    await screen.findByRole("alert");
    const firstKey = requestTopUpMock.mock.calls[0][1];
    await user.click(screen.getByRole("button", { name: "Volver" }));
    const input = screen.getByRole("textbox", { name: "Importe a cargar" });
    await user.clear(input);
    await user.type(input, "50000");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar depósito" }));

    expect(await screen.findByRole("heading", { name: "Depósito realizado" })).toBeTruthy();
    expect(requestTopUpMock.mock.calls[1]).toEqual([{ amount: 50_000, method: "CARD" }, firstKey]);
  });

  it("recupera la clave inicial al volver al mismo canal después de intentar otro", async () => {
    requestWithdrawalMock.mockRejectedValueOnce(new Error("first response interrupted"));
    requestWithdrawalMock.mockRejectedValueOnce(new Error("second response interrupted"));
    const { user } = renderOperation("withdrawal");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar retiro" }));
    await screen.findByRole("alert");
    const originalKey = requestWithdrawalMock.mock.calls[0][1];
    await user.click(screen.getByRole("button", { name: "Volver" }));
    await user.click(screen.getByRole("radio", { name: "QR" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar retiro" }));
    await screen.findByRole("alert");
    expect(requestWithdrawalMock.mock.calls[1][1]).not.toBe(originalKey);
    await user.click(screen.getByRole("button", { name: "Volver" }));
    await user.click(screen.getByRole("radio", { name: "Tarjeta" }));
    await user.click(screen.getByRole("button", { name: "Gs. 50.000" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar retiro" }));

    expect(await screen.findByRole("heading", { name: "Retiro realizado" })).toBeTruthy();
    expect(requestWithdrawalMock.mock.calls[2]).toEqual([{ amount: 50_000, method: "CARD" }, originalKey]);
  });

  it("recupera el comprobante de un retiro intentado aunque el saldo actualizado ya sea cero", async () => {
    useProductMock.mockReturnValue({ ...baseState, session: { ...session, balance: 50_000 } });
    const previous = response("withdrawal", 50_000, "CARD");
    const replay = {
      ...previous,
      session: { ...session, balance: 0 },
      balanceEntry: { ...previous.balanceEntry, balanceAfter: 0, referenceId: "RET-REPLAY-EXACT" },
      replayed: true,
    };
    requestWithdrawalMock.mockRejectedValueOnce(new Error("confirmation response interrupted"));
    requestWithdrawalMock.mockResolvedValueOnce(replay);
    const { user, rerender, onBusyChange, onComplete, onDone } = renderOperation("withdrawal");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar retiro" }));
    await screen.findByRole("alert");
    const originalKey = requestWithdrawalMock.mock.calls[0][1];
    expect(onComplete).not.toHaveBeenCalled();

    useProductMock.mockReturnValue({ ...baseState, session: { ...session, balance: 0 } });
    rerender(<BalanceOperationForm operation="withdrawal" onBusyChange={onBusyChange} onComplete={onComplete} onDone={onDone} />);
    await user.click(screen.getByRole("button", { name: "Confirmar retiro" }));

    expect(await screen.findByRole("heading", { name: "Retiro realizado" })).toBeTruthy();
    expect(requestWithdrawalMock).toHaveBeenCalledTimes(2);
    expect(requestWithdrawalMock.mock.calls[1]).toEqual([{ amount: 50_000, method: "CARD" }, originalKey]);
    expect(screen.getByText("RET-REPLAY-EXACT")).toBeTruthy();
    expect(screen.getByText("Gs. 0")).toBeTruthy();
    expect(onComplete).toHaveBeenCalledExactlyOnceWith(replay.balanceEntry);
  });

  it.each([
    { name: "sin sesión", state: { session: null }, operation: "deposit" },
    { name: "billetera no disponible", state: { walletAvailable: false }, operation: "deposit" },
    { name: "retiros no disponibles", state: { withdrawalAvailable: false }, operation: "withdrawal" },
  ] as const)("no permite enviar una operación con $name", async ({ state, operation }) => {
    useProductMock.mockReturnValue({ ...baseState, ...state });
    const { user } = renderOperation(operation);
    const button = screen.getByRole("button", { name: "Continuar" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("no está disponible");
    await user.click(button);
    expect(requestTopUpMock).not.toHaveBeenCalled();
    expect(requestWithdrawalMock).not.toHaveBeenCalled();
  });

  it("verifica otra vez el saldo si cambia entre la revisión y la confirmación", async () => {
    const { user, rerender, onBusyChange, onComplete, onDone } = renderOperation("withdrawal");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    useProductMock.mockReturnValue({ ...baseState, session: { ...session, balance: 20_000 } });
    rerender(<BalanceOperationForm operation="withdrawal" onBusyChange={onBusyChange} onComplete={onComplete} onDone={onDone} />);
    await user.click(screen.getByRole("button", { name: "Confirmar retiro" }));

    expect(screen.getByRole("textbox", { name: "Importe a retirar" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("saldo disponible");
    expect(requestWithdrawalMock).not.toHaveBeenCalled();
  });
});

const walletHistory: WalletMovement[] = [
  { ...response("deposit", 10_000, "CASH_POINT").balanceEntry, id: "old-cash", referenceId: "DEP-OLD", createdAt: "2026-07-15T15:00:00Z" },
  { ...response("deposit", 50_000, "CARD").balanceEntry, id: "deposit-card", referenceId: "DEP-CARD", createdAt: "2026-08-25T15:00:00Z" },
  { ...response("withdrawal", 20_000, "TIGO").balanceEntry, id: "withdrawal-tigo", referenceId: "RET-TIGO", createdAt: "2026-08-26T15:00:00Z" },
  { ...response("deposit", 10_000, "PUNTO_RECARGA").balanceEntry, id: "legacy-cash", referenceId: "DEP-CASH", createdAt: "2026-08-23T15:00:00Z" },
  { ...response("withdrawal", 2_000).balanceEntry, id: "stake", referenceId: "PLAY-1", type: "STAKE", method: null, createdAt: "2026-08-27T14:00:00Z" },
];

function renderBalance(state: Record<string, unknown> = {}) {
  useProductMock.mockReturnValue({ ...baseState, movements: walletHistory, ...state });
  return { ...render(<BalanceClient />), user: userEvent.setup() };
}

describe("pantalla de saldo y movimientos", () => {
  it.each(["preview", "backoffice"])("muestra saldo, depósitos y retiros diferenciados sin referencias de pruebas en %s", (gatewayMode) => {
    renderBalance({ gatewayMode });
    expect(screen.getByRole("heading", { level: 1, name: "Saldo y movimientos" })).toBeTruthy();
    expect(screen.getByLabelText("Saldo disponible: Gs. 120.000")).toBeTruthy();
    const deposits = screen.getByText("Depósitos", { selector: "p" }).closest("[data-direction]")!;
    const withdrawals = screen.getByText("Retiros", { selector: "p" }).closest("[data-direction]")!;
    expect(deposits.getAttribute("data-direction")).toBe("deposit");
    expect(within(deposits as HTMLElement).getByText("Gs. 70.000")).toBeTruthy();
    expect(within(deposits as HTMLElement).getByText("3 operaciones")).toBeTruthy();
    expect(withdrawals.getAttribute("data-direction")).toBe("withdrawal");
    expect(within(withdrawals as HTMLElement).getByText("Gs. 20.000")).toBeTruthy();
    const history = screen.getByRole("list", { name: "Historial de movimientos" });
    const rows = within(history).getAllByRole("button");
    expect(rows.map((row) => row.getAttribute("data-movement-type"))).toEqual(["STAKE", "WITHDRAWAL", "TOPUP", "TOPUP", "TOPUP"]);
    expect(within(rows[1]).getByText("−Gs. 20.000")).toBeTruthy();
    expect(within(rows[2]).getByText("+Gs. 50.000")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\bdemo\b|\bpruebas?\b|fixture/i);
  });

  it("abre telefonía con su opción seleccionada y devuelve el foco al cerrar", async () => {
    const { user } = renderBalance();
    const channel = screen.getByRole("button", { name: "Cargar saldo por telefonía" });
    await user.click(channel);
    const dialog = screen.getByRole("dialog", { name: "Cargar saldo" });
    expect((within(dialog).getByRole("radio", { name: "Telefonía" }) as HTMLInputElement).checked).toBe(true);
    expect(within(dialog).getAllByRole("radio").map((radio) => radio.getAttribute("value")))
      .toEqual(["card", "qr", "cash", "phone", "TIGO", "CLARO", "PERSONAL"]);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(channel);
    expect(requestTopUpMock).not.toHaveBeenCalled();
  });

  it("conserva abierto el modal durante el envío y actualiza saldo e historial con la respuesta", async () => {
    let resolveRequest!: (value: ReturnType<typeof response>) => void;
    requestTopUpMock.mockReturnValue(new Promise<ReturnType<typeof response>>((resolve) => { resolveRequest = resolve; }));
    const { user } = renderBalance();
    await user.click(screen.getByRole("button", { name: "Cargar saldo" }));
    const dialog = screen.getByRole("dialog", { name: "Cargar saldo" });
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Confirmar depósito" }));
    expect((within(dialog).getByRole("button", { name: "Cerrar" }) as HTMLButtonElement).disabled).toBe(true);
    await user.keyboard("{Escape}");
    fireEvent.mouseDown(dialog.previousElementSibling!);
    expect(screen.getByRole("dialog", { name: "Cargar saldo" })).toBe(dialog);
    expect(requestTopUpMock).toHaveBeenCalledOnce();

    const result = response("deposit");
    useProductMock.mockReturnValue({ ...baseState, session: result.session, movements: [result.balanceEntry, ...walletHistory] });
    await act(async () => resolveRequest(result));
    expect(await within(dialog).findByRole("heading", { name: "Depósito realizado" })).toBeTruthy();
    expect(screen.getByLabelText("Saldo disponible: Gs. 170.000")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Ver movimientos" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const history = screen.getByRole("list", { name: "Historial de movimientos" });
    expect(within(history).getAllByRole("button")).toHaveLength(6);
    await waitFor(() => expect(document.activeElement?.id).toBe("wallet-movements-title"));
  });

  it("cierra una operación al cambiar de cuenta y no expone su importe a la siguiente sesión", async () => {
    const { user, rerender } = renderBalance();
    await user.click(screen.getByRole("button", { name: "Retirar saldo" }));
    expect(screen.getByRole("dialog", { name: "Retirar saldo" })).toBeTruthy();
    useProductMock.mockReturnValue({ ...baseState, session: { ...session, id: "another-player", balance: 0 }, movements: [] });
    rerender(<BalanceClient />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Saldo disponible: Gs. 0")).toBeTruthy();
    expect(requestWithdrawalMock).not.toHaveBeenCalled();
  });

  it("mantiene saldo e historial sin cifras inventadas mientras carga", () => {
    renderBalance({ loading: true, movementsLoading: true });
    expect(screen.getByLabelText("Saldo disponible: no disponible")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Cargando movimientos" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Historial de movimientos" })).toBeNull();
    expect((screen.getByRole("button", { name: "Cargar saldo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Retirar saldo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([
    { session: null, unauthorized: false },
    { session, unauthorized: true },
  ])("no muestra datos anteriores ni permite operar sin autenticación válida: %j", (state) => {
    renderBalance(state);
    expect(screen.getByLabelText("Saldo disponible: no disponible")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Historial de movimientos" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ir a mi cuenta" }).getAttribute("href")).toBe("/cuenta");
    expect((screen.getByRole("button", { name: "Cargar saldo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Retirar saldo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("ofrece reintentar la conexión sin mostrar errores internos ni saldo anterior", async () => {
    const { user } = renderBalance({ error: "private connection token=secret" });
    const connectionAlert = screen.getByText("No pudimos consultar tu saldo. Revisá la conexión e intentá nuevamente.").closest("[role='alert']") as HTMLElement;
    expect(connectionAlert).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No pudimos cargar tus movimientos" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Ir a mi cuenta" })).toBeNull();
    expect(document.body.textContent).not.toContain("token=secret");
    expect(screen.getByLabelText("Saldo disponible: no disponible")).toBeTruthy();
    await user.click(within(connectionAlert).getByRole("button", { name: "Reintentar" }));
    expect(baseState.refresh).toHaveBeenCalledOnce();
  });

  it("conserva el comprobante confirmado cuando falla actualizar el saldo de una operación repetida", async () => {
    const { user } = renderBalance();
    const result = { ...response("deposit"), replayed: true };
    requestTopUpMock.mockImplementationOnce(async () => {
      useProductMock.mockReturnValue({ ...baseState, error: "private refresh error", movements: walletHistory });
      return result;
    });
    await user.click(screen.getByRole("button", { name: "Cargar saldo" }));
    const dialog = screen.getByRole("dialog", { name: "Cargar saldo" });
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Confirmar depósito" }));

    expect(await within(dialog).findByRole("heading", { name: "Depósito realizado" })).toBeTruthy();
    expect(within(dialog).getByText("QL-RECEIPT-1001")).toBeTruthy();
    expect(within(dialog).getByText("Gs. 170.000")).toBeTruthy();
    expect(screen.getByLabelText("Saldo disponible: no disponible")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Ir a mi cuenta" })).toBeNull();
    expect(document.body.textContent).not.toContain("private refresh error");
    await user.click(within(dialog).getByRole("button", { name: "Ver movimientos" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "No pudimos cargar tus movimientos" })).toBeTruthy();
  });

  it("distingue un error al cargar movimientos y permite actualizar sin perder el saldo", async () => {
    const { user } = renderBalance({ movementsError: "private history error" });
    expect(screen.getByRole("alert").textContent).toContain("No pudimos cargar tus movimientos");
    expect(screen.getByLabelText("Saldo disponible: Gs. 120.000")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Historial de movimientos" })).toBeNull();
    expect(document.body.textContent).not.toContain("private history error");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(baseState.refreshMovements).toHaveBeenCalledOnce();
  });

  it("permite cargar cuando sólo los retiros no están habilitados", () => {
    renderBalance({ withdrawalAvailable: false });
    expect((screen.getByRole("button", { name: "Cargar saldo" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Retirar saldo" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Los retiros no están disponibles en este momento.")).toBeTruthy();
  });

  it("no ofrece operaciones ni historial cuando la billetera no está disponible", () => {
    renderBalance({ walletAvailable: false });
    expect((screen.getByRole("button", { name: "Cargar saldo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Retirar saldo" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("heading", { name: "El historial no está disponible" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Historial de movimientos" })).toBeNull();
    for (const button of screen.getAllByRole("button", { name: /Cargar saldo por/ })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("muestra un historial vacío real y permite iniciar el primer depósito", async () => {
    const { user } = renderBalance({ movements: [] });
    expect(screen.getByRole("heading", { name: "Tu historial empieza acá" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Historial de movimientos" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Hacer un depósito" }));
    expect(screen.getByRole("dialog", { name: "Cargar saldo" })).toBeTruthy();
    expect(requestTopUpMock).not.toHaveBeenCalled();
  });

  it("filtra por tipo, canal, período y búsqueda y permite limpiar los filtros", async () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-08-27T15:00:00Z").getTime());
    const { user } = renderBalance();
    const rows = () => within(screen.getByRole("list", { name: "Historial de movimientos" })).getAllByRole("button");
    await user.click(screen.getByRole("button", { name: "Depósitos" }));
    expect(rows()).toHaveLength(3);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por canal" }), "CASH_POINT");
    expect(rows()).toHaveLength(2);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por período" }), "7D");
    expect(rows()).toHaveLength(1);
    await user.type(screen.getByRole("searchbox", { name: "Buscar movimientos" }), "efectívo");
    expect(rows()).toHaveLength(1);
    await user.clear(screen.getByRole("searchbox", { name: "Buscar movimientos" }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar movimientos" }), "no existe");
    expect(screen.getByRole("heading", { name: "No encontramos movimientos" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(rows()).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Todos" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("combobox", { name: "Filtrar por canal" }) as HTMLSelectElement).value).toBe("ALL");
    expect((screen.getByRole("combobox", { name: "Filtrar por período" }) as HTMLSelectElement).value).toBe("ALL");
  });

  it("abre el detalle de un retiro con referencia, signo y saldo y devuelve el foco a la fila", async () => {
    const { user } = renderBalance();
    const row = screen.getByRole("button", { name: "Ver detalle: Retiro, Tigo, Gs. 20.000" });
    await user.click(row);
    const dialog = screen.getByRole("dialog", { name: "Detalle del movimiento" });
    expect(within(dialog).getByRole("heading", { name: "Retiro" })).toBeTruthy();
    expect(within(dialog).getByText("RET-TIGO")).toBeTruthy();
    expect(within(dialog).getByText("−Gs. 20.000")).toBeTruthy();
    expect(within(dialog).getByText("Gs. 100.000")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Cerrar detalle" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it("pagina sin perder movimientos, vuelve al inicio al filtrar y se ajusta si disminuye el historial", async () => {
    const movements = Array.from({ length: 9 }, (_, index): WalletMovement => ({
      ...response("deposit", 10_000 + index, "QR").balanceEntry,
      id: `page-${index}`,
      referenceId: `DEP-PAGE-${index}`,
      createdAt: new Date(Date.UTC(2026, 7, 27 - index, 15)).toISOString(),
    }));
    const { user, rerender } = renderBalance({ movements });
    const rows = () => within(screen.getByRole("list", { name: "Historial de movimientos" })).getAllByRole("button");
    expect(rows()).toHaveLength(8);
    expect((screen.getByRole("button", { name: "Página anterior" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(rows()).toHaveLength(1);
    expect(rows()[0].getAttribute("aria-label")).toContain("Gs. 10.008");
    expect((screen.getByRole("button", { name: "Página siguiente" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Depósitos" }));
    expect(rows()).toHaveLength(8);
    expect((screen.getByRole("button", { name: "Página anterior" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    useProductMock.mockReturnValue({ ...baseState, movements: movements.slice(0, 1) });
    rerender(<BalanceClient />);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].getAttribute("aria-label")).toContain("Gs. 10.000");
    expect(screen.queryByRole("navigation", { name: "Páginas de movimientos" })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("1–1 de 1 movimiento filtrado");
  });
});
