// @vitest-environment jsdom

import type { PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AccountGateway, AccountLimits, AccountSettings } from "@/lib/account/contracts";
import { buildGamingCatalog } from "@/lib/gaming";
import type { MockResult, MockSession } from "@/lib/product/api-types";
import {
  createFixtureProductGateway,
  ProductOperationSupersededError,
  type ProductGateway,
  type ProductSnapshot,
  type ProductTopUpResponse,
} from "@/lib/product/gateway";
import { ProductProvider, useProduct, type ProductContextValue } from "@/providers/product-provider";

const session: MockSession = {
  id: "account-provider-session",
  displayName: "Ana Cuenta",
  role: "PLAYER",
  balance: 25_000,
  currency: "PYG",
};
const limits: AccountLimits = { daily: 50_000, weekly: 200_000, minutes: 60 };
const settings: AccountSettings = {
  sessionId: session.id,
  scope: "session",
  sessionStartedAt: "2026-08-27T12:00:00.000Z",
  limits: null,
  pausedUntil: null,
  usage: { daily: 0, weekly: 0, minutes: 5 },
};
const snapshot: ProductSnapshot = {
  session,
  catalog: buildGamingCatalog("REFUND", new Date("2026-08-27T12:00:00.000Z")),
  plays: [],
  results: [],
};
const topUp: ProductTopUpResponse = {
  session: { ...session, balance: 45_000 },
  balanceEntry: {
    id: "account-topup",
    type: "TOPUP",
    amount: 20_000,
    currency: "PYG",
    balanceAfter: 45_000,
    referenceId: null,
    method: "CARD",
    createdAt: "2026-08-27T12:05:00.000Z",
  },
  replayed: false,
};

function accountService() {
  return {
    getSettings: vi.fn<AccountGateway["getSettings"]>()
      .mockResolvedValue(structuredClone(settings)),
    saveLimits: vi.fn<AccountGateway["saveLimits"]>()
      .mockImplementation(async (input) => ({ ...structuredClone(settings), limits: input })),
    pause: vi.fn<AccountGateway["pause"]>()
      .mockResolvedValue({ ...structuredClone(settings), pausedUntil: "2026-08-27T12:35:00.000Z" }),
    updateProfile: vi.fn<AccountGateway["updateProfile"]>()
      .mockImplementation(async (input) => ({ ...session, displayName: input.displayName })),
  };
}

function productGateway(account?: AccountGateway): ProductGateway {
  const fixture = createFixtureProductGateway({
    bootstrap: snapshot,
    login: { session },
    register: { session },
    results: [],
    movements: [],
    topUp,
  });
  return account ? Object.assign(fixture, { account }) : fixture;
}

function renderProduct(gateway: ProductGateway) {
  return renderHook(() => useProduct(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <ProductProvider gateway={gateway}>{children}</ProductProvider>
    ),
  });
}

function requireAccount(context: ProductContextValue): AccountGateway {
  if (!context.account) throw new Error("El fixture debe ofrecer la capacidad de Cuenta.");
  return context.account;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}

afterEach(cleanup);

describe("ProductProvider: capacidad de Cuenta", () => {
  it("hidrata resultados y movimientos tras registrar una preview-session del servidor", async () => {
    const gateway = productGateway(accountService());
    const registeredSession = { ...session, id: "registered-account-session" };
    const draw: MockResult = {
      id: "published-draw",
      source: "DRAW",
      gameId: "head",
      drawId: "early",
      result: "497",
      resultNumbers: ["497"],
      occurredAt: "2026-08-27T12:00:00.000Z",
    };
    const bootstrap = vi.spyOn(gateway, "bootstrap")
      .mockResolvedValueOnce({ ...snapshot, session: null })
      .mockResolvedValueOnce({ ...snapshot, session: registeredSession, results: [draw] });
    const registration = vi.spyOn(gateway, "register")
      .mockResolvedValue({ session: registeredSession, source: "preview-session" });
    const movements = vi.spyOn(gateway, "getMovements")
      .mockResolvedValue([topUp.balanceEntry]);
    const { result } = renderProduct(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(movements).not.toHaveBeenCalled();

    const input = {
      displayName: "Ana Cuenta",
      documentOrPhone: "0981000000",
      password: "clave-temporal-2026",
      acceptedTerms: true,
    };
    await act(async () => { await result.current.register(input); });

    await waitFor(() => {
      expect(result.current.session).toEqual(registeredSession);
      expect(result.current.results).toEqual([draw]);
      expect(result.current.movements).toEqual([topUp.balanceEntry]);
    });
    expect(bootstrap).toHaveBeenCalledTimes(2);
    expect(movements).toHaveBeenCalledOnce();
    expect(registration).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it("attaches the current session ID to every account operation", async () => {
    const service = accountService();
    const { result } = renderProduct(productGateway(service));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const account = requireAccount(result.current);
    const callerOptions = { expectedSessionId: "other-session" };

    await act(async () => {
      await account.getSettings(callerOptions);
      await account.saveLimits(limits, callerOptions);
      await account.pause({ durationMinutes: 30 }, callerOptions);
      await account.updateProfile({ displayName: "Ana Nueva" }, callerOptions);
    });

    const forwardedOptions = [
      service.getSettings.mock.calls[0][0],
      service.saveLimits.mock.calls[0][1],
      service.pause.mock.calls[0][1],
      service.updateProfile.mock.calls[0][1],
    ];
    for (const options of forwardedOptions) {
      expect(options?.expectedSessionId).toBe(session.id);
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      expect(options?.signal?.aborted).toBe(false);
    }
    for (const options of forwardedOptions.slice(1)) {
      expect(options?.idempotencyKey).toEqual(expect.any(String));
      expect(options?.idempotencyKey?.length).toBeGreaterThan(0);
    }
  });
  it("updates the name without replacing the current balance with a stale profile balance", async () => {
    const service = accountService();
    const { result } = renderProduct(productGateway(service));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.requestTopUp({ amount: 20_000, method: "CARD" });
    });
    expect(result.current.session?.balance).toBe(45_000);

    service.updateProfile.mockResolvedValueOnce({
      ...session,
      displayName: "Ana Actualizada",
      balance: 25_000,
    });
    await act(async () => {
      await requireAccount(result.current).updateProfile({ displayName: "Ana Actualizada" });
    });

    expect(result.current.session).toEqual({
      ...session,
      displayName: "Ana Actualizada",
      balance: 45_000,
    });
    expect(result.current.movements).toEqual([topUp.balanceEntry]);
  });

  it("does not invent account capability when the gateway does not provide it", async () => {
    const gateway = productGateway();
    const { result } = renderProduct(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.session).toEqual(session);
    expect(gateway.account).toBeUndefined();
    expect(result.current.account).toBeUndefined();
  });
  it.each(["saveLimits", "pause", "updateProfile"] as const)(
    "rejects a mismatched session and keeps the retry key for %s",
    async (method) => {
      const service = accountService();
      service.saveLimits.mockResolvedValueOnce({ ...settings, sessionId: "other-session" });
      service.pause.mockResolvedValueOnce({ ...settings, sessionId: "other-session" });
      service.updateProfile.mockResolvedValueOnce({ ...session, id: "other-session", displayName: "Wrong User" });
      const { result } = renderProduct(productGateway(service));
      await waitFor(() => expect(result.current.loading).toBe(false));

      const mutate = (): Promise<unknown> => {
        const account = requireAccount(result.current);
        if (method === "saveLimits") return account.saveLimits(limits);
        if (method === "pause") return account.pause({ durationMinutes: 30 });
        return account.updateProfile({ displayName: "Ana Actualizada" });
      };

      await act(async () => {
        await expect(mutate()).rejects.toThrow("No pudimos validar los datos de tu cuenta.");
      });
      expect(result.current.session).toEqual(session);
      expect(result.current.unauthorized).toBe(false);
      const firstKey = service[method].mock.calls[0][1]?.idempotencyKey;
      expect(firstKey).toEqual(expect.any(String));
      expect(firstKey?.length).toBeGreaterThan(0);

      await act(async () => { await mutate(); });

      expect(service[method]).toHaveBeenCalledTimes(2);
      expect(service[method].mock.calls[1][1]?.idempotencyKey).toBe(firstKey);
      expect(result.current.session?.id).toBe(session.id);
      expect(result.current.unauthorized).toBe(false);
    },
  );
  it("discards a late profile response after logout even when the service ignores abort", async () => {
    const service = accountService();
    const delayed = deferred<MockSession>();
    let requestSignal: AbortSignal | undefined;
    service.updateProfile.mockImplementation((_input, options) => {
      requestSignal = options?.signal;
      return delayed.promise;
    });
    const { result } = renderProduct(productGateway(service));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pending!: Promise<MockSession>;
    act(() => {
      pending = requireAccount(result.current).updateProfile({ displayName: "Late Profile" });
    });
    const observed = pending.then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    await waitFor(() => expect(service.updateProfile).toHaveBeenCalledOnce());

    await act(async () => { await result.current.logout(); });
    expect(requestSignal?.aborted).toBe(true);
    expect(result.current.session).toBeNull();
    expect(result.current.account).toBeUndefined();

    await act(async () => {
      delayed.resolve({ ...session, displayName: "Late Profile" });
      await observed;
    });
    const outcome = await observed;
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("A stale profile response must not succeed.");
    expect(outcome.error).toBeInstanceOf(ProductOperationSupersededError);
    expect(result.current.session).toBeNull();
    expect(result.current.account).toBeUndefined();
    expect(result.current.unauthorized).toBe(false);
  });
});
