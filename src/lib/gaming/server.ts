import "server-only";

import { MockGamingProvider } from "./mock-provider";
import type { PyaeNeutralPolicy } from "./types";

declare global {
  var __quinieMockGamingProvider: MockGamingProvider | undefined;
}

function neutralPolicyFromEnvironment(): PyaeNeutralPolicy {
  return process.env.MOCK_PYAE_500_POLICY === "LOSS" ? "LOSS" : "REFUND";
}

export const mockGamingProvider =
  globalThis.__quinieMockGamingProvider ??
  new MockGamingProvider({ neutral500Policy: neutralPolicyFromEnvironment() });

if (process.env.NODE_ENV !== "production") {
  globalThis.__quinieMockGamingProvider = mockGamingProvider;
}
