export interface MockApiGuardEnvironment {
  nodeEnv?: string;
  gatewayMode?: string;
}

/**
 * Preview routes are opt-in in production. Development and test retain the
 * local preview when no gateway mode was supplied, but an explicit non-preview
 * mode always closes the routes.
 */
export function isMockApiAvailable({
  nodeEnv,
  gatewayMode,
}: MockApiGuardEnvironment): boolean {
  const mode = gatewayMode?.trim().toLowerCase();
  if (mode === "preview") return true;
  if (mode) return false;
  return nodeEnv?.trim().toLowerCase() !== "production";
}
