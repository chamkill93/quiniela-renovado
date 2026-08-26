import type { ReactNode } from "react";
import styles from "./result-state.module.css";

export type ResultVisualState = "won" | "lost" | "pending" | "receipt" | "refunded";

export function resultVisualState(status: string): ResultVisualState {
  switch (status.trim().toUpperCase()) {
    case "WON":
      return "won";
    case "LOST":
      return "lost";
    case "REFUNDED":
      return "refunded";
    case "RECEIPT":
      return "receipt";
    default:
      return "pending";
  }
}

export function resultStateLabel(status: string) {
  const state = resultVisualState(status);
  return {
    won: "¡Ganaste!",
    lost: "No ganaste",
    pending: "En proceso",
    receipt: "Comprobante",
    refunded: "Reintegrada",
  }[state];
}

function ResultStateIcon({ state }: { state: ResultVisualState }) {
  const paths: Record<ResultVisualState, ReactNode> = {
    won: (
      <>
        <path d="M15 8h18v8c0 9-4.3 15.2-9 17-4.7-1.8-9-8-9-17Z" />
        <path d="M15 12H8v4c0 7 3.5 11 10 12M33 12h7v4c0 7-3.5 11-10 12M24 33v6M16 41h16" />
        <path d="m24 13 1.7 3.4 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5Z" />
      </>
    ),
    lost: (
      <>
        <circle cx="24" cy="24" r="16" />
        <path d="m18 18 12 12M30 18 18 30" />
      </>
    ),
    pending: (
      <>
        <circle cx="24" cy="24" r="16" />
        <path d="M24 14v11l7 4" />
      </>
    ),
    receipt: (
      <>
        <path d="M10 15h28v7a5 5 0 0 0 0 10v7H10v-7a5 5 0 0 0 0-10Z" />
        <path d="M18 20v14M24 20v14M30 20v14" />
      </>
    ),
    refunded: (
      <>
        <path d="M13 16H7v-6M8 16a17 17 0 1 1-1 13" />
        <path d="m7 16 8-8" />
      </>
    ),
  };

  return (
    <span className={styles.icon} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        {paths[state]}
      </svg>
    </span>
  );
}

export function ResultStateBadge({
  status,
  label,
  className = "",
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const state = resultVisualState(status);

  return (
    <span className={`${styles.badge} ${className}`.trim()} data-result-state={state}>
      <ResultStateIcon state={state} />
      <span>{label ?? resultStateLabel(status)}</span>
    </span>
  );
}

export function ResultStateCard({
  status,
  title,
  description,
  meta,
  live = false,
  className = "",
}: {
  status: string;
  title?: string;
  description?: ReactNode;
  meta?: ReactNode;
  live?: boolean;
  className?: string;
}) {
  const state = resultVisualState(status);

  return (
    <div
      aria-live={live ? "polite" : undefined}
      className={`${styles.card} ${className}`.trim()}
      data-result-state={state}
      role={live ? "status" : undefined}
    >
      <ResultStateIcon state={state} />
      <strong className={styles.title}>{title ?? resultStateLabel(status)}</strong>
      {description ? <span className={styles.description}>{description}</span> : null}
      {meta ? <span className={styles.meta}>{meta}</span> : null}
    </div>
  );
}
