"use client";

import { ErrorBoundaryPanel } from "./error-boundary-panel";
import styles from "./error-boundary.module.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="es">
      <body className={styles.globalBody}>
        <main className={styles.globalRoot}>
          <ErrorBoundaryPanel error={error} onRetry={reset} scope="global" />
        </main>
      </body>
    </html>
  );
}
