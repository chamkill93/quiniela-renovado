import type { CSSProperties } from "react";

import styles from "./draw-icon.module.css";

export type CanonicalDrawId = "early" | "morning" | "evening" | "night";

interface DrawIconDefinition {
  label: string;
  slug: "tempranero" | "matutino" | "vespertino" | "nocturno";
}

export interface DrawIconAssetSet extends DrawIconDefinition {
  dark: string;
  light: string;
}

interface DrawIconStyle extends CSSProperties {
  "--quinie-draw-icon-dark": string;
  "--quinie-draw-icon-light": string;
}

const DRAW_ICON_ROOT = "/assets/quinie-icons-v2/draws";

/** Canonical IDs stay separate from the presentation-only asset slugs. */
export const DRAW_ICON_DEFINITIONS = {
  early: { label: "Tempranero", slug: "tempranero" },
  morning: { label: "Matutino", slug: "matutino" },
  evening: { label: "Vespertino", slug: "vespertino" },
  night: { label: "Nocturno", slug: "nocturno" },
} as const satisfies Readonly<Record<CanonicalDrawId, DrawIconDefinition>>;

export function isCanonicalDrawId(value: string): value is CanonicalDrawId {
  return Object.hasOwn(DRAW_ICON_DEFINITIONS, value);
}

export function getDrawIconAssetSet(drawId: string): DrawIconAssetSet | null {
  if (!isCanonicalDrawId(drawId)) return null;
  const definition = DRAW_ICON_DEFINITIONS[drawId];
  return {
    ...definition,
    dark: `${DRAW_ICON_ROOT}/dark/${definition.slug}.webp`,
    light: `${DRAW_ICON_ROOT}/light/${definition.slug}.webp`,
  };
}

export function DrawIcon({
  drawId,
  label,
  size = "md",
  className,
}: {
  drawId: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const assets = getDrawIconAssetSet(drawId);
  if (!assets) return null;

  const accessibleLabel = label?.trim() || assets.label;
  const style: DrawIconStyle = {
    "--quinie-draw-icon-dark": `url("${assets.dark}")`,
    "--quinie-draw-icon-light": `url("${assets.light}")`,
  };

  return (
    <span
      aria-label={`Sorteo ${accessibleLabel}`}
      className={`${styles.icon} ${className ?? ""}`.trim()}
      data-draw-icon={drawId}
      data-draw-icon-slug={assets.slug}
      data-size={size}
      role="img"
      style={style}
    />
  );
}
