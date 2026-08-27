// @vitest-environment jsdom

import { useState, type PropsWithChildren } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildGamingCatalog } from "@/lib/gaming";
import type { PlacePlayResponse } from "@/lib/gaming/types";
import type { PlayResponse } from "@/lib/product/api-types";
import {
  createFixtureProductGateway,
  createPreviewProductGateway,
  ProductGatewayHttpError,
  ProductOperationSupersededError,
  type ProductGateway,
  type ProductPlayCommand,
  type ProductSnapshot,
} from "@/lib/product/gateway";
import { ProductProvider, useProduct } from "@/providers/product-provider";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const session = {
  id: "preview-timeout-user",
  displayName: "Preview Timeout",
  role: "PLAYER" as const,
  balance: 25_000,
  currency: "PYG" as const,
};

const catalog = buildGamingCatalog(
  "REFUND",
  new Date("2026-08-25T12:00:00.000Z"),
);

const firstCommand = {
  kind: "instant",
  input: { gameId: "sapyaite", amount: 500, selection: "007" },
} as const satisfies ProductPlayCommand;

const secondCommand = {
  kind: "instant",
  input: { gameId: "sapyaite", amount: 500, selection: "999" },
} as const satisfies ProductPlayCommand;

function acceptedSecondPlay(): PlacePlayResponse {
  return {
    play: {
      id: "play-after-timeout",
      ticketId: "ticket-after-timeout",
      family: "INSTANT",
      gameId: "sapyaite",
      gameName: "Sapy’aite",
      selection: "999",
      drawId: null,
      amount: 500,
      currency: "PYG",
      prize: 0,
      status: "LOST",
      result: "497",
      resultNumbers: ["497"],
      ruleResult: "497",
      matches: null,
      payoutMultiplier: 0,
      createdAt: "2026-08-25T12:00:00.000Z",
    },
    ticket: {
      id: "ticket-after-timeout",
      code: "QL-AFTER-TIMEOUT",
      playId: "play-after-timeout",
      gameId: "sapyaite",
      gameName: "Sapy’aite",
      family: "INSTANT",
      selection: "999",
      drawId: null,
      amount: 500,
      currency: "PYG",
      status: "LOST",
      result: "497",
      resultNumbers: ["497"],
      ruleResult: "497",
      prize: 0,
      issuedAt: "2026-08-25T12:00:00.000Z",
    },
    session: { balance: 24_500, currency: "PYG" },
    replayed: false,
  };
}

function ProviderStateProbe() {
  const { error, loading, requestPlay, session: activeSession } = useProduct();
  const [firstResult, setFirstResult] = useState("idle");
  const [secondResult, setSecondResult] = useState("idle");

  const submitQueuedPlays = () => {
    setFirstResult("pending");
    setSecondResult("pending");
    void requestPlay(firstCommand).then(
      () => setFirstResult("unexpected-success"),
      (reason: unknown) =>
        setFirstResult(
          typeof reason === "object" && reason !== null && "code" in reason
            ? String(reason.code)
            : "unknown-error",
        ),
    );
    void requestPlay(secondCommand).then(
      (response) => setSecondResult(response.play.id),
      () => setSecondResult("unexpected-error"),
    );
  };

  return (
    <div>
      <span data-testid="provider-loading">{loading ? "loading" : "idle"}</span>
      <span data-testid="provider-error">{error ?? "no-error"}</span>
      <span>{activeSession?.displayName ?? "no-session"}</span>
      <span data-testid="first-result">{firstResult}</span>
      <span data-testid="second-result">{secondResult}</span>
      <button onClick={submitQueuedPlays} type="button">
        Encolar jugadas
      </button>
    </div>
  );
}

afterEach(cleanup);

describe("PreviewProductGateway timeout in ProductProvider", () => {
  it("clears bootstrap loading when an injected fetch never settles", async () => {
    const gateway = createPreviewProductGateway({
      fetch: vi.fn(() => new Promise<Response>(() => undefined)),
      timeoutMs: 20,
    });

    render(
      <ProductProvider gateway={gateway}>
        <ProviderStateProbe />
      </ProductProvider>,
    );

    expect(screen.getByTestId("provider-loading").textContent).toBe("loading");
    await waitFor(() => {
      expect(screen.getByTestId("provider-loading").textContent).toBe("idle");
    });
    expect(screen.getByTestId("provider-error").textContent).toBe(
      "El servicio no respondió a tiempo. Intentá nuevamente.",
    );
  });

  it("releases the mutation queue after a never-settling play times out", async () => {
    let instantRequests = 0;
    let markFirstRequestStarted!: () => void;
    const firstRequestStarted = new Promise<void>((resolve) => {
      markFirstRequestStarted = resolve;
    });
    const gateway = createPreviewProductGateway({
      timeoutMs: 100,
      fetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/bootstrap")) {
          return jsonResponse({ session, catalog, plays: [], results: [] });
        }
        if (url.endsWith("/movements")) {
          return jsonResponse({ movements: [] });
        }
        if (url.endsWith("/results")) return jsonResponse({ results: [] });
        if (url.endsWith("/instant")) {
          instantRequests += 1;
          const body = JSON.parse(String(init?.body)) as { selection: string };
          if (body.selection === "007") {
            markFirstRequestStarted();
            return await new Promise<Response>(() => undefined);
          }
          return jsonResponse(acceptedSecondPlay());
        }
        throw new Error(`Unexpected preview request: ${url}`);
      }),
    });

    render(
      <ProductProvider gateway={gateway}>
        <ProviderStateProbe />
      </ProductProvider>,
    );
    await screen.findByText(session.displayName);

    fireEvent.click(screen.getByRole("button", { name: "Encolar jugadas" }));
    await firstRequestStarted;
    expect(instantRequests).toBe(1);
    expect(screen.getByTestId("second-result").textContent).toBe("pending");

    await waitFor(() => {
      expect(screen.getByTestId("first-result").textContent).toBe(
        "GATEWAY_TIMEOUT",
      );
      expect(screen.getByTestId("second-result").textContent).toBe(
        "play-after-timeout",
      );
    });
    expect(instantRequests).toBe(2);
  });
});

const traditionalCommand = {
  kind: "traditional",
  input: { gameId: "head", drawId: "early", amount: 500, selection: { number: "007" } },
} as const satisfies ProductPlayCommand;

const traditionalResponse: PlayResponse = {
  play: {
    id: "traditional-payment",
    ticketId: "traditional-ticket",
    family: "TRADITIONAL",
    gameId: "head",
    gameName: "A la cabeza",
    drawId: "early",
    selection: { number: "007" },
    amount: 500,
    status: "PENDING",
    prize: 0,
    result: null,
    createdAt: "2026-08-25T12:00:00.000Z",
  },
  ticket: {
    id: "traditional-ticket",
    playId: "traditional-payment",
    family: "TRADITIONAL",
    gameId: "head",
    drawId: "early",
    selection: { number: "007" },
    amount: 500,
    status: "PENDING",
    currency: "PYG",
  },
  session: { balance: 24_500, currency: "PYG" },
  replayed: false,
};

const paymentSnapshot: ProductSnapshot = { session, catalog, plays: [], results: [] };

function paymentGateway() {
  return createFixtureProductGateway({
    bootstrap: paymentSnapshot,
    plays: [{ command: traditionalCommand, response: traditionalResponse }],
    movements: [],
    topUp: {
      session: { ...session, balance: 44_500 },
      balanceEntry: {
        id: "payment-topup",
        type: "TOPUP",
        amount: 20_000,
        currency: "PYG",
        balanceAfter: 44_500,
        referenceId: null,
        method: "CARD",
        createdAt: "2026-08-25T12:01:00.000Z",
      },
      replayed: false,
    },
  });
}

function renderPaymentProvider(gateway: ProductGateway) {
  return renderHook(() => useProduct(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <ProductProvider gateway={gateway}>{children}</ProductProvider>
    ),
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

describe("ProductProvider traditional payments", () => {
  it("deduplicates concurrent confirmations and takes the accepted balance from the server", async () => {
    const gateway = paymentGateway();
    const pending = deferred<PlayResponse>();
    const request = vi.spyOn(gateway, "requestPlay").mockReturnValue(pending.promise);
    const lookup = vi.spyOn(gateway, "getTicket");
    const { result } = renderPaymentProvider(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));

    let first!: Promise<PlayResponse>;
    let duplicate!: Promise<PlayResponse>;
    act(() => {
      first = result.current.requestPlay(traditionalCommand);
      duplicate = result.current.requestPlay(structuredClone(traditionalCommand));
    });
    expect(first).toBe(duplicate);
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(request.mock.calls[0][1]?.expectedSessionId).toBe(session.id);
    expect(result.current.session?.balance).toBe(25_000);
    expect(result.current.plays).toHaveLength(0);

    await act(async () => {
      pending.resolve({ ...traditionalResponse, session: { balance: 23_731, currency: "PYG" } });
      await Promise.all([first, duplicate]);
    });
    expect(result.current.session?.balance).toBe(23_731);
    expect(result.current.plays).toEqual([traditionalResponse.play]);
    await expect(result.current.getTicket(traditionalResponse.ticket.id)).resolves.toEqual(traditionalResponse.ticket);
    expect(lookup).not.toHaveBeenCalled();
  });

  it.each(["accepted", "expired"] as const)("discards an old session's late %s play response after a refresh changes accounts", async (outcome) => {
    const gateway = paymentGateway();
    const pending = deferred<PlayResponse>();
    const requestPlay = vi.spyOn(gateway, "requestPlay").mockReturnValue(pending.promise);
    const bootstrap = vi.spyOn(gateway, "bootstrap");
    const { result } = renderPaymentProvider(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));
    const staleRequest = result.current.requestPlay;
    const request = staleRequest(traditionalCommand);
    const rejected = expect(request).rejects.toBeInstanceOf(ProductOperationSupersededError);
    await waitFor(() => expect(requestPlay).toHaveBeenCalledOnce());

    const nextSession = { ...session, id: "other-play-account", balance: 90_000 };
    bootstrap.mockResolvedValue({ ...paymentSnapshot, session: nextSession });
    await act(async () => {
      await result.current.refresh();
      if (outcome === "accepted") pending.resolve(traditionalResponse);
      else pending.reject(new ProductGatewayHttpError(401, "SESSION_EXPIRED", "Sesión anterior vencida."));
      await rejected;
    });

    expect(result.current.session).toEqual(nextSession);
    expect(result.current.plays).toEqual([]);
    expect(result.current.unauthorized).toBe(false);
    await expect(staleRequest(traditionalCommand)).rejects.toBeInstanceOf(ProductOperationSupersededError);
    expect(requestPlay).toHaveBeenCalledOnce();
  });

  it("rejects an explicitly mismatched play session before applying its balance or ticket", async () => {
    const gateway = paymentGateway();
    vi.spyOn(gateway, "requestPlay").mockResolvedValue({
      ...traditionalResponse, session: { ...traditionalResponse.session, id: "other-play-account" },
    });
    const { result } = renderPaymentProvider(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.requestPlay(traditionalCommand)).rejects.toMatchObject({ code: "INVALID_GATEWAY_RESPONSE" });
    });
    expect(result.current.session).toEqual(session);
    expect(result.current.plays).toEqual([]);
  });

  it("does not change the balance or register a play when the server rejects insufficient funds", async () => {
    const gateway = paymentGateway();
    const failure = new ProductGatewayHttpError(409, "INSUFFICIENT_BALANCE", "Saldo insuficiente.");
    vi.spyOn(gateway, "requestPlay").mockRejectedValue(failure);
    const { result } = renderPaymentProvider(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.requestPlay(traditionalCommand)).rejects.toBe(failure);
    });
    expect(result.current.session).toEqual(session);
    expect(result.current.plays).toEqual([]);
    expect(result.current.movements).toEqual([]);
  });

  it("returns an accepted payment even when the secondary movements read fails", async () => {
    const gateway = paymentGateway();
    const { result } = renderPaymentProvider(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.spyOn(gateway, "getMovements").mockRejectedValue(new Error("Historial no disponible"));

    await act(async () => {
      await expect(result.current.requestPlay(traditionalCommand)).resolves.toEqual(traditionalResponse);
    });
    expect(result.current.session?.balance).toBe(24_500);
    expect(result.current.plays).toEqual([traditionalResponse.play]);
    expect(result.current.movementsError).toBeTruthy();
  });

  it("retains the same idempotency key after a lost response and reconciles replay without restoring an old balance", async () => {
    const gateway = paymentGateway();
    const request = vi.spyOn(gateway, "requestPlay")
      .mockRejectedValueOnce(new Error("Respuesta perdida"))
      .mockResolvedValueOnce({ ...traditionalResponse, replayed: true });
    const { result } = renderPaymentProvider(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.requestPlay(traditionalCommand)).rejects.toThrow("Respuesta perdida");
      await result.current.requestTopUp({ amount: 20_000, method: "CARD" });
    });
    const currentBalance = deferred<ProductSnapshot>();
    vi.spyOn(gateway, "bootstrap").mockReturnValue(currentBalance.promise);
    await act(async () => {
      await expect(result.current.requestPlay(traditionalCommand)).resolves.toMatchObject({ replayed: true });
    });
    expect(request.mock.calls[0][1]?.idempotencyKey).toEqual(expect.any(String));
    expect(request.mock.calls[1][1]?.idempotencyKey).toBe(request.mock.calls[0][1]?.idempotencyKey);
    expect(result.current.session?.balance).toBe(44_500);
    expect(result.current.plays).toEqual([traditionalResponse.play]);

    await act(async () => {
      currentBalance.resolve({ ...paymentSnapshot, session: { ...session, balance: 43_500 } });
      await currentBalance.promise;
    });
    expect(result.current.session?.balance).toBe(43_500);
    expect(result.current.plays).toEqual([traditionalResponse.play]);
  });

  it("does not overwrite a newer manual refresh with a delayed replay balance read", async () => {
    const gateway = paymentGateway();
    vi.spyOn(gateway, "requestPlay").mockResolvedValue({ ...traditionalResponse, replayed: true });
    const { result } = renderPaymentProvider(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));
    const replaySnapshot = deferred<ProductSnapshot>();
    vi.spyOn(gateway, "bootstrap")
      .mockReturnValueOnce(replaySnapshot.promise)
      .mockResolvedValueOnce({ ...paymentSnapshot, session: { ...session, balance: 40_000 }, plays: [traditionalResponse.play] });

    await act(async () => { await result.current.requestPlay(traditionalCommand); });
    await act(async () => { await result.current.refresh(); });
    expect(result.current.session?.balance).toBe(40_000);
    await act(async () => {
      replaySnapshot.resolve({ ...paymentSnapshot, session: { ...session, balance: 24_500 } });
      await replaySnapshot.promise;
    });
    expect(result.current.session?.balance).toBe(40_000);
  });

  it("does not overwrite a newer payment with a delayed replay balance read", async () => {
    const gateway = paymentGateway();
    vi.spyOn(gateway, "requestPlay").mockResolvedValue({ ...traditionalResponse, replayed: true });
    const { result } = renderPaymentProvider(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));
    const replaySnapshot = deferred<ProductSnapshot>();
    vi.spyOn(gateway, "bootstrap").mockReturnValue(replaySnapshot.promise);

    await act(async () => { await result.current.requestPlay(traditionalCommand); });
    await act(async () => { await result.current.requestTopUp({ amount: 20_000, method: "CARD" }); });
    await act(async () => {
      replaySnapshot.resolve({ ...paymentSnapshot, session: { ...session, balance: 24_500 } });
      await replaySnapshot.promise;
    });
    expect(result.current.session?.balance).toBe(44_500);
    expect(result.current.plays).toEqual([traditionalResponse.play]);
  });

  it("keeps the accepted replay and receipt when balance reconciliation fails", async () => {
    const gateway = paymentGateway();
    vi.spyOn(gateway, "requestPlay").mockResolvedValue({ ...traditionalResponse, replayed: true });
    const { result } = renderPaymentProvider(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.spyOn(gateway, "bootstrap").mockRejectedValue(new Error("Sin conexión"));

    await act(async () => {
      await expect(result.current.requestPlay(traditionalCommand)).resolves.toMatchObject({ ticket: traditionalResponse.ticket });
    });
    expect(result.current.plays).toEqual([traditionalResponse.play]);
    expect(result.current.session?.balance).toBe(25_000);
    expect(result.current.error).toContain("La operación fue confirmada");
    await expect(result.current.getTicket(traditionalResponse.ticket.id)).resolves.toEqual(traditionalResponse.ticket);
  });

  it("reconciles a replayed top-up without applying its historical balance", async () => {
    const gateway = paymentGateway();
    const input = { amount: 20_000, method: "CARD" } as const;
    const topUp = await gateway.topUp(input);
    vi.spyOn(gateway, "topUp").mockResolvedValue({ ...topUp, replayed: true });
    const { result } = renderPaymentProvider(gateway);
    await waitFor(() => expect(result.current.loading).toBe(false));
    const replaySnapshot = deferred<ProductSnapshot>();
    vi.spyOn(gateway, "bootstrap").mockReturnValue(replaySnapshot.promise);

    await act(async () => {
      await expect(result.current.requestTopUp(input)).resolves.toMatchObject({ replayed: true });
    });
    expect(result.current.session?.balance).toBe(25_000);
    expect(result.current.movements).toEqual([topUp.balanceEntry]);
    await act(async () => {
      replaySnapshot.resolve({ ...paymentSnapshot, session: { ...session, balance: 44_000 } });
      await replaySnapshot.promise;
    });
    expect(result.current.session?.balance).toBe(44_000);
  });
});
