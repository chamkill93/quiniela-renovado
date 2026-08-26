// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { PlaysClient } from "@/features/product/plays-client";
import { buildGamingCatalog } from "@/lib/gaming";
import type { MockPlay, MockSession, MockTicket } from "@/lib/product/api-types";
import { createFixtureProductGateway } from "@/lib/product/gateway";
import { ProductProvider } from "@/providers/product-provider";

const session: MockSession = {
  id: "player-receipts",
  displayName: "Ana Fixture",
  role: "PLAYER",
  balance: 45_000,
  currency: "PYG",
};

const plays: MockPlay[] = [
  {
    id: "play-instant-1",
    ticketId: "QL-TICKET-001",
    family: "INSTANT",
    gameId: "sapyaite",
    gameName: "Sapy’aitépe",
    amount: 5_000,
    prize: 3_500_000,
    status: "WON",
    createdAt: "2026-08-25T12:30:00.000Z",
    selection: "007",
    resultNumbers: ["007"],
  },
  {
    id: "play-traditional-2",
    ticketId: "QL-TICKET-002",
    family: "TRADITIONAL",
    gameId: "a-la-cabeza",
    gameName: "A la cabeza",
    amount: 2_000,
    prize: 0,
    status: "PENDING",
    createdAt: "2026-08-25T13:00:00.000Z",
    drawId: "draw-42",
    selection: "497",
  },
];

const tickets: MockTicket[] = [
  {
    id: "QL-TICKET-001",
    code: "QL-REAL-001",
    playId: "play-instant-1",
    family: "INSTANT",
    gameId: "sapyaite",
    gameName: "Sapy’aitépe",
    amount: 5_000,
    currency: "PYG",
    prize: 3_500_000,
    status: "WON",
    selection: "007",
    resultNumbers: ["007"],
    issuedAt: "2026-08-25T12:30:00.000Z",
  },
  {
    id: "QL-TICKET-002",
    code: "QL-REAL-002",
    playId: "play-traditional-2",
    family: "TRADITIONAL",
    gameId: "a-la-cabeza",
    gameName: "A la cabeza",
    drawId: "draw-42",
    amount: 2_000,
    currency: "PYG",
    prize: 0,
    status: "PENDING",
    selection: "497",
    issuedAt: "2026-08-25T13:00:00.000Z",
  },
];

const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;

function renderPlays({
  visiblePlays = plays,
  ticketFailure,
  pendingTicket,
}: {
  visiblePlays?: MockPlay[];
  ticketFailure?: Error;
  pendingTicket?: Promise<MockTicket>;
} = {}) {
  const gateway = createFixtureProductGateway({
    bootstrap: {
      session,
      catalog: buildGamingCatalog("REFUND", new Date("2026-08-25T12:00:00.000Z")),
      plays: visiblePlays,
      results: [],
    },
    tickets,
    ...(ticketFailure ? { failures: { getTicket: ticketFailure } } : {}),
  });
  if (pendingTicket) {
    vi.spyOn(gateway, "getTicket").mockReturnValue(pendingTicket);
  }
  const user = userEvent.setup();

  render(
    <ProductProvider gateway={gateway}>
      <PlaysClient />
    </ProductProvider>,
  );

  return user;
}

beforeAll(() => {
  window.requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(performance.now());
    return 1;
  };
  window.cancelAnimationFrame = () => undefined;
});

afterAll(() => {
  window.requestAnimationFrame = originalRequestAnimationFrame;
  window.cancelAnimationFrame = originalCancelAnimationFrame;
});

afterEach(() => {
  cleanup();
});

describe("comprobantes en Mis Jugadas", () => {
  it("ofrece un acceso al lado de cada jugada y abre su comprobante autoritativo", async () => {
    const user = renderPlays();

    await screen.findByRole("heading", { level: 1, name: "Mis Jugadas" });
    const receiptButtons = screen.getAllByRole("button", {
      name: "Ver mi comprobante",
    });
    expect(receiptButtons).toHaveLength(2);

    await user.click(receiptButtons[0]);

    const dialog = screen.getByRole("dialog", { name: "Jugada registrada" });
    expect(within(dialog).getByText("Sapy’aitépe")).toBeTruthy();
    expect(within(dialog).getAllByText("007")).toHaveLength(2);
    expect(within(dialog).getByText("Gs. 5.000")).toBeTruthy();
    expect(within(dialog).getByText("Gs. 3.500.000")).toBeTruthy();
    expect(within(dialog).getByText("QL-REAL-001")).toBeTruthy();
  });

  it("cierra el comprobante y devuelve el foco a su botón", async () => {
    const user = renderPlays();

    await screen.findByRole("heading", { level: 1, name: "Mis Jugadas" });
    const receiptButton = screen.getAllByRole("button", {
      name: "Ver mi comprobante",
    })[1];
    await user.click(receiptButton);

    const dialog = screen.getByRole("dialog", { name: "Jugada registrada" });
    expect(within(dialog).getByText("A la cabeza")).toBeTruthy();
    expect(within(dialog).getByText("draw-42")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Listo" }));

    expect(screen.queryByRole("dialog", { name: "Jugada registrada" })).toBeNull();
    expect(document.activeElement).toBe(receiptButton);
  });

  it("muestra carga y un error reintentable sin fabricar un comprobante", async () => {
    let rejectTicket!: (reason: Error) => void;
    const pendingTicket = new Promise<MockTicket>((_resolve, reject) => {
      rejectTicket = reject;
    });
    const user = renderPlays({ pendingTicket });

    await screen.findByRole("heading", { level: 1, name: "Mis Jugadas" });
    await user.click(screen.getAllByRole("button", { name: "Ver mi comprobante" })[0]);

    const loadingButton = screen.getByRole("button", { name: "Cargando comprobante…" });
    expect(loadingButton.getAttribute("aria-busy")).toBe("true");
    expect(loadingButton.hasAttribute("disabled")).toBe(true);

    rejectTicket(new Error("detalle privado del conector"));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "No pudimos cargar el comprobante",
    );
    expect(screen.queryByText("detalle privado del conector")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Ver mi comprobante" })[0].hasAttribute("disabled")).toBe(false);
  });

  it("identifica claramente una jugada histórica sin ticketId", async () => {
    renderPlays({
      visiblePlays: [{ ...plays[0], ticketId: undefined }],
    });

    await screen.findByRole("heading", { level: 1, name: "Mis Jugadas" });
    const unavailable = screen.getByRole("button", {
      name: "Comprobante no disponible",
    });
    await waitFor(() => expect(unavailable.hasAttribute("disabled")).toBe(true));
    expect(screen.queryByRole("button", { name: "Ver mi comprobante" })).toBeNull();
  });
});
