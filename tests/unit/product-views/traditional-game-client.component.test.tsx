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
  const playId = `accepted-traditional-play-${command.input.drawId}`;
  const ticketId = `accepted-traditional-ticket-${command.input.drawId}`;
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
      id: playId,
      ticketId,
      createdAt: "2026-08-27T12:00:01.000Z",
    },
    ticket: {
      ...details,
      id: ticketId,
      code: `QL-TRADITIONAL-${command.input.drawId}`,
      playId,
      issuedAt: "2026-08-27T12:00:01.000Z",
    },
    session: { balance, currency: "PYG" },
    replayed: false,
  };
}

const threeDrawCatalog: GamingCatalog = { ...catalog, draws: catalog.draws.slice(0, 3) };
const threeDrawCommands = threeDrawCatalog.draws.map<TraditionalCommand>((draw) => ({
  ...headCommand,
  input: { ...headCommand.input, drawId: draw.id },
}));
const threeDrawFixtures = threeDrawCommands.map((command, index) => ({
  command,
  response: acceptedResponse(command, [24_500, 24_000, 23_500][index]),
}));

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
  const { session: activeSession, plays, loading, refresh, login } = useProduct();
  return (
    <div hidden>
      <span data-testid="provider-balance">{activeSession?.balance ?? "none"}</span>
      <span data-testid="provider-session-id">{activeSession?.id ?? "none"}</span>
      <span data-testid="provider-play-count">{plays.length}</span>
      <span data-testid="provider-loading">{loading ? "loading" : "ready"}</span>
      <button data-testid="refresh-product-state" onClick={() => void refresh()} type="button">Refrescar fixture</button>
      <button data-testid="login-product-state" onClick={() => void login("fixture-user", "fixture-password")} type="button">Ingresar con fixture</button>
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

async function refreshFixtureSnapshot(
  gateway: ReturnType<typeof createFixtureProductGateway>,
  snapshot: Partial<ProductSnapshot>,
) {
  const nextGateway = createFixtureProductGateway(fixtureConfig(snapshot));
  vi.spyOn(gateway, "bootstrap").mockImplementation((options) => nextGateway.bootstrap(options));
  fireEvent.click(screen.getByTestId("refresh-product-state"));
  await waitUntilReady();
}

function numberInput(label = "Número de tres cifras") {
  return screen.getByRole("textbox", { name: label }) as HTMLInputElement;
}

function stakeAmount() {
  return screen.getByTestId("traditional-stake");
}

function amountFields() {
  return screen.getByRole("group", { name: "Importe por sorteo" });
}

function chipButton(value: number) {
  return screen.getByRole("button", { name: "Sumar " + formatGs(value) }) as HTMLButtonElement;
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

function reviewDialog() {
  return screen.getByRole("dialog", { name: "Confirmá tu jugada" });
}

function drawCheckboxes() {
  return screen.getAllByRole("checkbox") as HTMLInputElement[];
}

function selectAllDraws() {
  for (const checkbox of drawCheckboxes()) {
    if (!checkbox.checked) fireEvent.click(checkbox);
  }
}

function expectUnchangedAccount(balance = session.balance) {
  expect(screen.getByTestId("provider-balance").textContent).toBe(String(balance));
  expect(screen.getByTestId("provider-play-count").textContent).toBe("0");
  expect(screen.queryByRole("dialog", { name: /^Jugadas? registradas?$/ })).toBeNull();
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

      expect(screen.getByRole("heading", { level: 2, name: gameId === "redoblona" ? "Números" : "Número" })).toBeTruthy();
      for (const field of screen.getAllByRole("textbox") as HTMLInputElement[]) {
        expect(field.value).toBe("");
        expect(field.inputMode).toBe("numeric");
      }
      expect(reviewButton().disabled).toBe(true);
      expect(stakeAmount().textContent).toBe(formatGs(0));
      expect(screen.getByTestId("traditional-total").textContent).toBe(formatGs(0));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Números aleatorios" }));
      });

      const head = numberInput(gameId === "redoblona" ? "Número de apuesta inicial" : undefined);
      if (gameId !== "redoblona") {
        expect(head.labels?.[0]?.textContent).toBe("Número de tres cifras");
        expect(head.labels?.[0]?.classList.contains("q-sr-only")).toBe(true);
      }
      expect(head.value).toMatch(gameId === "redoblona" ? /^\d{2}$/ : /^\d{3}$/);
      expect(Number(head.value)).toBeGreaterThanOrEqual(gameId === "redoblona" ? 0 : 1);
      expect(Number(head.value)).toBeLessThanOrEqual(gameId === "redoblona" ? 99 : 999);
      if (gameId === "invert") expect(new Set(head.value).size).toBe(3);
      if (gameId === "redoblona") {
        const second = numberInput("Número de Redoblona");
        expect(second.value).toMatch(/^\d{2}$/);
        expect(Number(second.value)).toBeGreaterThanOrEqual(0);
        expect(Number(second.value)).toBeLessThanOrEqual(99);
      }
      expect(stakeAmount().textContent).toBe(formatGs(0));
      expect(reviewButton().disabled).toBe(true);
      fireEvent.click(reviewButton());
      expect(screen.queryByRole("dialog")).toBeNull();
      fireEvent.click(chipButton(500));
      expect(reviewButton().disabled).toBe(false);
      expect(screen.getByTestId("traditional-total").textContent).toBe(formatGs(500));
      expect(request).not.toHaveBeenCalled();
      expectUnchangedAccount();
    },
  );

  it("shows draw logos and amount coins without repeated navigation or balance and places random selection after both number fields", async () => {
    renderGame("redoblona");
    await waitUntilReady();

    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Modalidades de quiniela" })).toBeNull();
    expect(screen.queryByText("Saldo disponible")).toBeNull();
    expect(screen.queryByText(formatGs(session.balance))).toBeNull();
    expect(screen.queryByText("Varios a la vez")).toBeNull();
    expect(screen.queryByText("Por sorteo · Gs.")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Importe por sorteo" })).toBeNull();
    expect(chipButton(500).getAttribute("aria-pressed")).toBeNull();
    const amountAssets = [[500, "500"], [1_000, "1k"], [2_000, "2k"], [5_000, "5k"], [10_000, "10k"]] as const;
    for (const [amount, slug] of amountAssets) {
      expect(screen.getByRole("button", { name: "Sumar " + formatGs(amount) }).getAttribute("data-amount-chip-asset")).toBe(slug);
    }
    expect(document.querySelectorAll("[data-amount-chip-asset]")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "Sumar " + formatGs(20_000) })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sumar " + formatGs(50_000) })).toBeNull();

    const drawAssets = [["early", "tempranero"], ["morning", "matutino"], ["evening", "vespertino"], ["night", "nocturno"]] as const;
    for (const [drawId, slug] of drawAssets) {
      const checkbox = drawCheckboxes().find((input) => input.value === drawId);
      const icon = checkbox?.closest("label")?.querySelector("[data-draw-icon='" + drawId + "']");
      expect(icon?.getAttribute("data-draw-icon-slug")).toBe(slug);
    }
    expect(screen.queryByText(/Podés cambiarlos antes de pagar/)).toBeNull();
    const randomButton = screen.getByRole("button", { name: "Números aleatorios" });
    expect(randomButton.textContent).toContain("Al azar");
    for (const field of screen.getAllByRole("textbox")) {
      expect(field.compareDocumentPosition(randomButton) & Node.DOCUMENT_POSITION_FOLLOWING)
        .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("allows selecting every draw and clearing all of them without silently selecting a default again", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig());
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");
    fireEvent.click(chipButton(500));

    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(1);
    selectAllDraws();
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(4);
    expect(reviewButton().disabled).toBe(false);

    for (const checkbox of drawCheckboxes()) fireEvent.click(checkbox);
    fireEvent.focus(window);

    expect(screen.queryAllByRole("checkbox", { checked: true })).toHaveLength(0);
    expect(reviewButton().disabled).toBe(true);
    fireEvent.click(reviewButton());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expectUnchangedAccount();
  });

  it("keeps a blank field blank, pads a short number on blur and blocks zero", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig());
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("head", gateway);
    await waitUntilReady();
    fireEvent.click(chipButton(500));

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

  it("explains and blocks repeated digits in Invertida", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig());
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("invert", gateway);
    await waitUntilReady();
    fireEvent.click(chipButton(500));

    const input = numberInput();
    expect(document.getElementById("traditional-number-hint")?.textContent)
      .toBe("Del 001 al 999, con tres cifras distintas");
    enterNumber("112");

    expect(input.value).toBe("112");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Elegí un número del 001 al 999 con tres cifras distintas.")).toBeTruthy();
    expect(reviewButton().disabled).toBe(true);
    fireEvent.click(reviewButton());
    expect(screen.queryByRole("dialog")).toBeNull();

    enterNumber("123");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByText("Elegí un número del 001 al 999 con tres cifras distintas.")).toBeNull();
    expect(reviewButton().disabled).toBe(false);
    expect(request).not.toHaveBeenCalled();
    expectUnchangedAccount();
  });

  it("requires two canonical Redoblona numbers and accepts 00 twice", async () => {
    renderGame("redoblona");
    await waitUntilReady();
    fireEvent.click(chipButton(500));

    expect(enterNumber("8", "Número de apuesta inicial").value).toBe("08");
    expect(reviewButton().disabled).toBe(true);
    expect(enterNumber("0", "Número de Redoblona").value).toBe("00");
    expect(reviewButton().disabled).toBe(false);

    enterNumber("0", "Número de apuesta inicial");
    expect(reviewButton().disabled).toBe(false);
    expect(screen.getByRole("status", { name: "Resumen de Redoblona" }).textContent).toContain("00 Cabeza + 00 hasta 7");
    expectUnchangedAccount();
  });

  it.each<TraditionalGameId>(["prizes", "invert"])(
    "includes the selected %s position only in the review popup",
    async (gameId) => {
      renderGame(gameId);
      await waitUntilReady();
      fireEvent.click(screen.getByRole("button", { name: "Números aleatorios" }));
      fireEvent.click(chipButton(500));
      fireEvent.change(screen.getByRole("combobox", { name: "Hasta la posición" }), {
        target: { value: "10" },
      });

      expect(screen.queryByRole("complementary")).toBeNull();
      fireEvent.click(reviewButton());
      const positionLabel = within(reviewDialog()).getByText(/^(?:Posición|Posiciones|Alcance)$/i);
      expect(positionLabel.parentElement?.textContent).toMatch(/\b10\b/);
      expectUnchangedAccount();
    },
  );

  it("keeps both Redoblona scopes valid, raises the second scope and reviews a natural summary", async () => {
    renderGame("redoblona");
    await waitUntilReady();
    const initialScope = screen.getByRole("combobox", { name: "Alcance de apuesta inicial" }) as HTMLSelectElement;
    const redoblonaScope = screen.getByRole("combobox", { name: "Alcance de Redoblona" }) as HTMLSelectElement;
    expect(initialScope.value).toBe("1");
    expect(redoblonaScope.value).toBe("7");
    enterNumber("35", "Número de apuesta inicial");
    enterNumber("72", "Número de Redoblona");
    fireEvent.change(initialScope, { target: { value: "8" } });
    expect(initialScope.value).toBe("8");
    expect(redoblonaScope.value).toBe("8");
    expect(within(redoblonaScope).queryByRole("option", { name: "Hasta 7" })).toBeNull();
    fireEvent.change(redoblonaScope, { target: { value: "10" } });
    fireEvent.click(chipButton(500));

    const liveSummary = screen.getByRole("status", { name: "Resumen de Redoblona" });
    expect(liveSummary.textContent).toContain("35 hasta 8 + 72 hasta 10");
    fireEvent.click(reviewButton());
    expect(within(reviewDialog()).getByLabelText("35 hasta 8 + 72 hasta 10")).toBeTruthy();
    expect(within(reviewDialog()).getByText("Alcances").parentElement?.textContent).toContain("Inicial hasta 8 · Redoblona hasta 10");
    expectUnchangedAccount();
  });

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

    expect(screen.getByRole("checkbox", { checked: true })).toBe(screen.getByRole("checkbox", { name: /Nocturno/ }));
    enterNumber("123");
    fireEvent.click(chipButton(500));
    fireEvent.click(reviewButton());
    fireEvent.click(screen.getByRole("button", { name: /^Pagar Gs\./ }));

    await screen.findByRole("dialog", { name: "Jugada registrada" });
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0]).toEqual(command);
  });

  it("uses remote amounts and ranges without falling back when the selected amount is removed from the catalog", async () => {
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
    expect(drawCheckboxes()).toHaveLength(1);
    expect((screen.getByRole("checkbox", { name: /Sorteo especial/ }) as HTMLInputElement).checked).toBe(true);
    expect(stakeAmount().textContent).toBe(formatGs(0));
    expect(screen.queryByRole("button", { name: "Sumar " + formatGs(500) })).toBeNull();

    enterNumber("321");
    fireEvent.change(position, { target: { value: "5" } });
    fireEvent.click(chipButton(2000));
    expect(reviewButton().disabled).toBe(false);

    await refreshFixtureSnapshot(gateway, {
      catalog: { ...remoteCatalog, amounts: [5_000, 7_000] },
    });
    expect(stakeAmount().textContent).toBe(formatGs(0));
    expect(screen.queryByRole("button", { name: "Sumar " + formatGs(2_000) })).toBeNull();
    expect(screen.getByTestId("traditional-total").textContent).toBe(formatGs(0));
    expect(reviewButton().disabled).toBe(true);
    expect(numberInput().value).toBe("321");
    expect((position as HTMLSelectElement).value).toBe("5");
    expect(drawCheckboxes()[0].checked).toBe(true);
    fireEvent.click(reviewButton());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expectUnchangedAccount();

    fireEvent.click(chipButton(7000));
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
  it("adds repeated chips up to 10,000 per draw, never clamps an oversized chip, and can clear 40,000 across four draws", async () => {
    const balance = 100_000;
    const gateway = createFixtureProductGateway(fixtureConfig({ session: { ...session, balance } }));
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");
    fireEvent.click(chipButton(1_000));
    fireEvent.click(chipButton(500));
    expect(stakeAmount().textContent).toBe(formatGs(1_500));
    act(() => {
      fireEvent.click(chipButton(500));
      fireEvent.click(chipButton(500));
    });
    expect(stakeAmount().textContent).toBe(formatGs(2_500));
    fireEvent.click(chipButton(5_000));
    expect(chipButton(5_000).disabled).toBe(true);
    expect(chipButton(10_000).disabled).toBe(true);
    fireEvent.click(chipButton(5_000));
    expect(stakeAmount().textContent).toBe(formatGs(7_500));
    fireEvent.click(chipButton(2_000));
    fireEvent.click(chipButton(500));
    expect(stakeAmount().textContent).toBe(formatGs(10_000));
    for (const value of [500, 1_000, 2_000, 5_000, 10_000]) expect(chipButton(value).disabled).toBe(true);
    selectAllDraws();
    expect(screen.getByTestId("traditional-total").textContent).toBe(formatGs(40_000));
    expect(reviewButton().disabled).toBe(false);
    fireEvent.click(reviewButton());
    expect(reviewDialog().textContent).toContain("Se descontará Gs. 40.000");
    const clear = screen.getByRole("button", { name: "Borrar importe" }) as HTMLButtonElement;
    expect(clear.disabled).toBe(true);
    fireEvent.click(clear);
    expect(stakeAmount().textContent).toBe(formatGs(10_000));
    fireEvent.click(within(reviewDialog()).getByRole("button", { name: "Volver a editar" }));
    fireEvent.click(clear);
    expect(stakeAmount().textContent).toBe(formatGs(0));
    expect(screen.getByTestId("traditional-total").textContent).toBe(formatGs(0));
    expect(chipButton(10_000).disabled).toBe(false);
    expect(reviewButton().disabled).toBe(true);
    expect(request).not.toHaveBeenCalled();
    expectUnchangedAccount(balance);
  });

  it("reviews and cancels without calling the gateway or deducting the displayed balance", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig());
    const request = vi.spyOn(gateway, "requestPlay");
    const user = userEvent.setup();
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");

    await user.click(chipButton(1000));
    await user.click(screen.getByRole("button", { name: "Sumar " + formatGs(500) }));
    expect(stakeAmount().textContent).toBe(formatGs(1_500));
    await user.click(screen.getByRole("button", { name: "Borrar importe" }));
    expect(screen.getByTestId("traditional-total").textContent).toBe(formatGs(0));
    expect(reviewButton().disabled).toBe(true);
    await user.click(reviewButton());
    expect(request).not.toHaveBeenCalled();
    await user.click(chipButton(500));

    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(reviewButton());

    const dialog = screen.getByRole("dialog", { name: "Confirmá tu jugada" });
    expect(dialog.textContent).toContain("123");
    expect(dialog.textContent).toContain(formatGs(session.balance));
    expect(dialog.textContent).toContain(formatGs(session.balance - 500));
    expect(dialog.textContent).toMatch(/estimado/i);
    expect(amountFields().matches(":disabled")).toBe(true);
    await user.click(chipButton(1000));
    await user.click(screen.getByRole("button", { name: "Borrar importe" }));
    expect(stakeAmount().textContent).toBe(formatGs(500));
    expect(request).not.toHaveBeenCalled();
    expectUnchangedAccount();
    await user.click(within(dialog).getByRole("button", { name: "Volver a editar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(numberInput().value).toBe("123");
    expect(amountFields().matches(":disabled")).toBe(false);
    expect(stakeAmount().textContent).toBe(formatGs(500));
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
    fireEvent.click(chipButton(500));
    fireEvent.click(reviewButton());
    const pay = screen.getByRole("button", { name: /^Pagar Gs\./ });

    act(() => {
      fireEvent.click(pay);
      fireEvent.click(pay);
    });
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expectUnchangedAccount();
    expect(numberInput().matches(":disabled")).toBe(true);
    expect(amountFields().matches(":disabled")).toBe(true);
    expect(stakeAmount().textContent).toBe(formatGs(500));
    expect(screen.getByRole("button", { name: "Números aleatorios" }).matches(":disabled")).toBe(true);
    for (const checkbox of drawCheckboxes()) expect(checkbox.matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Sumar " + formatGs(500) }).matches(":disabled")).toBe(true);

    vi.mocked(Date.now).mockReturnValue(Date.parse(catalog.draws[0].closesAt));
    fireEvent.focus(window);
    const removeClosed = screen.getByRole("button", { name: "Quitar cerrados" }) as HTMLButtonElement;
    expect(removeClosed.disabled).toBe(true);
    fireEvent.click(removeClosed);
    expect(drawCheckboxes().filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value)).toEqual([catalog.draws[0].id]);

    await act(async () => { release(); await gate; });
    const success = await screen.findByRole("dialog", { name: "Jugada registrada" });
    expect(within(success).getByText("Saldo actualizado")).toBeTruthy();
    expect(success.textContent).toContain(formatGs(17_250));
    expect(success.textContent).not.toContain(formatGs(session.balance - 500));
    expect(screen.getByTestId("provider-balance").textContent).toBe("17250");
    expect(screen.getByTestId("provider-play-count").textContent).toBe("1");
    expect(within(success).getByRole("link", { name: "Ver en Mis jugadas" }).getAttribute("href")).toBe("/mis-jugadas");
    expect(numberInput().matches(":disabled")).toBe(true);
    expect(amountFields().matches(":disabled")).toBe(true);
    expect((screen.getByRole("button", { name: "Quitar cerrados" }) as HTMLButtonElement).disabled).toBe(true);
    expect(request).toHaveBeenCalledOnce();

    fireEvent.click(within(success).getByRole("button", { name: "Nueva jugada" }));
    expect(screen.queryByRole("dialog", { name: "Jugada registrada" })).toBeNull();
    expect(numberInput().value).toBe("");
    expect(numberInput().matches(":disabled")).toBe(false);
    expect(stakeAmount().textContent).toBe(formatGs(0));
    expect(amountFields().matches(":disabled")).toBe(false);
    expect(screen.getByTestId("traditional-total").textContent).toBe(formatGs(0));
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
    fireEvent.click(chipButton(500));

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
    fireEvent.click(chipButton(500));
    fireEvent.click(reviewButton());
    fireEvent.click(screen.getByRole("button", { name: /^Pagar Gs\./ }));

    await screen.findByText(failure.message);
    expect(request).toHaveBeenCalledOnce();
    expectUnchangedAccount();
    expect(screen.queryByRole("link", { name: "Ver en Mis jugadas" })).toBeNull();
  });

  it("rejects exact cutoffs and removes closed draws only on request without replacing selections or charging", async () => {
    const closingCatalog: GamingCatalog = {
      ...catalog,
      draws: catalog.draws.map((draw, index) => ({
        ...draw,
        closesAt: new Date(now + [1_000, 500, 2_000, 3_000][index]).toISOString(),
      })),
    };
    const gateway = createFixtureProductGateway(fixtureConfig({ catalog: closingCatalog }));
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");
    fireEvent.click(screen.getByRole("button", { name: "Sumar " + formatGs(2_000) }));
    const [selectedClosing, unselectedClosing, remainingOpen, otherOpen] = drawCheckboxes();
    const selectedDrawLabel = selectedClosing.getAttribute("aria-label");
    const unselectedDrawLabel = unselectedClosing.getAttribute("aria-label");
    fireEvent.click(remainingOpen);
    const selectedIds = [selectedClosing.value, remainingOpen.value];

    // The real cutoff can pass between clock ticks while the checkbox still looks enabled.
    vi.mocked(Date.now).mockReturnValue(now + 500);
    expect(unselectedClosing.disabled).toBe(false);
    fireEvent.click(unselectedClosing);
    expect(unselectedClosing.checked).toBe(false);
    expect(drawCheckboxes().filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value)).toEqual(selectedIds);

    fireEvent.click(reviewButton());
    const pay = within(reviewDialog()).getByRole("button", { name: /^Pagar Gs\./ }) as HTMLButtonElement;

    vi.mocked(Date.now).mockReturnValue(now + 1_000);
    expect(pay.disabled).toBe(false);
    fireEvent.click(pay);
    expect(request).not.toHaveBeenCalled();
    fireEvent.focus(window);
    expect(selectedClosing.checked).toBe(true);
    expect(selectedClosing.disabled).toBe(true);
    expect(selectedClosing.getAttribute("aria-label")).toBe(selectedDrawLabel + " · Cerrado");
    expect(unselectedClosing.checked).toBe(false);
    expect(unselectedClosing.disabled).toBe(true);
    expect(unselectedClosing.getAttribute("aria-label")).toBe(unselectedDrawLabel + " · Cerrado");
    const removeClosed = screen.getByRole("button", { name: "Quitar cerrados" }) as HTMLButtonElement;
    expect(removeClosed.disabled).toBe(true);
    fireEvent.click(removeClosed);
    expect(drawCheckboxes().filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value)).toEqual(selectedIds);

    fireEvent.click(within(reviewDialog()).getByRole("button", { name: "Volver a editar" }));
    expect(remainingOpen.matches(":disabled")).toBe(false);
    expect(otherOpen.checked).toBe(false);
    expect(otherOpen.disabled).toBe(false);
    expect(reviewButton().disabled).toBe(true);
    expect(removeClosed.disabled).toBe(false);
    fireEvent.click(removeClosed);
    expect(drawCheckboxes().filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value)).toEqual([remainingOpen.value]);
    expect(numberInput().value).toBe("123");
    expect(stakeAmount().textContent).toBe(formatGs(2000));
    expect(screen.getByTestId("traditional-total").textContent).toBe(formatGs(2_000));
    expect(reviewButton().disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Quitar cerrados" })).toBeNull();

    vi.mocked(Date.now).mockReturnValue(now + 2_000);
    fireEvent.focus(window);
    expect(remainingOpen.checked).toBe(true);
    expect(remainingOpen.disabled).toBe(true);
    expect(otherOpen.checked).toBe(false);
    expect(otherOpen.disabled).toBe(false);
    expect(reviewButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Quitar cerrados" }));
    fireEvent.focus(window);
    expect(screen.queryAllByRole("checkbox", { checked: true })).toHaveLength(0);
    expect(numberInput().value).toBe("123");
    expect(stakeAmount().textContent).toBe(formatGs(2000));
    expect(reviewButton().disabled).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();

    expect(request).not.toHaveBeenCalled();
    expectUnchangedAccount();
  });
});

describe("TraditionalGameClient multiple draws", () => {
  it("checks the available balance against the full amount for all selected draws", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig({ session: { ...session, balance: 2_500 } }));
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");
    fireEvent.click(screen.getByRole("button", { name: "Sumar " + formatGs(1_000) }));
    expect(reviewButton().disabled).toBe(false);

    selectAllDraws();
    expect(reviewButton().disabled).toBe(true);
    fireEvent.click(reviewButton());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expectUnchangedAccount(2_500);

    fireEvent.click(screen.getByRole("button", { name: "Sumar " + formatGs(500) }));
    expect(screen.getByTestId("traditional-total").textContent).toBe(formatGs(6_000));
    expect(reviewButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Borrar importe" }));
    fireEvent.click(chipButton(500));
    expect(reviewButton().disabled).toBe(false);
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(4);
  });

  it("reviews the full total and pays four draws in chronological order without changing the selection or accepting double confirmation", async () => {
    const amount = 2_000;
    const total = amount * 4;
    const balances = [22_250, 19_500, 16_750, 15_125];
    const commands = catalog.draws.map<TraditionalCommand>((draw) => ({
      kind: "traditional",
      input: { gameId: "prizes", drawId: draw.id, amount, selection: { number: "321", position: 10 } },
    }));
    const gateway = createFixtureProductGateway(fixtureConfig(
      { catalog: { ...catalog, draws: [...catalog.draws].reverse() } },
      { plays: commands.map((command, index) => ({ command, response: acceptedResponse(command, balances[index]) })) },
    ));
    const realRequest = gateway.requestPlay.bind(gateway);
    const releases: Array<() => void> = [];
    const gates = commands.map(() => new Promise<void>((resolve) => { releases.push(resolve); }));
    let started = 0;
    const request = vi.spyOn(gateway, "requestPlay").mockImplementation(async (command, options) => {
      const index = started++;
      await gates[index];
      return realRequest(command, options);
    });
    renderGame("prizes", gateway);
    await waitUntilReady();
    enterNumber("321");
    fireEvent.change(screen.getByRole("combobox", { name: "Hasta la posición" }), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Sumar " + formatGs(amount) }));
    selectAllDraws();
    fireEvent.click(reviewButton());

    const dialog = reviewDialog();
    expect(within(dialog).getByText("Por sorteo").parentElement?.textContent).toContain(formatGs(amount));
    expect(within(dialog).getByText("Total a pagar").parentElement?.textContent).toContain(formatGs(total));
    expect(dialog.textContent).toContain(formatGs(session.balance - total));
    expect(dialog.textContent).toMatch(/estimado/i);
    for (const draw of catalog.draws) {
      expect(dialog.textContent).toContain(draw.label.split(" · ")[0]);
      expect(dialog.textContent).toContain(new Intl.DateTimeFormat("es-PY", {
        day: "numeric", month: "short", timeZone: "America/Asuncion",
      }).format(new Date(draw.drawsAt)));
      expect(dialog.textContent).toContain(new Intl.DateTimeFormat("es-PY", {
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Asuncion",
      }).format(new Date(draw.drawsAt)));
    }
    expect(request).not.toHaveBeenCalled();
    expectUnchangedAccount();

    const pay = within(dialog).getByRole("button", { name: `Pagar ${formatGs(total)}` });
    act(() => {
      fireEvent.click(pay);
      fireEvent.click(pay);
    });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expectUnchangedAccount();
    expect(numberInput().matches(":disabled")).toBe(true);
    expect(drawCheckboxes().every((checkbox) => checkbox.matches(":disabled"))).toBe(true);

    for (let index = 0; index < commands.length - 1; index += 1) {
      await act(async () => { releases[index](); });
      await waitFor(() => expect(request).toHaveBeenCalledTimes(index + 2));
      expect(screen.getByTestId("provider-play-count").textContent).toBe(String(index + 1));
      expect(screen.getByTestId("provider-balance").textContent).toBe(String(balances[index]));
      expect(screen.queryByRole("dialog", { name: /^Jugadas? registradas?$/ })).toBeNull();
      expect(numberInput().value).toBe("321");
      expect(drawCheckboxes().every((checkbox) => checkbox.checked)).toBe(true);
    }

    await act(async () => { releases[3](); });
    const success = await screen.findByRole("dialog", { name: "Jugadas registradas" });
    expect(request.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByTestId("provider-play-count").textContent).toBe("4");
    expect(screen.getByTestId("provider-balance").textContent).toBe("15125");
    expect(within(success).getByText("Saldo actualizado")).toBeTruthy();
    expect(success.textContent).toContain(formatGs(15_125));
    expect(success.textContent).not.toContain(formatGs(session.balance - total));
    expect(numberInput().value).toBe("321");
    expect((screen.getByRole("combobox", { name: "Hasta la posición" }) as HTMLSelectElement).value).toBe("10");
    expect(drawCheckboxes().every((checkbox) => checkbox.checked)).toBe(true);
  });

  it("preserves the first accepted draw after the second is rejected and retries only the remaining two", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig(
      { catalog: threeDrawCatalog },
      { plays: threeDrawFixtures },
    ));
    const realRequest = gateway.requestPlay.bind(gateway);
    const failure = new ProductGatewayHttpError(409, "INSUFFICIENT_FUNDS", "El segundo sorteo no pudo pagarse.");
    let rejected = false;
    const request = vi.spyOn(gateway, "requestPlay").mockImplementation(async (command, options) => {
      if (!rejected && command.kind === "traditional" && command.input.drawId === threeDrawCommands[1].input.drawId) {
        rejected = true;
        throw failure;
      }
      return realRequest(command, options);
    });
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");
    fireEvent.click(chipButton(500));
    selectAllDraws();
    fireEvent.click(reviewButton());
    fireEvent.click(within(reviewDialog()).getByRole("button", { name: /^Pagar Gs\./ }));

    await screen.findByText(failure.message);
    expect(request.mock.calls.map(([command]) => command)).toEqual(threeDrawCommands.slice(0, 2));
    expect(screen.getByTestId("provider-play-count").textContent).toBe("1");
    expect(screen.getByTestId("provider-balance").textContent).toBe("24500");
    expect(within(reviewDialog()).getAllByText("Registrado")).toHaveLength(1);
    expect(within(reviewDialog()).queryByText("Por confirmar")).toBeNull();

    fireEvent.keyDown(reviewDialog(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(numberInput().matches(":disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Revisar pendientes" }));
    expect(within(reviewDialog()).getAllByText("Registrado")).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(2);
    fireEvent.click(within(reviewDialog()).getByRole("button", { name: /^Pagar pendientes Gs\./ }));

    await screen.findByRole("dialog", { name: "Jugadas registradas" });
    expect(request.mock.calls.map(([command]) => command)).toEqual([
      threeDrawCommands[0], threeDrawCommands[1], threeDrawCommands[1], threeDrawCommands[2],
    ]);
    expect(screen.getByTestId("provider-play-count").textContent).toBe("3");
    expect(screen.getByTestId("provider-balance").textContent).toBe("23500");
  });

  it("recovers the second draw at zero balance and requires an explicit balance refresh before allowing the third", async () => {
    const recoveryFixtures = threeDrawFixtures.map((fixture, index) => index === 1
      ? { ...fixture, response: { ...fixture.response, replayed: true } }
      : fixture);
    const gateway = createFixtureProductGateway(fixtureConfig(
      { catalog: threeDrawCatalog },
      { plays: recoveryFixtures },
    ));
    const realRequest = gateway.requestPlay.bind(gateway);
    const failure = new Error("No llegó la respuesta del segundo pago.");
    let responseLost = false;
    const request = vi.spyOn(gateway, "requestPlay").mockImplementation(async (command, options) => {
      if (!responseLost && command.kind === "traditional" && command.input.drawId === threeDrawCommands[1].input.drawId) {
        responseLost = true;
        throw failure;
      }
      return realRequest(command, options);
    });
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");
    fireEvent.click(chipButton(500));
    selectAllDraws();
    fireEvent.click(reviewButton());
    fireEvent.click(within(reviewDialog()).getByRole("button", { name: /^Pagar Gs\./ }));

    await screen.findByText(failure.message);
    expect(request).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("provider-play-count").textContent).toBe("1");
    expect(within(reviewDialog()).getByText("Por confirmar")).toBeTruthy();

    await refreshFixtureSnapshot(gateway, {
      catalog: threeDrawCatalog,
      session: { ...session, balance: 0 },
      plays: recoveryFixtures.slice(0, 2).map((fixture) => fixture.response.play),
    });
    const retry = within(reviewDialog()).getByRole("button", { name: "Reintentar pendientes" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
    fireEvent.click(retry);

    await screen.findByText(/Pago recuperado\. Revisá el saldo actualizado/);
    expect(request.mock.calls.map(([command]) => command)).toEqual([
      threeDrawCommands[0], threeDrawCommands[1], threeDrawCommands[1],
    ]);
    expect(request.mock.calls[1][1]?.idempotencyKey).toBeTruthy();
    expect(request.mock.calls[2][1]?.idempotencyKey).toBe(request.mock.calls[1][1]?.idempotencyKey);
    expect(screen.getByTestId("provider-play-count").textContent).toBe("2");
    expect(screen.getByTestId("provider-balance").textContent).toBe("0");
    expect(within(reviewDialog()).getByText("Saldo disponible").nextElementSibling?.textContent).toBe(formatGs(0));
    expect(within(reviewDialog()).getAllByText("Registrado")).toHaveLength(2);
    expect(reviewDialog().textContent).not.toContain(formatGs(24_000));
    expect(screen.queryByRole("dialog", { name: /^Jugadas? registradas?$/ })).toBeNull();
    const pendingPayment = within(reviewDialog()).getByRole("button", { name: /^Pagar pendientes Gs\./ }) as HTMLButtonElement;
    expect(pendingPayment.disabled).toBe(true);
    fireEvent.click(pendingPayment);
    expect(request).toHaveBeenCalledTimes(3);

    const fundedSnapshot: Partial<ProductSnapshot> = {
      catalog: threeDrawCatalog,
      session: { ...session, balance: 2_000 },
      plays: recoveryFixtures.slice(0, 2).map((fixture) => fixture.response.play),
    };
    await refreshFixtureSnapshot(gateway, fundedSnapshot);
    expect(screen.getByTestId("provider-balance").textContent).toBe("2000");
    expect(pendingPayment.disabled).toBe(true);

    const refreshedGateway = createFixtureProductGateway(fixtureConfig(fundedSnapshot));
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => { releaseRefresh = resolve; });
    const bootstrap = vi.spyOn(gateway, "bootstrap").mockImplementation(async (options) => {
      await refreshGate;
      return refreshedGateway.bootstrap(options);
    });
    bootstrap.mockClear();
    fireEvent.click(within(reviewDialog()).getByRole("button", { name: "Actualizar saldo" }));
    expect(bootstrap).toHaveBeenCalledOnce();
    expect(pendingPayment.disabled).toBe(true);
    expect((within(reviewDialog()).getByRole("button", { name: "Actualizando saldo…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(request).toHaveBeenCalledTimes(3);

    await act(async () => { releaseRefresh(); await refreshGate; });
    await waitFor(() => expect(pendingPayment.disabled).toBe(false));
    expect(within(reviewDialog()).queryByRole("button", { name: "Actualizar saldo" })).toBeNull();
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("can finish with only the registered draw when the remaining draws close after a definite rejection", async () => {
    const gateway = createFixtureProductGateway(fixtureConfig(
      { catalog: threeDrawCatalog },
      { plays: threeDrawFixtures },
    ));
    const realRequest = gateway.requestPlay.bind(gateway);
    const failure = new ProductGatewayHttpError(409, "INSUFFICIENT_FUNDS", "El segundo sorteo fue rechazado.");
    const request = vi.spyOn(gateway, "requestPlay").mockImplementation(async (command, options) => {
      if (command.kind === "traditional" && command.input.drawId === threeDrawCommands[1].input.drawId) {
        throw failure;
      }
      return realRequest(command, options);
    });
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");
    fireEvent.click(chipButton(500));
    selectAllDraws();
    fireEvent.click(reviewButton());
    fireEvent.click(within(reviewDialog()).getByRole("button", { name: /^Pagar Gs\./ }));
    await screen.findByText(failure.message);

    vi.mocked(Date.now).mockReturnValue(Date.parse(threeDrawCatalog.draws[1].closesAt) + 1);
    fireEvent.focus(window);
    expect((within(reviewDialog()).getByRole("button", { name: /^Pagar pendientes Gs\./ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(reviewDialog()).getByRole("button", { name: "Terminar con las jugadas registradas" }));

    const success = await screen.findByRole("dialog", { name: "Jugada registrada" });
    expect(within(success).getByText("2 sorteos pendientes no se cobraron.")).toBeTruthy();
    expect(within(success).getByText(formatGs(500))).toBeTruthy();
    expect(success.textContent).toContain(formatGs(24_500));
    expect(screen.getByTestId("traditional-total").textContent).toBe(formatGs(500));
    expect(request.mock.calls.map(([command]) => command)).toEqual(threeDrawCommands.slice(0, 2));
    expect(screen.getByTestId("provider-play-count").textContent).toBe("1");
    expect(screen.getByTestId("provider-balance").textContent).toBe("24500");

    fireEvent.click(within(success).getByRole("button", { name: "Nueva jugada" }));
    expect(numberInput().value).toBe("");
    expect(numberInput().matches(":disabled")).toBe(false);
    expect(stakeAmount().textContent).toBe(formatGs(0));
    expect(screen.getByTestId("traditional-total").textContent).toBe(formatGs(0));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("recovers an uncertain second payment even when the third unsent draw is removed from the catalog", async () => {
    const recoveryFixtures = threeDrawFixtures.map((fixture, index) => index === 1
      ? { ...fixture, response: { ...fixture.response, replayed: true } }
      : fixture);
    const gateway = createFixtureProductGateway(fixtureConfig(
      { catalog: threeDrawCatalog },
      { plays: recoveryFixtures },
    ));
    const realRequest = gateway.requestPlay.bind(gateway);
    const failure = new Error("La respuesta del segundo sorteo se perdió.");
    let responseLost = false;
    const request = vi.spyOn(gateway, "requestPlay").mockImplementation(async (command, options) => {
      if (!responseLost && command.kind === "traditional" && command.input.drawId === threeDrawCommands[1].input.drawId) {
        responseLost = true;
        throw failure;
      }
      return realRequest(command, options);
    });
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");
    fireEvent.click(chipButton(500));
    selectAllDraws();
    fireEvent.click(reviewButton());
    fireEvent.click(within(reviewDialog()).getByRole("button", { name: /^Pagar Gs\./ }));
    await screen.findByText(failure.message);

    await refreshFixtureSnapshot(gateway, {
      catalog: { ...threeDrawCatalog, draws: threeDrawCatalog.draws.slice(0, 2) },
      session: { ...session, balance: 24_500 },
      plays: [threeDrawFixtures[0].response.play],
    });
    const retry = within(reviewDialog()).getByRole("button", { name: "Reintentar pendientes" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
    expect(within(reviewDialog()).queryByRole("button", { name: "Terminar con las jugadas registradas" })).toBeNull();
    fireEvent.click(retry);

    await screen.findByText(/Pago recuperado\. Revisá el saldo actualizado/);
    expect(request.mock.calls.map(([command]) => command)).toEqual([
      threeDrawCommands[0], threeDrawCommands[1], threeDrawCommands[1],
    ]);
    expect(request.mock.calls[2][1]?.idempotencyKey).toBe(request.mock.calls[1][1]?.idempotencyKey);
    expect(screen.getByTestId("provider-play-count").textContent).toBe("2");
    expect(within(reviewDialog()).getAllByText("Registrado")).toHaveLength(2);

    fireEvent.click(within(reviewDialog()).getByRole("button", { name: "Actualizar saldo" }));
    await waitUntilReady();
    await waitFor(() => expect(within(reviewDialog()).queryByText(/Pago recuperado\./)).toBeNull());
    expect((within(reviewDialog()).getByRole("button", { name: /^Pagar pendientes Gs\./ }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(reviewDialog()).getByRole("button", { name: "Terminar con las jugadas registradas" })).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("dialog", { name: /^Jugadas? registradas?$/ })).toBeNull();
  });

  it("permanently blocks an unconfirmed payment after logging in again with the same user ID", async () => {
    const failure = new Error("La respuesta del pago se perdió.");
    const gateway = createFixtureProductGateway(fixtureConfig({}, {
      login: { session },
      failures: { requestPlay: failure },
    }));
    const request = vi.spyOn(gateway, "requestPlay");
    const login = vi.spyOn(gateway, "login");
    renderGame("head", gateway);
    await waitUntilReady();
    enterNumber("123");
    fireEvent.click(chipButton(500));
    fireEvent.click(reviewButton());
    fireEvent.click(within(reviewDialog()).getByRole("button", { name: /^Pagar Gs\./ }));
    await screen.findByText(failure.message);

    fireEvent.click(screen.getByTestId("login-product-state"));
    await waitUntilReady();
    expect(login).toHaveBeenCalledOnce();
    expect(screen.getByTestId("provider-session-id").textContent).toBe(session.id);
    fireEvent.click(within(reviewDialog()).getByRole("button", { name: "Reintentar pendientes" }));

    await screen.findByText(/^La sesión cambió\./);
    expect(request).toHaveBeenCalledOnce();
    expect((within(reviewDialog()).getByRole("button", { name: "Reintentar pendientes" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(reviewDialog(), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Revisar pendientes" }));
    const retry = within(reviewDialog()).getByRole("button", { name: "Reintentar pendientes" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(true);
    await act(async () => { fireEvent.click(retry); });
    expect(request).toHaveBeenCalledOnce();
    expectUnchangedAccount();
  });

  it.each(["the original draw closes", "the same draw ID moves to tomorrow"])(
    "does not resend an unconfirmed payment after %s, even after reopening the popup",
    async (change) => {
      const failure = new Error("No recibimos la respuesta del pago.");
      const gateway = createFixtureProductGateway(fixtureConfig({}, { failures: { requestPlay: failure } }));
      const request = vi.spyOn(gateway, "requestPlay");
      renderGame("head", gateway);
      await waitUntilReady();
      enterNumber("123");
      fireEvent.click(chipButton(500));
      fireEvent.click(reviewButton());
      fireEvent.click(within(reviewDialog()).getByRole("button", { name: /^Pagar Gs\./ }));
      await screen.findByText(failure.message);

      if (change === "the original draw closes") {
        vi.mocked(Date.now).mockReturnValue(Date.parse(catalog.draws[0].closesAt) + 1);
        fireEvent.focus(window);
      } else {
        await refreshFixtureSnapshot(gateway, {
          catalog: {
            ...catalog,
            draws: catalog.draws.map((draw) => ({
              ...draw,
              drawsAt: new Date(Date.parse(draw.drawsAt) + 86_400_000).toISOString(),
              closesAt: new Date(Date.parse(draw.closesAt) + 86_400_000).toISOString(),
            })),
          },
        });
      }

      const retry = within(reviewDialog()).getByRole("button", { name: "Reintentar pendientes" }) as HTMLButtonElement;
      expect(retry.disabled).toBe(true);
      await act(async () => { fireEvent.click(retry); });
      fireEvent.keyDown(reviewDialog(), { key: "Escape" });
      expect(numberInput().matches(":disabled")).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Revisar pendientes" }));
      expect((within(reviewDialog()).getByRole("button", { name: "Reintentar pendientes" }) as HTMLButtonElement).disabled).toBe(true);
      expect(within(reviewDialog()).getByRole("link", { name: "Revisar Mis jugadas" }).getAttribute("href")).toBe("/mis-jugadas");
      expect(request).toHaveBeenCalledOnce();
      expectUnchangedAccount();
    },
  );
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
    expect(stakeAmount().textContent).toBe(formatGs(0));
    expect(amountFields().matches(":disabled")).toBe(true);
    fireEvent.click(reviewButton());
    expect(request).not.toHaveBeenCalled();
    await act(async () => { release(); await gate; });
    await waitUntilReady();
    expect(numberInput().value).toBe("");
    expect(stakeAmount().textContent).toBe(formatGs(0));
  });

  it.each<[string, Partial<ProductSnapshot>]>([
    ["missing session", { session: null }],
    ["unavailable game", { catalog: { ...catalog, traditional: [] } }],
    ["empty amounts", { catalog: { ...catalog, amounts: [] } }],
    ["only excluded amounts", { catalog: { ...catalog, amounts: [20_000, 50_000] } }],
    ["empty draws", { catalog: { ...catalog, draws: [] } }],
    ["closed draws", { catalog: { ...catalog, draws: catalog.draws.map((draw) => ({ ...draw, closesAt: new Date(now - 1).toISOString() })) } }],
  ])("does not submit with %s", async (name, snapshot) => {
    const gateway = createFixtureProductGateway(fixtureConfig(snapshot));
    const request = vi.spyOn(gateway, "requestPlay");
    renderGame("head", gateway);
    await waitUntilReady();
    const input = screen.queryByRole("textbox", { name: "Número de tres cifras" });
    if (input) {
      fireEvent.change(input, { target: { value: "123" } });
      fireEvent.blur(input);
    }
    if (["missing session", "empty draws", "closed draws"].includes(name)) {
      fireEvent.click(chipButton(500));
    }
    if (name === "closed draws") {
      for (const checkbox of drawCheckboxes()) {
        expect(checkbox.disabled).toBe(true);
        expect(checkbox.checked).toBe(false);
      }
      expect(screen.queryByRole("button", { name: "Quitar cerrados" })).toBeNull();
    }

    expect(reviewButton().disabled).toBe(true);
    fireEvent.click(reviewButton());
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("provider-play-count").textContent).toBe("0");
  });
});
