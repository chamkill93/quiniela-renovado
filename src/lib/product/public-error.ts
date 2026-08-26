const INTERNAL_TERMS = /\b(?:backoffice|proveedor|codexa|kodexa)\b/gi;

/** Keeps infrastructure vocabulary and provider names out of player-facing errors. */
export function publicProductErrorMessage(reason: unknown, fallback: string) {
  const raw = reason instanceof Error
    ? reason.message
    : typeof reason === "string"
      ? reason
      : fallback;
  const normalized = raw.trim().replace(INTERNAL_TERMS, "servicio");
  return (normalized || fallback).slice(0, 300);
}
