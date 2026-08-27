import "server-only";

import { DEFAULT_ENABLED_INSTANT_GAME_IDS } from "./catalog";
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
  new MockGamingProvider({
    enabledInstantGameIds: DEFAULT_ENABLED_INSTANT_GAME_IDS,
    neutral500Policy: neutralPolicyFromEnvironment(),
  });

if (process.env.NODE_ENV !== "production") {
  // Refresh methods after hot updates while keeping the existing session data.
  Object.setPrototypeOf(mockGamingProvider, MockGamingProvider.prototype);
  globalThis.__quinieMockGamingProvider = mockGamingProvider;
}
