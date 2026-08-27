// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TraditionalGameClient } from "@/features/product/traditional-game-client";
import { buildGamingCatalog } from "@/lib/gaming/catalog";
import type { GamingCatalog } from "@/lib/gaming/types";
import type { MockSession, PlayResponse } from "@/lib/product/api-types";
import { formatGs, getTraditionalGame, type TraditionalGameId } from "@/lib/product/catalog";
import {
  createFixtureProductGateway,
  ProductGatewayHttpError,
  type FixtureProductGatewayConfig,
  type ProductGateway,
  type ProductPlayCommand,
  type ProductSnapshot,
} from "@/lib/product/gateway";
import { ProductProvider, useProduct } from "@/providers/product-provider";

const now = Date.parse("2026-08-27T12:00:00.000Z");
const catalog = buildGamingCatalog("REFUND", new Date(now));
const session: MockSession = {
  id: "traditional-player",
  displayName: "Persona de prueba",
  role: "PLAYER",
  balance: 25_000,
  currency: "PYG",
};

type TraditionalCommand = Extract<ProductPlayCommand, { kind: "traditional" }>;

const headCommand: TraditionalCommand = {
  kind: "traditional",
  input: {
    gameId: "head",
    amount: 500,
    drawId: catalog.draws[0].id,
    selection: { number: "123" },
  },
};

function acceptedResponse(command: TraditionalCommand, balance = 17_250): PlayResponse {
  const details = {
    gameId: command.input.gameId,
    gameName: getTraditionalGame(command.input.gameId)?.name,
    family: "TRADITIONAL" as const,
    selection: command.input.selection,
    drawId: command.input.drawId,
    amount: command.input.amount,
    currency: "PYG",
    status: "PENDING",
    prize: 0,
  };
  return {
    play: {
      ...details,
      id: "accepted-traditional-play",
      ticketId: "accepted-traditional-ticket",
      createdAt: "2026-08-27T12:00:01.000Z",
    },
    ticket: {
      ...details,
      id: "accepted-traditional-ticket",
      code: "QL-TRADITIONAL",
      playId: "accepted-traditional-play",
      issuedAt: "2026-08-27T12:00:01.000Z",
    },
    session: { balance, currency: "PYG" },
    replayed: false,
  };
}

function fixtureConfig(
  snapshot: Partial<ProductSnapshot> = {},
  overrides: Partial<FixtureProductGatewayConfig> = {},
): FixtureProductGatewayConfig {
  return {
    bootstrap: { session, catalog, plays: [], results: [], ...snapshot },
    plays: [{ command: headCommand, response: acceptedResponse(headCommand) }],
    results: [],
    ...overrides,
  };
}

function ProductStateProbe() {
  const { session: activeSession, plays, loading } = useProduct();
  return (
    <div hidden>
      <span data-testid="provider-balance">{activeSession?.balance ?? "none"}</span>
      <span data-testid="provider-play-count">{plays.length}</span>
      <span data-testid="provider-loading">{loading ? "loading" : "ready"}</span>
    </div>
  );
}

function renderGame(gameId: TraditionalGameId = "head", gateway: ProductGateway = createFixtureProductGateway(fixtureConfig())) {
  render(
    <ProductProvider gateway={gateway}>
      <ProductStateProbe />
      <TraditionalGameClient game={getTraditionalGame(gameId)!} />
    </ProductProvider>,
  );
  return gateway;
}

async function waitUntilReady() {
  await waitFor(() => expect(screen.getByTestId("provider-loading").textContent).toBe("ready"));
  // Initialize the live clock without depending on the first timer tick.
  fireEvent.focus(window);
}

function numberInput(label = "Número de tres cifras") {
  return screen.getByRole("textbox", { name: label }) as HTMLInputElement;
}

function enterNumber(value: string, label?: string) {
  const input = numberInput(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
  return input;
}

function reviewButton() {
  return screen.getByRole("button", { name: "Revisar y pagar" }) as HTMLButtonElement;
}

function summary() {
  return screen.getByRole("complementary", { name: "Resumen de jugada" });
}

function expectUnchangedAccount(balance = session.balance) {
  expect(screen.getByTestId("provider-balance").textContent).toBe(String(balance));
  expect(screen.getByTestId("provider-play-count").textContent).toBe("0");
  expect(screen.queryByRole("dialog", { name: "Jugada registrada" })).toBeNull();
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(now);
  window.localStorage.removeItem("quinie_sound");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TraditionalGameClient selection", () => {
  it.each<TraditionalGameId>(["head", "prizes", "invert", "redoblona"])(
    "starts %s empty and generates correctly padded random numbers without charging",
    async (gameId) => {
      const gateway = createFixtureProductGateway(fixtureConfig());
      const request = vi.spyOn(gateway, "requestPlay");
      renderGame(gameId, gateway);
      await waitUntilReady();

      for (const field of screen.getAllByRole("textbox") as HTMLInputElement[]) {
        expect(field.value).toBe("");
        expect(field.inputMode).toBe("numeric");
      }
      expect(reviewButton().disabled).toBe(true);
      expect(screen.getByRole("button", { name: formatGs(500) }).getAttribute("aria-pressed")).toBe("true");

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Números aleatorios" }));
      });

      const head = numberInput(gameId === "redoblona" ? "Número de cabeza" : undefined);
      expect(head.value).toMatch(/^\d{3}$/);
      expect(Number(head.value)).toBeGreaterThanOrEqual(1);
      expect(Number(head.value)).toBeLessThanOrEqual(999);
      if (gameId === "redoblona") {
        const second = numberInput("Número redoblona");
        expect(second.value).toMatch(/^\d{2}$/);
        expect(Number(second.value)).toBeGreaterThanOrEqual(0);
        expect(Number(second.value)).toBeLessThanOrEqual(99);
      }
      expect(reviewButton().disabled).toBe(false);
      expect(request).not.toHaveBeenCalled();
      expectUnchangedAccount();
    },
  );

  it("keeps a blank field blank, pads a short number on blur and blocks zero", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig());
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("head", gateway);
    await waitUntilReady();

    const input = numberInput();
    fireEvent.blur(input);
    expect(input.value).toBe("");
    expect(reviewButton().disabled).toBe(true);

    enterNumber("0");
    expect(input.value).toBe("000");
    expect(reviewButton().disabled).toBe(true);
    fireEvent.click(reviewButton());
    expect(screen.queryByRole("dialog")).toBeNull();

    enterNumber("7");
    expect(input.value).toBe("007");
    expect(reviewButton().disabled).toBe(false);

    enterNumber("");
    expect(input.value).toBe("");
    expect(reviewButton().disabled).toBe(true);
    expect(request).not.toHaveBeenCalled();
    expectUnchangedAccount();
  });

  it("requires both redoblona numbers and allows the two-digit ending 00", async () => {
    renderGame("redoblona");
    await waitUntilReady();

    expect(enterNumber("8", "Número de cabeza").value).toBe("008");
    expect(reviewButton().disabled).toBe(true);
    expect(enterNumber("0", "Número redoblona").value).toBe("00");
    expect(reviewButton().disabled).toBe(false);

    enterNumber("0", "Número de cabeza");
    expect(reviewButton().disabled).toBe(true);
    expectUnchangedAccount();
  });

  it.each<TraditionalGameId>(["prizes", "invert", "redoblona"])(
    "includes the selected %s position in the review summary",
    async (gameId) => {
      renderGame(gameId);
      await waitUntilReady();
      fireEvent.click(screen.getByRole("button", { name: "Números aleatorios" }));
      fireEvent.change(screen.getByRole("combobox", { name: "Hasta la posición" }), {
        target: { value: "10" },
      });

      const positionLabel = within(summary()).getByText(/^(?:Posición|Posiciones|Alcance)$/i);
      expect(positionLabel.parentElement?.textContent).toMatch(/\b10\b/);
      expectUnchangedAccount();
    },
  );

  it("selects and submits tonight's draw when tomorrow's draws appear first in the catalog", async () => {
    const tonight = catalog.draws.find((draw) => draw.id === "night")!;
    const overnightCatalog: GamingCatalog = {
      ...catalog,
      draws: [
        ...catalog.draws.filter((draw) => draw.id !== tonight.id).map((draw) => ({
          ...draw,
          closesAt: new Date(Date.parse(draw.closesAt) + 86_400_000).toISOString(),
          drawsAt: new Date(Date.parse(draw.drawsAt) + 86_400_000).toISOString(),
        })),
        tonight,
      ],
    };
    const command: TraditionalCommand = {
      ...headCommand,
      input: { ...headCommand.input, drawId: tonight.id },
    };
    const gateway = createFixtureProductGateway(fixtureConfig(
      { catalog: overnightCatalog },
      { plays: [{ command, response: acceptedResponse(command) }] },
    ));
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("head", gateway);
    await waitUntilReady();

    expect(screen.getByRole("radio", { checked: true })).toBe(screen.getByRole("radio", { name: /Nocturno/ }));
    enterNumber("123");
    fireEvent.click(reviewButton());
    fireEvent.click(screen.getByRole("button", { name: /^Pagar Gs\./ }));

    await screen.findByRole("dialog", { name: "Jugada registrada" });
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0]).toEqual(command);
  });

  it("uses remote amounts, allowed draws and the remote position range in the submitted command", async () => {
    const remoteCatalog: GamingCatalog = {
      ...catalog,
      amounts: [2_000, 7_000],
      draws: [{
        id: "special-draw",
        label: "Sorteo especial",
        family: "QUINIELA",
        status: "OPEN",
        closesAt: "2026-08-27T20:00:00.000Z",
        drawsAt: "2026-08-27T20:15:00.000Z",
      }],
      traditional: catalog.traditional.map((game) => game.id === "prizes" ? {
        ...game,
        name: "Premios del catálogo",
        drawIds: ["special-draw"],
        selection: { kind: "THREE_DIGIT", position: { min: 4, max: 6 } },
      } : game),
    };
    const command: TraditionalCommand = {
      kind: "traditional",
      input: {
        gameId: "prizes",
        drawId: "special-draw",
        amount: 7_000,
        selection: { number: "321", position: 5 },
      },
    };
    const gateway = createFixtureProductGateway(fixtureConfig(
      { catalog: remoteCatalog },
      { plays: [{ command, response: acceptedResponse(command) }] },
    ));
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("prizes", gateway);
    await waitUntilReady();

    expect(screen.getByRole("heading", { level: 1, name: "Premios del catálogo" })).toBeTruthy();
    const position = screen.getByRole("combobox", { name: "Hasta la posición" });
    const allowedPositions = within(position).getAllByRole("option") as HTMLOptionElement[];
    expect(allowedPositions.filter((option) => option.value).map((option) => option.value)).toEqual(["4", "5", "6"]);
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect((screen.getByRole("radio", { name: /Sorteo especial/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("button", { name: formatGs(2_000) }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: formatGs(500) })).toBeNull();

    enterNumber("321");
    fireEvent.change(position, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: formatGs(7_000) }));
    fireEvent.click(reviewButton());
    const dialog = screen.getByRole("dialog", { name: "Confirmá tu jugada" });
    expect(dialog.textContent).toContain("Sorteo especial");
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: /^Pagar Gs\./ }));

    await screen.findByRole("dialog", { name: "Jugada registrada" });
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0]).toEqual(command);
  });
});

describe("TraditionalGameClient payment", () => {
  it("reviews and cancels without calling the gateway or deducting the displayed balance", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig());
    const request = vi.spyOn(gateway, "requestPlay");
    const user = userEvent.setup();
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");

    expect(summary().textContent).toContain(formatGs(session.balance));
    expect(summary().textContent).toContain(formatGs(session.balance - 500));
    expect(summary().textContent).toMatch(/estimado/i);
    await user.click(reviewButton());

    const dialog = screen.getByRole("dialog", { name: "Confirmá tu jugada" });
    expect(dialog.textContent).toContain("123");
    expect(request).not.toHaveBeenCalled();
    expectUnchangedAccount();
    await user.click(within(dialog).getByRole("button", { name: "Volver a editar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(numberInput().value).toBe("123");
    expect(request).not.toHaveBeenCalled();
    expectUnchangedAccount();
  });

  it("charges once, freezes the form while pending and shows only the server balance on acceptance", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig());
    const realRequest = gateway.requestPlay.bind(gateway);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const request = vi.spyOn(gateway, "requestPlay").mockImplementation(async (command, options) => {
      await gate;
      return realRequest(command, options);
    });
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");
    fireEvent.click(reviewButton());
    const pay = screen.getByRole("button", { name: /^Pagar Gs\./ });

    act(() => {
      fireEvent.click(pay);
      fireEvent.click(pay);
    });
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expectUnchangedAccount();
    expect(numberInput().matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Números aleatorios" }).matches(":disabled")).toBe(true);
    for (const radio of screen.getAllByRole("radio")) expect(radio.matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: formatGs(500) }).matches(":disabled")).toBe(true);

    await act(async () => { release(); await gate; });
    const success = await screen.findByRole("dialog", { name: "Jugada registrada" });
    expect(within(success).getByText("Saldo actualizado")).toBeTruthy();
    expect(success.textContent).toContain(formatGs(17_250));
    expect(success.textContent).not.toContain(formatGs(session.balance - 500));
    expect(screen.getByTestId("provider-balance").textContent).toBe("17250");
    expect(screen.getByTestId("provider-play-count").textContent).toBe("1");
    expect(within(success).getByRole("link", { name: "Ver en Mis jugadas" }).getAttribute("href")).toBe("/mis-jugadas");
    expect(numberInput().matches(":disabled")).toBe(true);
    expect(request).toHaveBeenCalledOnce();

    fireEvent.click(within(success).getByRole("button", { name: "Nueva jugada" }));
    expect(screen.queryByRole("dialog", { name: "Jugada registrada" })).toBeNull();
    expect(numberInput().value).toBe("");
    expect(numberInput().matches(":disabled")).toBe(false);
    expect(reviewButton().disabled).toBe(true);
    fireEvent.click(reviewButton());
    expect(request).toHaveBeenCalledOnce();
  });

  it("does not allow a payment exceeding the available balance", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig({ session: { ...session, balance: 499 } }));
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");

    expect(reviewButton().disabled).toBe(true);
    fireEvent.click(reviewButton());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expectUnchangedAccount(499);
  });

  it.each([
    new ProductGatewayHttpError(409, "INSUFFICIENT_FUNDS", "Saldo insuficiente para esta jugada."),
    new Error("No pudimos conectar. Intentá nuevamente."),
  ])("keeps the account unchanged and does not show success after $message", async (failure) => {
    const gateway = createFixtureProductGateway(fixtureConfig({}, { failures: { requestPlay: failure } }));
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");
    fireEvent.click(reviewButton());
    fireEvent.click(screen.getByRole("button", { name: /^Pagar Gs\./ }));

    await screen.findByText(failure.message);
    expect(request).toHaveBeenCalledOnce();
    expectUnchangedAccount();
    expect(screen.queryByRole("link", { name: "Ver en Mis jugadas" })).toBeNull();
  });

  it("rechecks the closing time when paying a review opened before the deadline", async () => {
    const closingCatalog: GamingCatalog = {
      ...catalog,
      draws: [{ ...catalog.draws[0], closesAt: new Date(now + 1_000).toISOString() }],
    };
    const gateway = createFixtureProductGateway(fixtureConfig({ catalog: closingCatalog }));
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");
    fireEvent.click(reviewButton());
    expect(screen.getByRole("dialog", { name: "Confirmá tu jugada" })).toBeTruthy();

    vi.mocked(Date.now).mockReturnValue(now + 1_001);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Pagar Gs\./ }));
    });

    expect(request).not.toHaveBeenCalled();
    expectUnchangedAccount();
  });
});

describe("TraditionalGameClient unavailable states", () => {
  it("disables review until the initial catalog and session finish loading", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig());
    const bootstrap = gateway.bootstrap.bind(gateway);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(gateway, "bootstrap").mockImplementation(async (options) => {
      await gate;
      return bootstrap(options);
    });
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("head", gateway);

    expect(reviewButton().disabled).toBe(true);
    fireEvent.click(reviewButton());
    expect(request).not.toHaveBeenCalled();
    await act(async () => { release(); await gate; });
    await waitUntilReady();
    expect(numberInput().value).toBe("");
  });

  it.each<[string, Partial<ProductSnapshot>]>([
    ["missing session", { session: null }],
    ["unavailable game", { catalog: { ...catalog, traditional: [] } }],
    ["empty amounts", { catalog: { ...catalog, amounts: [] } }],
    ["empty draws", { catalog: { ...catalog, draws: [] } }],
    ["closed draws", { catalog: { ...catalog, draws: catalog.draws.map((draw) => ({ ...draw, closesAt: new Date(now - 1).toISOString() })) } }],
  ])("does not submit with %s", async (_name, snapshot) => {
    const gateway = createFixtureProductGateway(fixtureConfig(snapshot));
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("head", gateway);
    await waitUntilReady();
    const input = screen.queryByRole("textbox", { name: "Número de tres cifras" });
    if (input) {
      fireEvent.change(input, { target: { value: "123" } });
      fireEvent.blur(input);
    }

    expect(reviewButton().disabled).toBe(true);
    fireEvent.click(reviewButton());
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("provider-play-count").textContent).toBe("0");
  });
});
