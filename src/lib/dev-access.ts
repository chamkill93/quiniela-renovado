import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const DEV_ACCESS_COOKIE_NAME = "quinie_dev_access";
export const DEFAULT_DEV_ACCESS_CODE = "Admin123#";

const DEV_ACCESS_TOKEN_VERSION = "quinie-dev-access:v1";

/**
 * The review gate fails closed: only the exact server-side value `false`
 * publishes the site without requiring the DEV cookie.
 */
export function isDevAccessRequired() {
  return process.env.DEV_ACCESS_REQUIRED !== "false";
}

function configuredAccessCode() {
  return process.env.DEV_ACCESS_CODE || DEFAULT_DEV_ACCESS_CODE;
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
    .update(DEV_ACCESS_TOKEN_VERSION, "utf8")
    .digest("base64url");
}

export function hasValidDevAccessCookie(candidate: string | undefined) {
  return typeof candidate === "string" && safelyMatches(candidate, createDevAccessCookieValue());
}
