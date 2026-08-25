import type { CSSProperties, HTMLAttributes } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  width?: number | string;
  height?: number | string;
  circle?: boolean;
}

function cssLength(value: number | string | undefined) {
  if (typeof value === "number") return `${value}px`;
  return value;
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  circle = false,
  className = "",
  style,
  ...props
}: SkeletonProps) {
  const mergedStyle: CSSProperties = {
    ...style,
    width: cssLength(width),
    height: cssLength(height),
  };

  return (
    <span
      {...props}
      className={`q-skeleton ${circle ? "q-skeleton--circle" : ""} ${className}`.trim()}
      style={mergedStyle}
      aria-hidden="true"
    />
  );
}

export interface SkeletonCardProps extends HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

export function SkeletonCard({ lines = 3, className = "", ...props }: SkeletonCardProps) {
  return (
    <div {...props} className={`q-card q-skeleton-card ${className}`.trim()} aria-busy="true" aria-label="Cargando contenido">
      <Skeleton width="42%" height="1.1rem" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={index === lines - 1 ? "68%" : "100%"} height=".8rem" />
      ))}
    </div>
  );
}

export interface SkeletonListProps extends HTMLAttributes<HTMLDivElement> {
  count?: number;
}

export function SkeletonList({ count = 4, className = "", ...props }: SkeletonListProps) {
  return (
    <div {...props} className={`q-skeleton-list ${className}`.trim()} aria-busy="true" aria-label="Cargando lista">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} lines={2} />
      ))}
    </div>
  );
}
