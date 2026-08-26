// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildGamingCatalog } from "@/lib/gaming";
import type { MockSession, MockTicket } from "@/lib/product/api-types";
import {
  createFixtureProductGateway,
  ProductGatewayHttpError,
} from "@/lib/product/gateway";
import { ProductProvider, useProduct } from "@/providers/product-provider";

const session: MockSession = {
  id: "ticket-user",
  displayName: "Usuario comprobante",
  role: "PLAYER",
  balance: 25_000,
  currency: "PYG",
};

const ticket: MockTicket = {
  id: "ticket-1",
  code: "QL-TICKET1",
  playId: "play-1",
  gameId: "sapyaite",
  gameName: "Sapy’aite",
  family: "INSTANT",
  selection: "PAR",
  drawId: null,
  amount: 500,
  currency: "PYG",
  status: "WON",
  resultNumbers: ["246"],
  prize: 1_000,
  issuedAt: "2026-08-25T12:00:00.000Z",
};

function gatewayConfig() {
  return {
    bootstrap: {
      session,
      catalog: buildGamingCatalog(
        "REFUND",
        new Date("2026-08-25T12:00:00.000Z"),
      ),
      plays: [],
      results: [],
    },
    tickets: [ticket],
  } as const;
}

function TicketProbe() {
  const { getTicket, logout, session: activeSession, unauthorized } = useProduct();
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState("");

  const show = (request: Promise<MockTicket>) => {
    void request.then(
      (nextTicket) => setCode(nextTicket.code ?? nextTicket.id),
      (reason: unknown) =>
        setFailure(reason instanceof Error ? reason.name : "Error"),
    );
  };

  return (
    <div>
      <span>{activeSession?.displayName ?? "Sin sesión"}</span>
      <span>{unauthorized ? "No autorizada" : "Autorizada"}</span>
      <span>{code}</span>
      <span>{failure}</span>
      <button onClick={() => show(getTicket(ticket.id))} type="button">
        Cargar
      </button>
      <button
        onClick={() => {
          show(
            Promise.all([getTicket(ticket.id), getTicket(ticket.id)]).then(
              ([first]) => first,
            ),
          );
        }}
        type="button"
      >
        Cargar dos veces
      </button>
      <button onClick={() => void logout()} type="button">
        Salir
      </button>
    </div>
  );
}

afterEach(cleanup);

describe("ProductProvider ticket connector", () => {
  it("deduplica lecturas concurrentes y reutiliza el comprobante en caché", async () => {
    const gateway = createFixtureProductGateway(gatewayConfig());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const lookup = vi.spyOn(gateway, "getTicket").mockImplementation(
      async (ticketId, options) => {
        await gate;
        options?.signal?.throwIfAborted();
        expect(ticketId).toBe(ticket.id);
        return structuredClone(ticket);
      },
    );
    const user = userEvent.setup();
    render(
      <ProductProvider gateway={gateway}>
        <TicketProbe />
      </ProductProvider>,
    );
    await screen.findByText(session.displayName);

    await user.click(screen.getByRole("button", { name: "Cargar dos veces" }));
    expect(lookup).toHaveBeenCalledOnce();
    release();
    await screen.findByText(ticket.code!);

    await user.click(screen.getByRole("button", { name: "Cargar" }));
    expect(lookup).toHaveBeenCalledOnce();
  });

  it("convierte una sesión expirada al estado no autorizado del proveedor", async () => {
    const gateway = createFixtureProductGateway({
      ...gatewayConfig(),
      failures: {
        getTicket: new ProductGatewayHttpError(
          401,
          "SESSION_EXPIRED",
          "Sesión vencida",
        ),
      },
    });
    const user = userEvent.setup();
    render(
      <ProductProvider gateway={gateway}>
        <TicketProbe />
      </ProductProvider>,
    );
    await screen.findByText(session.displayName);

    await user.click(screen.getByRole("button", { name: "Cargar" }));

    await screen.findByText("No autorizada");
    expect(screen.getByText("Sin sesión")).toBeTruthy();
  });

  it("aborta y descarta una lectura de comprobante superada por logout", async () => {
    const gateway = createFixtureProductGateway(gatewayConfig());
    let requestSignal: AbortSignal | undefined;
    vi.spyOn(gateway, "getTicket").mockImplementation(
      (_ticketId, options) =>
        new Promise<MockTicket>((_resolve, reject) => {
          requestSignal = options?.signal;
          options?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const user = userEvent.setup();
    render(
      <ProductProvider gateway={gateway}>
        <TicketProbe />
      </ProductProvider>,
    );
    await screen.findByText(session.displayName);

    await user.click(screen.getByRole("button", { name: "Cargar" }));
    await waitFor(() => expect(requestSignal).toBeDefined());
    await user.click(screen.getByRole("button", { name: "Salir" }));

    await waitFor(() => expect(requestSignal?.aborted).toBe(true));
    await screen.findByText("ProductOperationSupersededError");
    expect(screen.queryByText(ticket.code!)).toBeNull();
  });
});
