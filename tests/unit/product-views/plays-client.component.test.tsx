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

function receiptRow(container: HTMLElement, label: string) {
  const term = within(container).getByText(label, { selector: "dt" });
  const row = term.closest("div");
  if (!(row instanceof HTMLElement)) {
    throw new Error(`No se encontró la fila ${label} del comprobante.`);
  }
  return row;
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
    const winningRow = receiptRow(dialog, "Monto a ganar");
    expect(winningRow.textContent).toContain("Ganado");
    expect(winningRow.textContent).toContain("Gs. 3.500.000");
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
    const receiptElement = within(dialog).getByRole("article", { name: "Comprobante QL-REAL-002" });
    const receipt = within(receiptElement);
    expect(receipt.getByText("Quiniela actualizada")).toBeTruthy();
    expect(receipt.getByText("007 · 042")).toBeTruthy();
    expect(receipt.getByText("042 · 007")).toBeTruthy();
    expect(receipt.getByText("Gs. 7.500")).toBeTruthy();
    expect(receipt.getByText("Gs. 98.000")).toBeTruthy();
    const winningRow = receiptRow(receiptElement, "Monto a ganar");
    expect(winningRow.textContent).toContain("Ganado");
    expect(winningRow.textContent).toContain("Gs. 98.000");
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

  it("muestra la Redoblona compuesta en lenguaje natural y conserva tickets históricos", async () => {
    const redoblonaPlay: MockPlay = {
      ...plays[1],
      id: "play-redoblona",
      ticketId: "ticket-redoblona",
      gameId: "redoblona",
      gameName: "Redoblona",
      selection: { initialNumber: "35", initialUntil: 1, redoblonaNumber: "72", redoblonaUntil: 7 },
    };
    const redoblonaTicket: MockTicket = {
      ...tickets[1],
      id: "ticket-redoblona",
      code: "QL-REDOBLONA",
      playId: redoblonaPlay.id,
      gameId: "redoblona",
      gameName: "Redoblona",
      selection: redoblonaPlay.selection,
    };
    const user = renderPlays({ visiblePlays: [redoblonaPlay], visibleTickets: [redoblonaTicket] });
    await user.click(await screen.findByRole("button", { name: "Ver mi comprobante" }));
    expect(within(screen.getByRole("dialog", { name: "Jugada registrada" })).getByText("35 Cabeza + 72 postura 7")).toBeTruthy();
  });

  it("formatea sin ambigüedad una selección histórica de Redoblona", async () => {
    const legacyPlay: MockPlay = {
      ...plays[1],
      id: "play-redoblona-legacy",
      ticketId: "ticket-redoblona-legacy",
      gameId: "redoblona",
      gameName: "Redoblona",
      selection: { head: "035", redoblona: "72", position: 7 },
    };
    const legacyTicket: MockTicket = {
      ...tickets[1],
      id: "ticket-redoblona-legacy",
      code: "QL-REDOBLONA-LEGACY",
      playId: legacyPlay.id,
      gameId: "redoblona",
      gameName: "Redoblona",
      selection: legacyPlay.selection,
    };
    const user = renderPlays({ visiblePlays: [legacyPlay], visibleTickets: [legacyTicket] });
    await user.click(await screen.findByRole("button", { name: "Ver mi comprobante" }));
    expect(within(screen.getByRole("dialog", { name: "Jugada registrada" })).getByText("035 Cabeza + 72 postura 7")).toBeTruthy();
  });

  it.each(["invert", "invertida"])("muestra con puntos la selección de %s y conserva el cero inicial", async (gameId) => {
    const invertPlay: MockPlay = {
      ...plays[1],
      id: `play-${gameId}`,
      ticketId: `ticket-${gameId}`,
      gameId,
      gameName: "Invertida",
      selection: { number: "012", position: 4 },
    };
    const invertTicket: MockTicket = {
      ...tickets[1],
      id: `ticket-${gameId}`,
      code: `QL-${gameId.toUpperCase()}`,
      playId: invertPlay.id,
      gameId,
      gameName: "Invertida",
      selection: invertPlay.selection,
    };
    const user = renderPlays({ visiblePlays: [invertPlay], visibleTickets: [invertTicket] });

    await user.click(await screen.findByRole("button", { name: "Ver mi comprobante" }));

    const receipt = within(screen.getByRole("dialog", { name: "Jugada registrada" }))
      .getByRole("article", { name: `Comprobante ${invertTicket.code}` });
    expect(receiptRow(receipt, "Selección").textContent).toContain("0.1.2 · Postura 4");
  });

  it.each([
    ["early", "Tempranero"],
    ["morning", "Matutino"],
    ["evening", "Vespertino"],
    ["night", "Nocturno"],
  ])("localiza el sorteo %s como %s", async (drawId, expectedLabel) => {
    const localizedPlay: MockPlay = {
      ...plays[1],
      id: `play-${drawId}`,
      ticketId: `ticket-${drawId}`,
      drawId,
    };
    const localizedTicket: MockTicket = {
      ...tickets[1],
      id: `ticket-${drawId}`,
      code: `QL-${drawId.toUpperCase()}`,
      playId: localizedPlay.id,
      drawId,
    };
    const user = renderPlays({ visiblePlays: [localizedPlay], visibleTickets: [localizedTicket] });

    await user.click(await screen.findByRole("button", { name: "Ver mi comprobante" }));

    const receipt = within(screen.getByRole("dialog", { name: "Jugada registrada" }))
      .getByRole("article", { name: `Comprobante ${localizedTicket.code}` });
    const drawRow = receiptRow(receipt, "Sorteo");
    expect(drawRow.textContent).toContain(expectedLabel);
    expect(drawRow.textContent).not.toContain(drawId);
  });

  it.each([
    ["PENDING", "Pendiente"],
    ["LOST", "Perdido"],
    ["REFUNDED", "Reintegrado"],
  ])("prioriza el estado %s del ticket en Monto a ganar", async (ticketStatus, expectedLabel) => {
    const statusPlay: MockPlay = {
      ...plays[1],
      id: `play-status-${ticketStatus.toLowerCase()}`,
      ticketId: `ticket-status-${ticketStatus.toLowerCase()}`,
      status: "WON",
      prize: 900_000,
    };
    const statusTicket: MockTicket = {
      ...tickets[1],
      id: statusPlay.ticketId!,
      code: `QL-STATUS-${ticketStatus}`,
      playId: statusPlay.id,
      status: ticketStatus,
      prize: 0,
    };
    const user = renderPlays({ visiblePlays: [statusPlay], visibleTickets: [statusTicket] });

    await user.click(await screen.findByRole("button", { name: "Ver mi comprobante" }));

    const receipt = within(screen.getByRole("dialog", { name: "Jugada registrada" }))
      .getByRole("article", { name: `Comprobante ${statusTicket.code}` });
    const outcomeRow = receiptRow(receipt, "Monto a ganar");
    expect(outcomeRow.textContent).toContain(expectedLabel);
    expect(outcomeRow.textContent).not.toContain("Gs. 0");
    expect(outcomeRow.textContent).not.toContain("Gs. 900.000");
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
    const receiptElement = within(dialog).getByRole("article", { name: `Comprobante ${longCode}` });
    const receipt = within(receiptElement);
    expect(receipt.getByText(gameName)).toBeTruthy();
    expect(receipt.getByText(selectedNumbers.join(" · "))).toBeTruthy();
    expect(receipt.getByText(longDrawId)).toBeTruthy();
    expect(receipt.getByText(longCode)).toBeTruthy();
    expect(receipt.getByText("En proceso")).toBeTruthy();
    expect(receipt.getByText("Gs. 2.000")).toBeTruthy();
    const pendingRow = receiptRow(receiptElement, "Monto a ganar");
    expect(pendingRow.textContent).toContain("Pendiente");
    expect(pendingRow.textContent).not.toContain("Gs. 0");
    expect(receipt.queryByText("Gs. 0")).toBeNull();
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
