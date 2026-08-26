"use client";

import { ErrorBoundaryPanel } from "./error-boundary-panel";
import styles from "./error-boundary.module.css";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RouteError({ error, reset }: RouteErrorProps) {
  return (
    <main className={styles.routeRoot}>
      <ErrorBoundaryPanel error={error} onRetry={reset} scope="route" />
    </main>
  );
}
