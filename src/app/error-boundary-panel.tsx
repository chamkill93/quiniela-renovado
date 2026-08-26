import Link from "next/link";

import styles from "./error-boundary.module.css";

type RecoverableError = Error & { digest?: string };

type ErrorBoundaryPanelProps = {
  error: RecoverableError;
  onRetry: () => void;
  scope: "route" | "global";
};

export function ErrorBoundaryPanel({
  error,
  onRetry,
  scope,
}: ErrorBoundaryPanelProps) {
  const isGlobal = scope === "global";

  return (
    <section
      aria-labelledby={`${scope}-error-title`}
      className={styles.panel}
      role="alert"
    >
      <div className={styles.brand} aria-label="quinie.LA">
        <span>quinie</span><span className={styles.brandAccent}>.LA</span>
      </div>

      <div className={styles.statusIcon} aria-hidden="true">!</div>
      <p className={styles.eyebrow}>No pudimos cargar esta pantalla</p>
      <h1 className={styles.title} id={`${scope}-error-title`}>
        {isGlobal ? "La aplicación necesita recargarse" : "Algo salió mal"}
      </h1>
      <p className={styles.description}>
        {isGlobal
          ? "Recargá la página para iniciar quinie.LA nuevamente."
          : "Podés reintentar ahora. Tu jugada no se repetirá automáticamente."}
      </p>

      {error.digest ? (
        <p className={styles.reference}>Referencia: {error.digest}</p>
      ) : null}

      <div className={styles.actions}>
        <button className={styles.primaryAction} onClick={onRetry} type="button">
          Reintentar
        </button>
        <Link className={styles.secondaryAction} href="/">
          Ir al inicio
        </Link>
      </div>
    </section>
  );
}
