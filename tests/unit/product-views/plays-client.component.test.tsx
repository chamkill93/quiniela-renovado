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
  visibleTickets = tickets,
  ticketFailure,
  pendingTicket,
}: {
  visiblePlays?: MockPlay[];
  visibleTickets?: MockTicket[];
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
    tickets: visibleTickets,
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

  it("conserva los datos del comprobante aunque difieran del historial", async () => {
    const issuedAt = "2026-08-26T16:45:00.000Z";
    const authoritativeTicket: MockTicket = {
      ...tickets[1],
      gameName: "Quiniela actualizada",
      amount: 7_500,
      prize: 98_000,
      status: "WON",
      selection: { numbers: ["007", "042"] },
      resultNumbers: ["042", "007"],
      drawId: "draw-confirmado-20260826",
      issuedAt,
    };
    const user = renderPlays({
      visiblePlays: [plays[1]],
      visibleTickets: [authoritativeTicket],
    });

    await user.click(await screen.findByRole("button", { name: "Ver mi comprobante" }));

    const dialog = await screen.findByRole("dialog", { name: "Jugada registrada" });
    const receipt = within(within(dialog).getByRole("article", { name: "Comprobante QL-REAL-002" }));
    expect(receipt.getByText("Quiniela actualizada")).toBeTruthy();
    expect(receipt.getByText("007 · 042")).toBeTruthy();
    expect(receipt.getByText("042 · 007")).toBeTruthy();
    expect(receipt.getByText("Gs. 7.500")).toBeTruthy();
    expect(receipt.getByText("Gs. 98.000")).toBeTruthy();
    expect(receipt.getByText("Ganadora")).toBeTruthy();
    expect(receipt.getByText("draw-confirmado-20260826")).toBeTruthy();
    expect(receipt.getByText("QL-REAL-002")).toBeTruthy();
    const issuedDate = new Intl.DateTimeFormat("es-PY", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Asuncion",
    }).format(new Date(issuedAt));
    expect(receipt.getByText(issuedDate)).toBeTruthy();
    expect(receipt.queryByText("497")).toBeNull();
    expect(receipt.queryByText("Gs. 2.000")).toBeNull();
    expect(receipt.queryByText("En proceso")).toBeNull();
  });

  it("conserva valores largos y datos de una jugada pendiente sin inventar resultados", async () => {
    const longCode = "QL-COMPROBANTE-20260825-PLAYER-RECEIPTS-TRADITIONAL-000000000042";
    const longDrawId = "sorteo-quiniela-tradicional-vespertina-2026-08-25-confirmacion-000042";
    const gameName = "Quiniela tradicional del primer al decimocuarto puesto";
    const selectedNumbers = ["0007", "0042", "0790", "0815", "1234", "5678", "9012", "9876"];
    const pendingPlay: MockPlay = {
      ...plays[1],
      ticketId: longCode,
      gameName,
      drawId: longDrawId,
      selection: selectedNumbers,
    };
    const user = renderPlays({
      visiblePlays: [pendingPlay],
      visibleTickets: [{ id: longCode, playId: pendingPlay.id, amount: pendingPlay.amount }],
    });

    await user.click(await screen.findByRole("button", { name: "Ver mi comprobante" }));

    const dialog = await screen.findByRole("dialog", { name: "Jugada registrada" });
    const receipt = within(within(dialog).getByRole("article", { name: `Comprobante ${longCode}` }));
    expect(receipt.getByText(gameName)).toBeTruthy();
    expect(receipt.getByText(selectedNumbers.join(" · "))).toBeTruthy();
    expect(receipt.getByText(longDrawId)).toBeTruthy();
    expect(receipt.getByText(longCode)).toBeTruthy();
    expect(receipt.getByText("En proceso")).toBeTruthy();
    expect(receipt.getByText("Gs. 2.000")).toBeTruthy();
    expect(receipt.getByText("Gs. 0")).toBeTruthy();
    expect(receipt.queryByText("Resultado")).toBeNull();
    const playDate = new Intl.DateTimeFormat("es-PY", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Asuncion",
    }).format(new Date(pendingPlay.createdAt));
    expect(receipt.getByText(playDate)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Listo" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Cerrar" })).toBeTruthy();
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
