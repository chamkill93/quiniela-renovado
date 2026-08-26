import Link from "next/link";

import styles from "./product.module.css";

export function RemoteLoadingState({ label }: { label: string }) {
  return (
    <div aria-live="polite" className={styles.emptyState} role="status">
      <div aria-hidden="true" className={styles.loadingBar} />
      <p>{label}</p>
    </div>
  );
}

export function RemoteErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.errorBox} role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button className={styles.quietButton} onClick={onRetry} type="button">
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

export function RemoteEmptyState({ message }: { message: string }) {
  return <div aria-live="polite" className={styles.emptyState} role="status"><p>{message}</p></div>;
}

export function RemoteUnauthorizedState({
  message = "Iniciá sesión para consultar esta información del backoffice.",
}: {
  message?: string;
}) {
  return (
    <div aria-live="polite" className={styles.statusBox} role="status">
      <p>{message}</p>
      <Link className={styles.secondaryButton} href="/cuenta">Ir a iniciar sesión</Link>
    </div>
  );
}
