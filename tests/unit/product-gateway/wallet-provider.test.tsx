// @vitest-environment jsdom

import type { PropsWithChildren } from "react";
import { act, cleanup, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BalanceClient } from "@/features/product/balance-client";
import { MockGamingProvider } from "@/lib/gaming/mock-provider";
import type { WalletMovement } from "@/lib/gaming/types";
import type { MockSession } from "@/lib/product/api-types";
import {
  createFixtureProductGateway,
  ProductGatewayHttpError,
  ProductOperationSupersededError,
  type ProductGateway,
  type ProductGatewayMutationOptions,
  type ProductSnapshot,
  type ProductTopUpInput,
  type ProductTopUpResponse,
} from "@/lib/product/gateway";
import { ProductProvider, useProduct, type ProductContextValue } from "@/providers/product-provider";

const session: MockSession = {
  id: "wallet-session", displayName: "Ana Guardada", role: "PLAYER", balance: 50_000, currency: "PYG",
};
const snapshot: ProductSnapshot = {
  session, catalog: { amounts: [500], draws: [], traditional: [], instant: [] }, plays: [], results: [],
};
const deposit: ProductTopUpResponse = {
  session: { ...session, displayName: "Nombre anterior", balance: 70_000 },
  balanceEntry: {
    id: "deposit-1", type: "TOPUP", amount: 20_000, currency: "PYG", balanceAfter: 70_000,
    referenceId: "DEP-1", method: "QR", createdAt: "2026-08-27T12:00:00.000Z",
  },
  replayed: false,
};
const withdrawal: ProductTopUpResponse = {
  session: { ...session, displayName: "Nombre anterior", balance: 40_000 },
  balanceEntry: {
    id: "withdrawal-1", type: "WITHDRAWAL", amount: -10_000, currency: "PYG", balanceAfter: 40_000,
    referenceId: "RET-1", method: "TIGO", createdAt: "2026-08-27T12:05:00.000Z",
  },
  replayed: false,
};
const depositInput = { amount: 20_000, method: "QR" } as const;
const withdrawalInput = { amount: 10_000, method: "TIGO" } as const;

function gatewayFixture() {
  return createFixtureProductGateway({
    bootstrap: snapshot, login: { session }, register: { session }, results: [],
    movements: [], topUp: deposit, withdrawal,
  });
}

function renderProduct(gateway: ProductGateway) {
  return renderHook(() => useProduct(), {
    wrapper: ({ children }: PropsWithChildren) => <ProductProvider gateway={gateway}>{children}</ProductProvider>,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProductProvider wallet", () => {
  it("updates deposit and withdrawal balances immediately without replacing profile fields or refetching history", async () => {
    const gateway = gatewayFixture();
    const movements = vi.spyOn(gateway, "getMovements");
    const { result } = renderProduct(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));
    const refreshMovements = result.current.refreshMovements;

    await act(async () => { await result.current.requestTopUp(depositInput, "deposit-key"); });
    expect(result.current.session).toEqual({ ...session, balance: 70_000 });
    expect(result.current.movements).toEqual([deposit.balanceEntry]);

    const nextWithdrawal = {
      ...withdrawal,
      session: { ...withdrawal.session, balance: 60_000 },
      balanceEntry: { ...withdrawal.balanceEntry, balanceAfter: 60_000 },
    };
    vi.spyOn(gateway, "withdraw").mockResolvedValue(nextWithdrawal);
    await act(async () => { await result.current.requestWithdrawal(withdrawalInput, "withdrawal-key"); });

    expect(result.current.session).toEqual({ ...session, balance: 60_000 });
    expect(result.current.movements).toEqual([nextWithdrawal.balanceEntry, deposit.balanceEntry]);
    expect(result.current.refreshMovements).toBe(refreshMovements);
    expect(result.current.withdrawalAvailable).toBe(true);
    expect(movements).toHaveBeenCalledOnce();
  });

  it("deduplicates double submissions and serializes withdrawals with deposits", async () => {
    const gateway = gatewayFixture();
    const pendingWithdrawal = deferred<ProductTopUpResponse>();
    const withdraw = vi.spyOn(gateway, "withdraw").mockReturnValue(pendingWithdrawal.promise);
    const topUp = vi.spyOn(gateway, "topUp");
    const { result } = renderProduct(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));

    const first = result.current.requestWithdrawal(withdrawalInput, "same-receipt");
    const duplicate = result.current.requestWithdrawal(withdrawalInput, "same-receipt");
    const queuedDeposit = result.current.requestTopUp(depositInput, "next-receipt");
    expect(first).toBe(duplicate);
    await waitFor(() => expect(withdraw).toHaveBeenCalledOnce());
    expect(topUp).not.toHaveBeenCalled();

    await act(async () => {
      pendingWithdrawal.resolve(withdrawal);
      await Promise.all([first, duplicate, queuedDeposit]);
    });
    expect(topUp).toHaveBeenCalledOnce();
    expect(withdraw.mock.calls[0][1]?.idempotencyKey).toBe("same-receipt");
    expect(withdraw.mock.calls[0][1]?.expectedSessionId).toBe(session.id);
    expect(topUp.mock.calls[0][1]?.idempotencyKey).toBe("next-receipt");
    expect(topUp.mock.calls[0][1]?.expectedSessionId).toBe(session.id);
    expect(result.current.movements).toEqual([deposit.balanceEntry, withdrawal.balanceEntry]);
  });

  it("reuses an automatic idempotency key after a failed withdrawal and keeps money unchanged on failure", async () => {
    const gateway = gatewayFixture();
    const withdraw = vi.spyOn(gateway, "withdraw")
      .mockRejectedValueOnce(new ProductGatewayHttpError(0, "GATEWAY_TIMEOUT", "Intentá nuevamente."))
      .mockResolvedValueOnce(withdrawal);
    const { result } = renderProduct(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.requestWithdrawal(withdrawalInput)).rejects.toMatchObject({ code: "GATEWAY_TIMEOUT" });
    });
    expect(result.current.session).toEqual(session);
    expect(result.current.movements).toEqual([]);

    await act(async () => { await result.current.requestWithdrawal(withdrawalInput); });
    const firstKey = withdraw.mock.calls[0][1]?.idempotencyKey;
    expect(firstKey).toBeTruthy();
    expect(withdraw.mock.calls[1][1]?.idempotencyKey).toBe(firstKey);
    expect(result.current.session?.balance).toBe(40_000);
  });

  it("preserves accepted movements when an older history read finishes late", async () => {
    const gateway = gatewayFixture();
    const history = deferred<readonly WalletMovement[]>();
    vi.spyOn(gateway, "getMovements").mockReturnValueOnce(history.promise);
    const { result } = renderProduct(gateway);
    await waitFor(() => expect(result.current.session?.id).toBe(session.id));

    await act(async () => { await result.current.requestWithdrawal(withdrawalInput); });
    expect(result.current.movements).toEqual([withdrawal.balanceEntry]);
    await act(async () => { history.resolve([]); await history.promise; });

    expect(result.current.session?.balance).toBe(40_000);
    expect(result.current.movements).toEqual([withdrawal.balanceEntry]);
    expect(result.current.movementsLoading).toBe(false);
  });

  it("recovers an unresolved key even if a remounted caller proposes a new one, then releases it after success", async () => {
    const gateway = gatewayFixture();
    const withdraw = vi.spyOn(gateway, "withdraw")
      .mockRejectedValueOnce(new ProductGatewayHttpError(0, "GATEWAY_TIMEOUT", "Intentá nuevamente."))
      .mockResolvedValue(withdrawal);
    const { result } = renderProduct(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.requestWithdrawal(withdrawalInput, "original-dialog-key")).rejects.toMatchObject({ code: "GATEWAY_TIMEOUT" });
    });
    expect(result.current.getPendingWalletOperationKey("withdrawal", withdrawalInput)).toBe("original-dialog-key");

    await act(async () => { await result.current.requestWithdrawal(withdrawalInput, "reopened-dialog-key"); });
    expect(withdraw.mock.calls[1][1]?.idempotencyKey).toBe("original-dialog-key");
    expect(result.current.getPendingWalletOperationKey("withdrawal", withdrawalInput)).toBeUndefined();

    await act(async () => { await result.current.requestWithdrawal(withdrawalInput, "new-confirmed-operation"); });
    expect(withdraw.mock.calls[2][1]?.idempotencyKey).toBe("new-confirmed-operation");
  });

  it("rejects a receipt for another session without applying money or history", async () => {
    const gateway = gatewayFixture();
    vi.spyOn(gateway, "withdraw").mockResolvedValue({
      ...withdrawal, session: { ...withdrawal.session, id: "another-account" },
    });
    const { result } = renderProduct(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.requestWithdrawal(withdrawalInput)).rejects.toMatchObject({ code: "INVALID_GATEWAY_RESPONSE" });
    });
    expect(result.current.session).toEqual(session);
    expect(result.current.movements).toEqual([]);
  });

  it.each(["logout", "refresh"] as const)("discards a late withdrawal after %s changes the active session", async (transition) => {
    const gateway = gatewayFixture();
    const pending = deferred<ProductTopUpResponse>();
    const withdraw = vi.spyOn(gateway, "withdraw").mockReturnValue(pending.promise);
    const bootstrap = vi.spyOn(gateway, "bootstrap");
    const { result } = renderProduct(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));
    const request = result.current.requestWithdrawal(withdrawalInput);
    const rejected = expect(request).rejects.toBeInstanceOf(ProductOperationSupersededError);
    await waitFor(() => expect(withdraw).toHaveBeenCalledOnce());

    const nextSession = { ...session, id: "new-wallet-session", balance: 90_000 };
    await act(async () => {
      if (transition === "logout") {
        await result.current.logout();
      } else {
        bootstrap.mockResolvedValue({ ...snapshot, session: nextSession });
        await result.current.refresh();
      }
      pending.resolve(withdrawal);
      await rejected;
    });

    expect(result.current.session).toEqual(transition === "logout" ? null : nextSession);
    expect(result.current.movements).toEqual([]);
  });

  it("does not apply a replayed historical balance while an authoritative refresh is pending", async () => {
    const gateway = gatewayFixture();
    const latest = deferred<ProductSnapshot>();
    const bootstrap = vi.spyOn(gateway, "bootstrap");
    vi.spyOn(gateway, "withdraw").mockResolvedValue({ ...withdrawal, replayed: true });
    const { result } = renderProduct(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));
    bootstrap.mockReturnValueOnce(latest.promise);

    await act(async () => { await result.current.requestWithdrawal(withdrawalInput, "retry-key"); });
    expect(result.current.session?.balance).toBe(50_000);
    expect(result.current.movements).toEqual([withdrawal.balanceEntry]);

    await act(async () => { latest.resolve({ ...snapshot, session: { ...session, balance: 80_000 } }); await latest.promise; });
    await waitFor(() => expect(result.current.session?.balance).toBe(80_000));
  });

  it("does not expire a new account when an old withdrawal returns a late 401", async () => {
    const gateway = gatewayFixture();
    const pending = deferred<ProductTopUpResponse>();
    const withdraw = vi.spyOn(gateway, "withdraw").mockReturnValue(pending.promise);
    const bootstrap = vi.spyOn(gateway, "bootstrap");
    const { result } = renderProduct(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));
    const oldRequest = result.current.requestWithdrawal;
    const request = oldRequest(withdrawalInput);
    const rejected = expect(request).rejects.toBeInstanceOf(ProductOperationSupersededError);
    await waitFor(() => expect(withdraw).toHaveBeenCalledOnce());

    const nextSession = { ...session, id: "new-wallet-session", balance: 90_000 };
    bootstrap.mockResolvedValue({ ...snapshot, session: nextSession });
    await act(async () => {
      await result.current.refresh();
      pending.reject(new ProductGatewayHttpError(401, "SESSION_EXPIRED", "Sesión vencida."));
      await rejected;
    });

    expect(result.current.session).toEqual(nextSession);
    expect(result.current.unauthorized).toBe(false);
    await expect(oldRequest(withdrawalInput)).rejects.toBeInstanceOf(ProductOperationSupersededError);
    expect(withdraw).toHaveBeenCalledOnce();
  });

  it("requires an explicit withdrawal capability even when a gateway has a withdraw method", async () => {
    const fixture = gatewayFixture();
    const withdraw = vi.spyOn(fixture, "withdraw");
    const gateway: ProductGateway = Object.assign(fixture, {
      capabilities: { wallet: true, persistentRegistration: false, withdrawal: false },
    });
    const { result } = renderProduct(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.withdrawalAvailable).toBe(false);
    await expect(result.current.requestWithdrawal(withdrawalInput)).rejects.toMatchObject({ capability: "withdrawal" });
    expect(withdraw).not.toHaveBeenCalled();
  });
});

function renderRecoverableWallet(operation: "deposit" | "withdrawal", startingBalance = 150_000) {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
  vi.stubGlobal("cancelAnimationFrame", (frame: number) => window.clearTimeout(frame));
  const server = new MockGamingProvider({ startingBalance, now: () => new Date("2026-08-27T12:00:00.000Z") });
  const serverSession = server.createSession({ displayName: "Billetera de recuperación" });
  const currentSnapshot = (): ProductSnapshot => ({
    session: server.getSession(serverSession.id), catalog: server.getCatalog(), plays: [], results: [],
  });
  const gateway = createFixtureProductGateway({
    bootstrap: currentSnapshot(), movements: [], topUp: deposit, withdrawal,
  });
  vi.spyOn(gateway, "bootstrap").mockImplementation(async () => currentSnapshot());
  vi.spyOn(gateway, "getMovements").mockImplementation(async () => server.listMovements(serverSession.id));
  const method = operation === "deposit" ? "topUp" : "withdraw";
  let loseFirstResponse = true;
  const mutation = vi.spyOn(gateway, method).mockImplementation(async (input: ProductTopUpInput, options?: ProductGatewayMutationOptions) => {
    const receipt = server[method](serverSession.id, input, options?.idempotencyKey);
    if (loseFirstResponse) {
      loseFirstResponse = false;
      throw new ProductGatewayHttpError(0, "GATEWAY_TIMEOUT", "Respuesta interrumpida.");
    }
    return receipt;
  });
  let product!: ProductContextValue;
  function ObserveProduct() { product = useProduct(); return null; }
  render(<ProductProvider gateway={gateway}><BalanceClient /><ObserveProduct /></ProductProvider>);
  return { server, sessionId: serverSession.id, mutation, user: userEvent.setup(), product: () => product };
}

describe("wallet dialog recovery with the session provider", () => {
  it.each(["deposit", "withdrawal"] as const)("recovers %s after closing the dialog and allows a new identical operation after confirmation", async (operation) => {
    const { server, sessionId, mutation, user } = renderRecoverableWallet(operation);
    const openLabel = operation === "deposit" ? "Cargar saldo" : "Retirar saldo";
    const confirmLabel = operation === "deposit" ? "Confirmar depósito" : "Confirmar retiro";
    const successLabel = operation === "deposit" ? "Depósito realizado" : "Retiro realizado";
    await waitFor(() => expect((screen.getByRole("button", { name: openLabel }) as HTMLButtonElement).disabled).toBe(false));

    const submit = async () => {
      await user.click(screen.getByRole("button", { name: openLabel }));
      await user.click(screen.getByRole("button", { name: "Continuar" }));
      await user.click(screen.getByRole("button", { name: confirmLabel }));
    };
    await submit();
    expect((await screen.findByRole("alert")).textContent).toContain("sin duplicar");
    const originalKey = mutation.mock.calls[0][1]?.idempotencyKey;
    expect(server.listMovements(sessionId)).toHaveLength(1);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cerrar" }));

    await submit();
    expect(await screen.findByRole("heading", { name: successLabel })).toBeTruthy();
    expect(mutation.mock.calls[1][1]?.idempotencyKey).toBe(originalKey);
    expect(server.listMovements(sessionId)).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Ver movimientos" }));

    await submit();
    expect(await screen.findByRole("heading", { name: successLabel })).toBeTruthy();
    expect(mutation.mock.calls[2][1]?.idempotencyKey).not.toBe(originalKey);
    expect(server.listMovements(sessionId)).toHaveLength(2);
    expect(server.getSession(sessionId).balance).toBe(operation === "deposit" ? 250_000 : 50_000);
  });

  it("recovers the original withdrawal after reopening with an authoritative zero balance", async () => {
    const { server, sessionId, mutation, user, product } = renderRecoverableWallet("withdrawal", 50_000);
    await waitFor(() => expect(product().loading).toBe(false));
    await user.click(screen.getByRole("button", { name: "Retirar saldo" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar retiro" }));
    await screen.findByRole("alert");
    const originalKey = mutation.mock.calls[0][1]?.idempotencyKey;
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cerrar" }));
    await act(async () => { await product().refresh(); });
    expect(product().session?.balance).toBe(0);

    await user.click(screen.getByRole("button", { name: "Retirar saldo" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar retiro" }));
    expect(await screen.findByRole("heading", { name: "Retiro realizado" })).toBeTruthy();
    expect(mutation.mock.calls[1][1]?.idempotencyKey).toBe(originalKey);
    expect(server.listMovements(sessionId)).toHaveLength(1);
    expect(server.getSession(sessionId).balance).toBe(0);
  });
});
