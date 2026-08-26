import { describe, expect, it, vi } from "vitest";
import type { BackofficeClient, BackofficeSession } from "@/lib/backoffice";
import type { GamingTicket, WalletMovement } from "@/lib/gaming/types";
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
  selection: "PAR",
  drawId: null,
  amount: 500,
  currency: "PYG",
  status: "WON",
  result: "246",
  resultNumbers: ["246"],
  ruleResult: "EVEN",
  prize: 1_000,
  issuedAt: "2026-08-25T12:00:00.000Z",
};

function partialClient(
  methods: Partial<BackofficeClient>,
): BackofficeClient {
  return methods as BackofficeClient;
}

describe("BackofficeProductGateway", () => {
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
    expect(getPlays).toHaveBeenCalledOnce();
    expect(getResults).toHaveBeenCalledOnce();
    expect(bootstrap).not.toHaveBeenCalled();
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
    expect(getMovements).toHaveBeenCalledWith({}, undefined);
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
