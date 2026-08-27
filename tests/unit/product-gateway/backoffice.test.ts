import { describe, expect, it, vi } from "vitest";
import type { BackofficeClient, BackofficeSession } from "@/lib/backoffice";
import { DRAW_POSTURE_COUNT } from "@/lib/gaming/types";
import type {
  GamingPlay,
  GamingResult,
  GamingTicket,
  WalletMovement,
} from "@/lib/gaming/types";
import { buildGamingCatalog } from "@/lib/gaming";
import {
  createBackofficeProductGateway,
  ProductGatewayCapabilityError,
} from "@/lib/product/gateway";

const session: BackofficeSession = {
  id: "user-1",
  displayName: "Ana",
  role: "PLAYER",
  balance: 75_000,
  currency: "PYG",
};

const ticket: GamingTicket = {
  id: "ticket-1",
  code: "QL-TICKET1",
  playId: "play-1",
  family: "INSTANT",
  gameId: "sapyaite",
  gameName: "Sapy’aite",
  selection: "246",
  drawId: null,
  amount: 500,
  currency: "PYG",
  status: "WON",
  result: "246",
  resultNumbers: ["246"],
  ruleResult: "246",
  prize: 350_000,
  issuedAt: "2026-08-25T12:00:00.000Z",
};

const play: GamingPlay = {
  id: "play-1",
  ticketId: ticket.id,
  family: ticket.family,
  gameId: ticket.gameId,
  gameName: ticket.gameName,
  selection: ticket.selection,
  drawId: ticket.drawId,
  amount: ticket.amount,
  currency: ticket.currency,
  status: ticket.status,
  result: ticket.result,
  resultNumbers: ticket.resultNumbers,
  ruleResult: ticket.ruleResult,
  matches: null,
  payoutMultiplier: 700,
  prize: ticket.prize,
  createdAt: ticket.issuedAt,
};

const result: GamingResult = {
  id: "result-1",
  source: "INSTANT",
  gameId: ticket.gameId,
  gameName: ticket.gameName,
  drawId: null,
  result: "246",
  resultNumbers: ["246"],
  occurredAt: ticket.issuedAt,
};

const movement: WalletMovement = {
  id: "movement-1",
  type: "TOPUP",
  amount: 20_000,
  currency: "PYG",
  balanceAfter: 75_000,
  referenceId: null,
  method: "CASH_POINT",
  createdAt: "2026-08-25T12:00:00.000Z",
};

function partialClient(
  methods: Partial<BackofficeClient>,
): BackofficeClient {
  return methods as BackofficeClient;
}

describe("BackofficeProductGateway", () => {
  it("keeps withdrawals disabled without inventing an external endpoint", async () => {
    const topUp = vi.fn();
    const gateway = createBackofficeProductGateway({ client: partialClient({ topUp }), walletAvailable: true });

    expect(gateway.capabilities.withdrawal).toBe(false);
    await expect(gateway.withdraw({ amount: 20_000, method: "QR" }))
      .rejects.toMatchObject({ capability: "withdrawal" });
    expect(topUp).not.toHaveBeenCalled();
  });

  it("hydrates from separated auth and gaming capabilities", async () => {
    const catalog = buildGamingCatalog(
      "REFUND",
      new Date("2026-08-25T12:00:00.000Z"),
    );
    const getSession = vi.fn(async () => ({ session }));
    const getCatalog = vi.fn(async () => ({ catalog }));
    const getPlays = vi.fn(async () => ({ plays: [] }));
    const getResults = vi.fn(async () => ({ results: [] }));
    const bootstrap = vi.fn();
    const gateway = createBackofficeProductGateway({
      client: partialClient({
        getSession,
        getCatalog,
        getPlays,
        getResults,
        bootstrap,
      }),
    });

    await expect(gateway.bootstrap()).resolves.toMatchObject({
      session,
      catalog,
      plays: [],
      results: [],
    });
    expect(getSession).toHaveBeenCalledOnce();
    expect(getCatalog).toHaveBeenCalledOnce();
    expect(getPlays).toHaveBeenCalledWith({ limit: 50 }, undefined);
    expect(getResults).toHaveBeenCalledWith({ limit: 100 }, undefined);
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it("copies explicit draw positions without generating positions for legacy results", async () => {
    const legacyResult: GamingResult = {
      ...result,
      id: "legacy-draw",
      source: "DRAW",
      gameId: "prizes",
      gameName: "A los Premios",
      drawId: "early",
    };
    const drawNumbers = [{ position: DRAW_POSTURE_COUNT, value: "007" }, { position: 1, value: "497" }];
    const positionedResult: GamingResult = { ...legacyResult, id: "positioned-draw", drawNumbers };
    const remoteResults = [positionedResult, legacyResult];
    const gateway = createBackofficeProductGateway({
      client: partialClient({
        getSession: vi.fn(async () => ({ session })),
        getCatalog: vi.fn(async () => ({ catalog: buildGamingCatalog("REFUND", new Date("2026-08-25T12:00:00.000Z")) })),
        getPlays: vi.fn(async () => ({ plays: [] })),
        getResults: vi.fn(async () => ({ results: remoteResults })),
      }),
    });

    const snapshot = await gateway.bootstrap();
    const refreshed = await gateway.getResults();
    expect(snapshot.results).toEqual(remoteResults);
    expect(refreshed).toEqual(remoteResults);
    expect(snapshot.results[0].drawNumbers).not.toBe(drawNumbers);
    expect(snapshot.results[0].drawNumbers?.[0]).not.toBe(drawNumbers[0]);
    expect(snapshot.results[1]).not.toHaveProperty("drawNumbers");
    snapshot.results[0].drawNumbers![0].value = "changed-by-consumer";
    expect(drawNumbers[0].value).toBe("007");
    expect(refreshed[0].drawNumbers?.[0].value).toBe("007");
  });

  it("bounds histories even when the backoffice returns more than requested", async () => {
    const catalog = buildGamingCatalog(
      "REFUND",
      new Date("2026-08-25T12:00:00.000Z"),
    );
    const remotePlays = Array.from({ length: 75 }, (_, index) => ({
      ...play,
      id: `play-${index + 1}`,
    }));
    const remoteResults = Array.from({ length: 125 }, (_, index) => ({
      ...result,
      id: `result-${index + 1}`,
    }));
    const remoteMovements = Array.from({ length: 75 }, (_, index) => ({
      ...movement,
      id: `movement-${index + 1}`,
    }));
    const getPlays = vi.fn(async () => ({ plays: remotePlays }));
    const getResults = vi.fn(async () => ({ results: remoteResults }));
    const getMovements = vi.fn(async () => ({ movements: remoteMovements }));
    const gateway = createBackofficeProductGateway({
      client: partialClient({
        getSession: vi.fn(async () => ({ session })),
        getCatalog: vi.fn(async () => ({ catalog })),
        getPlays,
        getResults,
        getMovements,
      }),
      walletAvailable: true,
    });

    const snapshot = await gateway.bootstrap();
    const refreshedResults = await gateway.getResults();
    const movements = await gateway.getMovements();

    expect(snapshot.plays).toHaveLength(50);
    expect(snapshot.plays.at(-1)?.id).toBe("play-50");
    expect(snapshot.results).toHaveLength(100);
    expect(snapshot.results.at(-1)?.id).toBe("result-100");
    expect(refreshedResults).toHaveLength(100);
    expect(movements).toHaveLength(50);
    expect(movements.at(-1)?.id).toBe("movement-50");
    expect(getPlays).toHaveBeenCalledWith({ limit: 50 }, undefined);
    expect(getResults).toHaveBeenNthCalledWith(1, { limit: 100 }, undefined);
    expect(getResults).toHaveBeenNthCalledWith(2, { limit: 100 }, undefined);
    expect(getMovements).toHaveBeenCalledWith({ limit: 50 }, undefined);
  });

  it("forwards registration to the external client and marks it persistent", async () => {
    const register = vi.fn(async () => ({ session }));
    const gateway = createBackofficeProductGateway({
      client: partialClient({ register }),
    });
    const input = {
      displayName: "Ana",
      documentOrPhone: "1234567",
      password: "secure-password",
      acceptedTerms: true,
    };

    await expect(gateway.register(input)).resolves.toEqual({
      session,
      source: "backoffice",
    });
    expect(register).toHaveBeenCalledWith(input, undefined);
    expect(gateway.capabilities.persistentRegistration).toBe(true);
  });

  it("delegates optional wallet operations to the validated backoffice client", async () => {
    const getMovements = vi.fn(async () => ({ movements: [movement] }));
    const topUp = vi.fn(async () => ({
      session,
      balanceEntry: movement,
      replayed: false,
    }));
    const gateway = createBackofficeProductGateway({
      client: partialClient({ getMovements, topUp }),
      walletAvailable: true,
    });

    await expect(gateway.getMovements()).resolves.toEqual([movement]);
    await expect(
      gateway.topUp(
        { amount: 20_000, method: "CASH_POINT" },
        { idempotencyKey: "topup-key" },
      ),
    ).resolves.toMatchObject({ session, balanceEntry: movement });
    expect(getMovements).toHaveBeenCalledWith({ limit: 50 }, undefined);
    expect(topUp).toHaveBeenCalledWith(
      { amount: 20_000, method: "CASH_POINT" },
      { idempotencyKey: "topup-key" },
    );
  });

  it("delegates ticket lookup and maps the validated backoffice response", async () => {
    const getTicket = vi.fn(async () => ({ ticket }));
    const gateway = createBackofficeProductGateway({
      client: partialClient({ getTicket }),
    });
    const controller = new AbortController();

    await expect(
      gateway.getTicket("ticket-1", { signal: controller.signal }),
    ).resolves.toMatchObject({
      id: "ticket-1",
      code: "QL-TICKET1",
      playId: "play-1",
      resultNumbers: ["246"],
      createdAt: ticket.issuedAt,
    });
    expect(getTicket).toHaveBeenCalledWith("ticket-1", {
      signal: controller.signal,
    });
  });

  it("does not invent wallet routes when the capability is unconfigured", async () => {
    const gateway = createBackofficeProductGateway({
      client: partialClient({}),
    });

    expect(gateway.capabilities.wallet).toBe(false);
    await expect(gateway.getMovements()).rejects.toBeInstanceOf(
      ProductGatewayCapabilityError,
    );
  });
});
