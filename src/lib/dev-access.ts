import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const DEV_ACCESS_COOKIE_NAME = "quinie_dev_access";
export const DEFAULT_DEV_ACCESS_CODE = "admin123#";

const DEV_ACCESS_TOKEN_VERSION = "quinie-dev-access:v2";

/**
 * The review gate is mandatory. Public routing is explicitly limited in proxy.ts.
 */
export function isDevAccessRequired() {
  return true;
}

function configuredAccessCode() {
  const code = process.env.DEV_ACCESS_CODE;
  // Migrate the former deployment default; custom secrets remain configurable.
  return !code || code === "Admin123#" ? DEFAULT_DEV_ACCESS_CODE : code;
}

function configuredCookieSecret() {
  return process.env.DEV_ACCESS_COOKIE_SECRET || configuredAccessCode();
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function safelyMatches(candidate: string, expected: string) {
  return timingSafeEqual(digest(candidate), digest(expected));
}

export function isValidDevAccessCode(candidate: unknown) {
  return typeof candidate === "string" && safelyMatches(candidate, configuredAccessCode());
}

export function createDevAccessCookieValue() {
  return createHmac("sha256", configuredCookieSecret())
    .update(`${DEV_ACCESS_TOKEN_VERSION}:${configuredAccessCode()}`, "utf8")
    .digest("base64url");
}

export function hasValidDevAccessCookie(candidate: string | undefined) {
  return typeof candidate === "string" && safelyMatches(candidate, createDevAccessCookieValue());
}
