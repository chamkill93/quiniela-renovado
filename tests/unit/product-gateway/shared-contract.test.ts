import { describe, expect, it } from "vitest";

import {
  createBackofficeClient,
  type BackofficeEndpoints,
} from "@/lib/backoffice";
import type { PlacePlayResponse } from "@/lib/gaming/types";
import type { PlayResponse } from "@/lib/product/api-types";
import {
  createBackofficeProductGateway,
  createFixtureProductGateway,
  createPreviewProductGateway,
  ProductGatewayProtocolError,
  type ProductGateway,
  type ProductPlayCommand,
  type ProductTopUpInput,
  type ProductTopUpResponse,
} from "@/lib/product/gateway";

const playCommand: ProductPlayCommand = {
  kind: "instant",
  input: { gameId: "sapyaite", amount: 500, selection: "007" },
};

const topUpInput: ProductTopUpInput = {
  amount: 20_000,
  method: "CASH_POINT",
};

type SharedPlayResponse = PlacePlayResponse & PlayResponse;

interface ContractResponses {
  play: SharedPlayResponse;
  topUp: ProductTopUpResponse;
}

interface GatewayAdapter {
  name: string;
  create(responses: ContractResponses): ProductGateway;
}

function playResponse(selection = "007"): SharedPlayResponse {
  return {
    play: {
      id: "play-contract-1",
      ticketId: "ticket-contract-1",
      family: "INSTANT",
      gameId: "sapyaite",
      gameName: "Sapy’aite",
      selection,
      drawId: null,
      amount: 500,
      currency: "PYG",
      status: "LOST",
      result: "497",
      resultNumbers: ["497"],
      ruleResult: "497",
      matches: null,
      payoutMultiplier: 0,
      prize: 0,
      createdAt: "2026-08-25T12:00:00.000Z",
    },
    ticket: {
      id: "ticket-contract-1",
      code: "QL-CONTRACT-1",
      playId: "play-contract-1",
      gameId: "sapyaite",
      gameName: "Sapy’aite",
      family: "INSTANT",
      selection,
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
    session: { balance: 99_500, currency: "PYG" },
    replayed: false,
  };
}

function topUpResponse(
  method: ProductTopUpInput["method"] = topUpInput.method,
): ProductTopUpResponse {
  return {
    session: {
      id: "user-contract-1",
      displayName: "Usuario contrato",
      role: "PLAYER",
      balance: 120_000,
      currency: "PYG",
    },
    balanceEntry: {
      id: "movement-contract-1",
      type: "TOPUP",
      amount: topUpInput.amount,
      currency: "PYG",
      balanceAfter: 120_000,
      referenceId: null,
      method,
      createdAt: "2026-08-25T12:01:00.000Z",
    },
    replayed: false,
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const backofficeEndpoints: BackofficeEndpoints = {
  session: "/auth/session",
  login: "/auth/login",
  register: "/auth/register",
  logout: "/auth/logout",
  catalog: "/gaming/catalog",
  plays: "/gaming/plays",
  traditionalPlays: "/gaming/plays/traditional",
  instantPlays: "/gaming/plays/instant",
  results: "/gaming/results",
  ticket: "/gaming/tickets/{ticketId}",
  walletMovements: "/wallet/movements",
  walletTopUp: "/wallet/topup",
};

const adapters: readonly GatewayAdapter[] = [
  {
    name: "FixtureProductGateway",
    create: (responses) =>
      createFixtureProductGateway({
        plays: [{ command: playCommand, response: responses.play }],
        tickets: [responses.play.ticket],
        movements: [],
        topUp: responses.topUp,
      }),
  },
  {
    name: "PreviewProductGateway",
    create: (responses) =>
      createPreviewProductGateway({
        fetch: async (input) => {
          const url = String(input);
          if (url.endsWith("/instant")) return jsonResponse(responses.play);
          if (url.endsWith("/tickets/ticket-contract-1")) {
            return jsonResponse({ ticket: responses.play.ticket });
          }
          if (url.endsWith("/topup")) return jsonResponse(responses.topUp);
          throw new Error(`Unexpected contract request: ${url}`);
        },
      }),
  },
  {
    name: "BackofficeProductGateway",
    create: (responses) => {
      const client = createBackofficeClient({
        baseUrl: "https://backoffice.contract.test",
        endpoints: backofficeEndpoints,
        timeoutMs: 0,
        fetch: async (input) => {
          const url = String(input);
          if (url.endsWith("/gaming/plays/instant")) {
            return jsonResponse(responses.play);
          }
          if (url.endsWith("/gaming/tickets/ticket-contract-1")) {
            return jsonResponse({ ticket: responses.play.ticket });
          }
          if (url.endsWith("/wallet/topup")) {
            return jsonResponse(responses.topUp);
          }
          throw new Error(`Unexpected backoffice contract request: ${url}`);
        },
      });
      return createBackofficeProductGateway({
        client,
        walletAvailable: true,
      });
    },
  },
];

describe.each(adapters)("shared ProductGateway contract: $name", (adapter) => {
  it("retrieves the authoritative ticket associated with a play", async () => {
    const response = playResponse();
    const gateway = adapter.create({ play: response, topUp: topUpResponse() });

    await expect(gateway.getTicket(response.play.ticketId)).resolves.toMatchObject({
      id: response.ticket.id,
      code: response.ticket.code,
      playId: response.play.id,
      amount: response.play.amount,
      resultNumbers: response.play.resultNumbers,
    });
  });

  it("accepts a play response correlated with the submitted command", async () => {
    const response = playResponse();
    const gateway = adapter.create({ play: response, topUp: topUpResponse() });

    await expect(gateway.requestPlay(playCommand)).resolves.toMatchObject({
      play: {
        family: "INSTANT",
        gameId: playCommand.input.gameId,
        amount: playCommand.input.amount,
        selection: playCommand.input.selection,
        resultNumbers: ["497"],
      },
      ticket: {
        family: "INSTANT",
        gameId: playCommand.input.gameId,
        amount: playCommand.input.amount,
      },
      session: { balance: 99_500, currency: "PYG" },
      replayed: false,
    });
  });

  it("rejects a valid response that belongs to another play command", async () => {
    const gateway = adapter.create({
      play: playResponse("999"),
      topUp: topUpResponse(),
    });

    await expect(gateway.requestPlay(playCommand)).rejects.toBeInstanceOf(
      ProductGatewayProtocolError,
    );
  });

  it("accepts a top-up response correlated with the submitted command", async () => {
    const response = topUpResponse();
    const gateway = adapter.create({ play: playResponse(), topUp: response });

    await expect(gateway.topUp(topUpInput)).resolves.toEqual(response);
  });

  it("rejects a valid top-up response associated with another method", async () => {
    const gateway = adapter.create({
      play: playResponse(),
      topUp: topUpResponse("BANK_TRANSFER"),
    });

    await expect(gateway.topUp(topUpInput)).rejects.toBeInstanceOf(
      ProductGatewayProtocolError,
    );
  });
});
