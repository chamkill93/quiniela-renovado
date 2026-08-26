import { describe, expect, it } from "vitest";

import type { GamingCatalog, WalletMovement } from "@/lib/gaming/types";
import type {
  MockResult,
  MockSession,
  MockTicket,
  PlayResponse,
} from "@/lib/product/api-types";
import {
  createFixtureProductGateway,
  FixtureProductGatewayMissingResponseError,
  ProductGatewayHttpError,
  type FixtureProductGatewayConfig,
  type ProductPlayCommand,
  type ProductTopUpResponse,
} from "@/lib/product/gateway";

const catalog: GamingCatalog = {
  amounts: [500],
  draws: [],
  traditional: [],
  instant: [],
};

const session: MockSession = {
  id: "fixture-user",
  displayName: "Respuesta pregrabada",
  role: "PLAYER",
  balance: 10_000,
  currency: "PYG",
};

const playCommand: ProductPlayCommand = {
  kind: "instant",
  input: { gameId: "sapyaite", amount: 500, selection: "PAR" },
};

const ticket: MockTicket = {
  id: "fixture-ticket",
  code: "QL-FIXTURE",
  playId: "fixture-play",
  gameId: "sapyaite",
  gameName: "Sapy’aite",
  family: "INSTANT",
  drawId: null,
  amount: 500,
  currency: "PYG",
  prize: 7_777,
  status: "WON",
  selection: "PAR",
  resultNumbers: ["246"],
  issuedAt: "2026-08-25T12:00:00.000Z",
};

const playResponse: PlayResponse = {
  play: {
    id: "fixture-play",
    ticketId: "fixture-ticket",
    family: "INSTANT",
    gameId: "sapyaite",
    gameName: "Sapy’aite",
    selection: "PAR",
    drawId: null,
    amount: 500,
    prize: 7_777,
    status: "WON",
    createdAt: "2026-08-25T12:00:00.000Z",
    resultNumbers: ["246"],
  },
  ticket,
  session: { balance: 3_333, currency: "PYG" },
  replayed: false,
};

const result: MockResult = {
  id: "fixture-result",
  gameId: "sapyaite",
  resultNumbers: ["246"],
};

const movement: WalletMovement = {
  id: "fixture-movement",
  type: "TOPUP",
  amount: 12_345,
  currency: "PYG",
  balanceAfter: 98_765,
  referenceId: null,
  method: "CASH_POINT",
  createdAt: "2026-08-25T12:01:00.000Z",
};

const topUpResponse: ProductTopUpResponse = {
  session: { ...session, balance: 98_765 },
  balanceEntry: movement,
  replayed: false,
};

function completeFixtures(): FixtureProductGatewayConfig {
  return structuredClone({
    bootstrap: { session, catalog, plays: [], results: [result] },
    login: { session },
    register: { session },
    plays: [{ command: playCommand, response: playResponse }],
    tickets: [ticket],
    results: [result],
    movements: [movement],
    topUp: topUpResponse,
  });
}

describe("FixtureProductGateway", () => {
  it("returns deterministic clones and keeps registration explicitly non-persistent", async () => {
    const fixtures = completeFixtures();
    const gateway = createFixtureProductGateway(fixtures);
    const first = await gateway.bootstrap();

    (first.catalog.amounts as number[])[0] = 99_999;
    first.results[0].resultNumbers?.push("mutated");
    fixtures.bootstrap!.session!.balance = -1;

    const second = await gateway.bootstrap();
    expect(second).toEqual({
      session,
      catalog,
      plays: [],
      results: [result],
    });
    expect(second).not.toBe(first);
    expect(second.catalog).not.toBe(first.catalog);

    await expect(
      gateway.login({ documentOrPhone: "ignored", password: "ignored" }),
    ).resolves.toEqual({ session, source: "preview-fixture" });
    await expect(
      gateway.register({
        displayName: "No reemplaza el fixture",
        documentOrPhone: "ignored",
        password: "ignored",
        acceptedTerms: true,
      }),
    ).resolves.toEqual({ session, source: "preview-fixture" });
    expect(gateway.capabilities).toEqual({
      wallet: true,
      persistentRegistration: false,
    });
  });

  it("replays exact injected responses without calculating or mutating business state", async () => {
    const gateway = createFixtureProductGateway(completeFixtures());

    const firstPlay = await gateway.requestPlay({
      input: { selection: "PAR", amount: 500, gameId: "sapyaite" },
      kind: "instant",
    });
    firstPlay.play.resultNumbers?.push("changed-by-consumer");

    await expect(gateway.requestPlay(playCommand)).resolves.toEqual(playResponse);
    await expect(gateway.getTicket(ticket.id)).resolves.toEqual(ticket);
    await expect(
      gateway.topUp({ amount: 12_345, method: "CASH_POINT" }),
    ).resolves.toEqual(topUpResponse);
    await expect(gateway.getResults()).resolves.toEqual([result]);
    await expect(gateway.getMovements()).resolves.toEqual([movement]);

    const unchanged = await gateway.bootstrap();
    expect(unchanged.session?.balance).toBe(10_000);
    expect(unchanged.plays).toEqual([]);
    expect(unchanged.results).toEqual([result]);
  });

  it("fails explicitly for absent or unmatched response fixtures", async () => {
    const gateway = createFixtureProductGateway({
      movements: [],
      plays: [{ command: playCommand, response: playResponse }],
    });

    expect(gateway.capabilities.wallet).toBe(false);
    await expect(gateway.bootstrap()).rejects.toMatchObject({
      name: "FixtureProductGatewayMissingResponseError",
      operation: "bootstrap",
    });
    await expect(
      gateway.login({ documentOrPhone: "user", password: "password" }),
    ).rejects.toMatchObject({ operation: "login" });
    await expect(
      gateway.register({
        displayName: "User",
        documentOrPhone: "user",
        password: "password",
        acceptedTerms: true,
      }),
    ).rejects.toMatchObject({ operation: "register" });
    await expect(
      gateway.requestPlay({
        kind: "instant",
        input: { gameId: "sapyaite", amount: 500, selection: "IMPAR" },
      }),
    ).rejects.toBeInstanceOf(FixtureProductGatewayMissingResponseError);
    await expect(gateway.getResults()).rejects.toMatchObject({
      operation: "getResults",
    });
    await expect(gateway.getTicket("missing-ticket")).rejects.toMatchObject({
      operation: "getTicket",
    });
    await expect(gateway.getMovements()).resolves.toEqual([]);
    await expect(
      createFixtureProductGateway().getMovements(),
    ).rejects.toMatchObject({ operation: "getMovements" });
    await expect(
      gateway.topUp({ amount: 50_000, method: "CARD" }),
    ).rejects.toMatchObject({ operation: "topUp" });
  });

  it("honors AbortSignal before returning any fixture", async () => {
    const gateway = createFixtureProductGateway(completeFixtures());
    const preAborted = new AbortController();
    preAborted.abort();

    await expect(
      gateway.getResults({ signal: preAborted.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    await expect(
      gateway.getTicket(ticket.id, { signal: preAborted.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });

    const duringCall = new AbortController();
    const pending = gateway.requestPlay(playCommand, {
      signal: duringCall.signal,
    });
    duringCall.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("injects immediate HTTP, timeout and network failures by operation", async () => {
    const sessionExpired = new ProductGatewayHttpError(
      401,
      "SESSION_EXPIRED",
      "Sesión vencida",
    );
    const throttled = new ProductGatewayHttpError(
      429,
      "RATE_LIMITED",
      "Demasiadas solicitudes",
    );
    const timeout = new ProductGatewayHttpError(
      0,
      "GATEWAY_TIMEOUT",
      "Tiempo de espera agotado",
    );
    const network = new ProductGatewayHttpError(
      0,
      "GATEWAY_NETWORK_ERROR",
      "Sin conexión",
    );
    const userExistsErrors: Error[] = [];
    const gateway = createFixtureProductGateway({
      ...completeFixtures(),
      failures: {
        bootstrap: sessionExpired,
        register: (operation) => {
          expect(operation).toBe("register");
          const error = new ProductGatewayHttpError(
            409,
            "USER_EXISTS",
            "El usuario ya existe",
          );
          userExistsErrors.push(error);
          return error;
        },
        requestPlay: throttled,
        getTicket: throttled,
        getResults: timeout,
        getMovements: network,
        logout: network,
      },
    });

    await expect(gateway.bootstrap()).rejects.toBe(sessionExpired);
    await expect(gateway.requestPlay(playCommand)).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
    });
    await expect(gateway.getTicket(ticket.id)).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
    });
    await expect(gateway.getResults()).rejects.toMatchObject({
      status: 0,
      code: "GATEWAY_TIMEOUT",
    });
    await expect(gateway.getMovements()).rejects.toBe(network);
    await expect(gateway.logout()).rejects.toBe(network);

    const registration = {
      displayName: "Ana",
      documentOrPhone: "1234567",
      password: "password",
      acceptedTerms: true,
    };
    await expect(gateway.register(registration)).rejects.toMatchObject({
      status: 409,
      code: "USER_EXISTS",
    });
    await expect(gateway.register(registration)).rejects.toMatchObject({
      status: 409,
      code: "USER_EXISTS",
    });
    expect(userExistsErrors).toHaveLength(2);
    expect(userExistsErrors[0]).not.toBe(userExistsErrors[1]);
  });
});
