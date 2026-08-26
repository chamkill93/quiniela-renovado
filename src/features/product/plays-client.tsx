"use client";

import Link from "next/link";
import { useProduct } from "@/providers/product-provider";
import { formatGs } from "@/lib/product/catalog";
import { SectionHeader } from "./section-header";
import { RemoteUnauthorizedState } from "./remote-view-state";
import styles from "./product.module.css";

function statusLabel(status: string) {
  return ({ PENDING: "Pendiente", WON: "Premiada", LOST: "Sin premio", REFUNDED: "Reintegrada" } as Record<string, string>)[status] ?? status;
}

export function PlaysClient() {
  const { plays, session, loading, error, unauthorized, refresh } = useProduct();
  return (
    <main className={styles.page}>
      <SectionHeader
        eyebrow="Tu actividad"
        title="Mis Jugadas"
        description="Cada jugada aceptada permanece disponible aunque cierres su comprobante o cambies de pantalla."
      />
      {loading ? <div className={styles.loadingBar} aria-label="Cargando jugadas" /> : null}
      {error ? <div className={styles.errorBox} role="alert">{error} <button className={styles.quietButton} onClick={() => void refresh()} type="button">Reintentar</button></div> : null}
      {!loading && !error && (unauthorized || !session) ? (
        <RemoteUnauthorizedState message="Iniciá sesión para consultar tus jugadas." />
      ) : !loading && !error && plays.length === 0 ? (
        <div className={styles.emptyState}>
          <div>
            <h2>Todavía no registraste jugadas</h2>
            <p>Cuando confirmes una Quiniela o Instantánea, aparecerá en este historial.</p>
            <Link className={styles.primaryButton} href="/quinielas">Hacer una jugada</Link>
          </div>
        </div>
      ) : (
        <div className={styles.list}>
          {plays.map((play) => (
            <article className={styles.listItem} key={play.id}>
              <div>
                <p className={styles.eyebrow}>{play.family === "INSTANT" ? "Instantánea" : "Quiniela"}</p>
                <h3>{play.gameName ?? play.gameId}</h3>
                <p>{new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Asuncion" }).format(new Date(play.createdAt))} · {statusLabel(play.status)}</p>
              </div>
              <div className={styles.listAmount}>
                {formatGs(play.amount)}
                {typeof play.prize === "number" && play.prize > 0 ? <small>Premio {formatGs(play.prize)}</small> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
