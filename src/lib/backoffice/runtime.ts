import type { BackofficeEndpoints } from "./contracts";
import {
  createBackofficeClient,
  type BackofficeFetch,
  type BackofficeHeadersFactory,
} from "./http-client";

export interface RuntimeBackofficeClientConfig {
  endpoints: Readonly<BackofficeEndpoints>;
  baseUrl?: string;
  headers?: HeadersInit | BackofficeHeadersFactory;
  fetch?: BackofficeFetch;
}

/**
 * Composition boundary for the application. Endpoint paths stay explicit
 * because the external backoffice contract has not been supplied yet.
 */
export function createRuntimeBackofficeClient(config: RuntimeBackofficeClientConfig) {
  const baseUrl = config.baseUrl ?? process.env.NEXT_PUBLIC_BACKOFFICE_BASE_URL ?? "";
  if (!baseUrl.trim()) {
    throw new Error("Falta configurar NEXT_PUBLIC_BACKOFFICE_BASE_URL.");
  }

  return createBackofficeClient({
    baseUrl,
    endpoints: config.endpoints,
    headers: config.headers,
    fetch: config.fetch,
  });
}
