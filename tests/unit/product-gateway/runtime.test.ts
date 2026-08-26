import { describe, expect, it } from "vitest";
import {
  createProductGateway,
  ProductGatewayConfigurationError,
  resolveBackofficeProductConfiguration,
  type PublicProductGatewayEnvironment,
} from "@/lib/product/gateway";
import type { BackofficeClient } from "@/lib/backoffice";

function completeEnvironment(): PublicProductGatewayEnvironment {
  return {
    NEXT_PUBLIC_PRODUCT_GATEWAY_MODE: "backoffice",
    NEXT_PUBLIC_BACKOFFICE_BASE_URL: "https://backoffice.example/v2",
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_SESSION: "auth/session",
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_BOOTSTRAP: "bootstrap",
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGIN: "auth/login",
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_REGISTER: "auth/register",
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGOUT: "auth/logout",
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_CATALOG: "catalog",
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_PLAYS: "plays",
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TRADITIONAL_PLAYS: "plays/traditional",
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_INSTANT_PLAYS: "plays/instant",
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_RESULTS: "results",
  };
}

describe("product gateway runtime composition", () => {
  it("fails closed when explicit backoffice configuration is incomplete", () => {
    expect(() =>
      createProductGateway({
        environment: {
          NEXT_PUBLIC_PRODUCT_GATEWAY_MODE: "backoffice",
          NEXT_PUBLIC_BACKOFFICE_BASE_URL: "https://backoffice.example",
        },
      }),
    ).toThrow(ProductGatewayConfigurationError);
    expect(resolveBackofficeProductConfiguration({})).toBeNull();
  });

  it("rejects an unknown gateway mode instead of enabling preview", () => {
    expect(() =>
      createProductGateway({
        environment: { NEXT_PUBLIC_PRODUCT_GATEWAY_MODE: "production" },
      }),
    ).toThrow("debe ser preview o backoffice");
  });

  it("requires an explicit mode in production instead of serving preview", () => {
    expect(() =>
      createProductGateway({
        environment: {},
        runtimeEnvironment: "production",
      }),
    ).toThrow("debe configurarse explícitamente en producción");
  });

  it("selects backoffice only after every required endpoint is explicit", () => {
    const environment = completeEnvironment();
    delete environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_BOOTSTRAP;
    const gateway = createProductGateway({ environment });

    expect(gateway.mode).toBe("backoffice");
    expect(gateway.capabilities).toEqual({
      wallet: false,
      persistentRegistration: true,
    });
    expect(resolveBackofficeProductConfiguration(environment)).toMatchObject({
      baseUrl: "https://backoffice.example/v2",
      endpoints: { register: "auth/register", results: "results" },
    });
  });

  it("enables external wallet only when both optional paths are supplied", () => {
    const oneEndpoint = completeEnvironment();
    oneEndpoint.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_MOVEMENTS =
      "wallet/movements";
    expect(createProductGateway({ environment: oneEndpoint }).capabilities.wallet).toBe(
      false,
    );

    const bothEndpoints = {
      ...oneEndpoint,
      NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_TOPUP: "wallet/topup",
    };
    expect(createProductGateway({ environment: bothEndpoints }).capabilities.wallet).toBe(
      true,
    );
  });

  it("lets a host declare capabilities of an injected backoffice client", () => {
    const gateway = createProductGateway({
      mode: "backoffice",
      environment: {},
      backoffice: {
        client: {} as BackofficeClient,
        walletAvailable: true,
      },
    });

    expect(gateway.capabilities.wallet).toBe(true);
  });

  it("maps optional ticket and timeout configuration without assuming paths", () => {
    const environment = {
      ...completeEnvironment(),
      NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TICKET: "tickets/{ticketId}",
      NEXT_PUBLIC_BACKOFFICE_TIMEOUT_MS: "9000",
    };

    expect(resolveBackofficeProductConfiguration(environment)).toMatchObject({
      timeoutMs: 9_000,
      endpoints: { ticket: "tickets/{ticketId}" },
    });
  });

  it("lets preview mode override an otherwise complete external config", () => {
    const gateway = createProductGateway({
      mode: "preview",
      environment: completeEnvironment(),
    });
    expect(gateway.mode).toBe("preview");
  });
});
