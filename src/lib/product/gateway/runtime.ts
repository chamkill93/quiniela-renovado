import {
  createBackofficeClient,
  type BackofficeClient,
  type BackofficeFetch,
  type BackofficeHeadersFactory,
} from "@/lib/backoffice";

import {
  createBackofficeProductGateway,
  type BackofficeProductGatewayConfig,
} from "./backoffice";
import type {
  ProductBackofficeConfiguration,
  ProductGateway,
  ProductGatewayMode,
  PublicProductGatewayEnvironment,
} from "./contracts";
import {
  createPreviewProductGateway,
  type PreviewProductGatewayConfig,
} from "./preview";

export interface ProductGatewayBackofficeRuntimeConfig {
  /** Useful for composition tests or a host-provided authenticated client. */
  client?: BackofficeClient;
  /** Capabilities of an injected client that cannot be inferred from env paths. */
  walletAvailable?: boolean;
  configuration?: ProductBackofficeConfiguration;
  headers?: HeadersInit | BackofficeHeadersFactory;
  fetch?: BackofficeFetch;
}

export interface ProductGatewayRuntimeConfig {
  mode?: ProductGatewayMode;
  environment?: PublicProductGatewayEnvironment;
  /** Injectable so production fail-closed behavior can be tested deterministically. */
  runtimeEnvironment?: "development" | "test" | "production";
  preview?: PreviewProductGatewayConfig;
  backoffice?: ProductGatewayBackofficeRuntimeConfig;
}

export class ProductGatewayConfigurationError extends Error {
  readonly code = "INCOMPLETE_BACKOFFICE_CONFIGURATION";

  constructor(message = "El modo backoffice requiere URL base y todos los endpoints obligatorios.") {
    super(
      message,
    );
    this.name = "ProductGatewayConfigurationError";
  }
}

export function readPublicProductGatewayEnvironment(): PublicProductGatewayEnvironment {
  return {
    NEXT_PUBLIC_PRODUCT_GATEWAY_MODE:
      process.env.NEXT_PUBLIC_PRODUCT_GATEWAY_MODE,
    NEXT_PUBLIC_BACKOFFICE_BASE_URL:
      process.env.NEXT_PUBLIC_BACKOFFICE_BASE_URL,
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_SESSION:
      process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_SESSION,
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_BOOTSTRAP:
      process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_BOOTSTRAP,
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGIN:
      process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGIN,
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_REGISTER:
      process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_REGISTER,
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGOUT:
      process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGOUT,
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_CATALOG:
      process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_CATALOG,
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_PLAYS:
      process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_PLAYS,
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TRADITIONAL_PLAYS:
      process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TRADITIONAL_PLAYS,
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_INSTANT_PLAYS:
      process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_INSTANT_PLAYS,
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_RESULTS:
      process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_RESULTS,
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TICKET:
      process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TICKET,
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_MOVEMENTS:
      process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_MOVEMENTS,
    NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_TOPUP:
      process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_TOPUP,
    NEXT_PUBLIC_BACKOFFICE_TIMEOUT_MS:
      process.env.NEXT_PUBLIC_BACKOFFICE_TIMEOUT_MS,
  };
}

function configured(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

export function resolveBackofficeProductConfiguration(
  environment: PublicProductGatewayEnvironment,
): ProductBackofficeConfiguration | null {
  const baseUrl = environment.NEXT_PUBLIC_BACKOFFICE_BASE_URL;
  const endpointValues = {
    session: environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_SESSION,
    login: environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGIN,
    register: environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_REGISTER,
    logout: environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGOUT,
    catalog: environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_CATALOG,
    plays: environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_PLAYS,
    traditionalPlays:
      environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TRADITIONAL_PLAYS,
    instantPlays: environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_INSTANT_PLAYS,
    results: environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_RESULTS,
  };

  if (!configured(baseUrl) || !Object.values(endpointValues).every(configured)) {
    return null;
  }

  const movements =
    environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_MOVEMENTS;
  const topUp = environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_TOPUP;
  const walletEndpoints =
    configured(movements) && configured(topUp)
      ? { walletMovements: movements, walletTopUp: topUp }
      : {};
  const ticket = environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TICKET;
  const ticketEndpoint = configured(ticket) ? { ticket } : {};
  const bootstrap = environment.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_BOOTSTRAP;
  const bootstrapEndpoint = configured(bootstrap) ? { bootstrap } : {};
  const timeoutValue = environment.NEXT_PUBLIC_BACKOFFICE_TIMEOUT_MS;
  const rawTimeout = configured(timeoutValue) ? Number(timeoutValue) : Number.NaN;
  const timeoutMs =
    Number.isFinite(rawTimeout) && rawTimeout >= 0 ? rawTimeout : undefined;

  return {
    baseUrl,
    endpoints: {
      ...(endpointValues as ProductBackofficeConfiguration["endpoints"]),
      ...walletEndpoints,
      ...ticketEndpoint,
      ...bootstrapEndpoint,
    },
    timeoutMs,
  };
}

function requestedMode(
  explicitMode: ProductGatewayMode | undefined,
  environment: PublicProductGatewayEnvironment,
  runtimeEnvironment: "development" | "test" | "production",
) {
  if (explicitMode) return explicitMode;
  const value = environment.NEXT_PUBLIC_PRODUCT_GATEWAY_MODE?.trim().toLowerCase();
  if (!value) {
    if (runtimeEnvironment === "production") {
      throw new ProductGatewayConfigurationError(
        "NEXT_PUBLIC_PRODUCT_GATEWAY_MODE debe configurarse explícitamente en producción.",
      );
    }
    return undefined;
  }
  if (value === "preview" || value === "backoffice") return value;
  throw new ProductGatewayConfigurationError(
    "NEXT_PUBLIC_PRODUCT_GATEWAY_MODE debe ser preview o backoffice.",
  );
}

function composeBackofficeGateway(
  runtime: ProductGatewayBackofficeRuntimeConfig,
  environmentConfiguration: ProductBackofficeConfiguration | null,
): ProductGateway | null {
  const configuration = runtime.configuration ?? environmentConfiguration;
  const client =
    runtime.client ??
    (configuration
      ? createBackofficeClient({
          baseUrl: configuration.baseUrl,
          endpoints: configuration.endpoints,
          headers: runtime.headers,
          fetch: runtime.fetch,
          timeoutMs: configuration.timeoutMs,
        })
      : undefined);

  if (!client) return null;

  const productConfig: BackofficeProductGatewayConfig = {
    client,
    walletAvailable:
      runtime.walletAvailable ??
      Boolean(
        configuration?.endpoints.walletMovements &&
          configuration.endpoints.walletTopUp,
      ),
  };
  return createBackofficeProductGateway(productConfig);
}

/**
 * Selects backoffice only with an explicit client or a complete public
 * configuration. Explicit backoffice mode fails closed when incomplete;
 * preview remains the development default when no mode was requested.
 */
export function createProductGateway(
  config: ProductGatewayRuntimeConfig = {},
): ProductGateway {
  const environment =
    config.environment ?? readPublicProductGatewayEnvironment();
  const runtimeEnvironment =
    config.runtimeEnvironment ??
    (process.env.NODE_ENV === "production"
      ? "production"
      : process.env.NODE_ENV === "test"
        ? "test"
        : "development");
  const mode = requestedMode(config.mode, environment, runtimeEnvironment);

  if (mode !== "preview") {
    const gateway = composeBackofficeGateway(
      config.backoffice ?? {},
      resolveBackofficeProductConfiguration(environment),
    );
    if (gateway) return gateway;
    if (mode === "backoffice") {
      throw new ProductGatewayConfigurationError();
    }
  }

  return createPreviewProductGateway(config.preview);
}
