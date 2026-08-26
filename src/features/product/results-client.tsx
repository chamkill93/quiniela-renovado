"use client";

import { useProduct } from "@/providers/product-provider";

import { mapPublishedResults } from "./product-view-mappers";
import { DrawIcon } from "./draw-icon";
import drawIconStyles from "./draw-icon.module.css";
import {
  RemoteEmptyState,
  RemoteErrorState,
  RemoteLoadingState,
  RemoteUnauthorizedState,
} from "./remote-view-state";
import { SectionHeader } from "./section-header";
import styles from "./product.module.css";

function formatOccurredAt(value: string | null) {
  if (!value) return "Publicado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Publicado";
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Asuncion",
  }).format(date);
}

export function ResultsClient() {
  const { catalog, results, session, loading, error, unauthorized, refresh } = useProduct();

  const unavailable = !catalog && !loading;
  const drawResults = catalog
    ? mapPublishedResults(catalog, results, "DRAW")
    : [];
  const drawIdsByResult = new Map(
    results.flatMap((result) =>
      result.source === "DRAW" && result.drawId
        ? [[result.id, result.drawId] as const]
        : [],
    ),
  );
  const instantResults = catalog
    ? mapPublishedResults(catalog, results, "INSTANT")
    : [];

  return (
    <main className={`${styles.page} ${styles.pageStack}`}>
      <SectionHeader
        description="Consultá las publicaciones y los resultados disponibles."
        eyebrow="Información verificable"
        title="Resultados"
      />

      {loading && !catalog ? <RemoteLoadingState label="Cargando resultados…" /> : null}
      {unavailable && unauthorized ? (
        <RemoteUnauthorizedState message="Iniciá sesión para consultar los resultados disponibles." />
      ) : null}
      {unavailable && !unauthorized && error ? <RemoteErrorState message={error} onRetry={() => void refresh()} /> : null}
      {unavailable && !unauthorized && !error ? (
        <RemoteEmptyState message="Todavía no hay información de resultados." />
      ) : null}

      {catalog ? (
        <>
          {loading ? <RemoteLoadingState label="Actualizando resultados…" /> : null}
          {error ? <RemoteErrorState message={error} onRetry={() => void refresh()} /> : null}

          <section aria-label="Resultados de sorteos publicados">
            <SectionHeader
              description="Cada número y fecha pertenece a una publicación autoritativa."
              eyebrow="Sorteos"
              headingLevel={2}
              title="Resultados publicados"
            />
            {drawResults.length === 0 ? (
              <RemoteEmptyState message="No hay sorteos publicados." />
            ) : (
              <div className={styles.drawGrid}>
                {drawResults.map((result) => (
                  <article className={styles.drawCard} data-tone={result.tone} key={result.id}>
                    <div className={drawIconStyles.cardHeader}>
                      <DrawIcon drawId={drawIdsByResult.get(result.id) ?? ""} label={result.label} />
                      <span>{result.label}</span>
                    </div>
                    <strong>{result.result}</strong>
                    <div className={styles.drawMeta}>
                      <span>{formatOccurredAt(result.occurredAt)}</span>
                      <span>Publicado</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section aria-label="Resultados instantáneos de la cuenta">
            <SectionHeader
              description="Historial asociado a tu cuenta."
              eyebrow="Historial reciente"
              headingLevel={2}
              title="Resultados instantáneos"
            />
            {unauthorized || !session ? (
              <RemoteUnauthorizedState message="Iniciá sesión para ver los resultados de tus Instantáneas." />
            ) : instantResults.length === 0 ? (
              <RemoteEmptyState message="Tus próximas Instantáneas confirmadas aparecerán acá." />
            ) : (
              <div className={styles.list}>
                {instantResults.map((result) => (
                  <article className={styles.listItem} key={result.id}>
                    <div>
                      <h3>{result.label}</h3>
                      <p>{formatOccurredAt(result.occurredAt)}</p>
                    </div>
                    <div className={styles.listAmount}>{result.result}</div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
