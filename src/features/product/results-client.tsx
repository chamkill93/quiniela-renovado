"use client";

import { useMemo, useRef, useState } from "react";
import { useProduct } from "@/providers/product-provider";
import { DrawIcon } from "./draw-icon";
import { paginateDrawDays, selectDailyDrawResults, selectDrawPostures, type DailyDraw } from "./results-page-data";
import {
  RemoteEmptyState, RemoteErrorState, RemoteLoadingState, RemoteUnauthorizedState,
} from "./remote-view-state";
import styles from "./product.module.css";
import resultStyles from "./results.module.css";

function formatOccurredAt(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Asuncion",
  }).format(new Date(value));
}

function DrawPostures({ draw, postures }: { draw: DailyDraw; postures: ReturnType<typeof selectDrawPostures> }) {
  const unpositioned = draw.publications.some((publication) => publication.drawNumbers !== undefined) ? []
    : draw.publications.flatMap((publication) => publication.gameId === "head" ? publication.values.slice(1) : publication.values);
  return (
    <div className={resultStyles.postures}>
      <h4>Posturas del sorteo</h4>
      <table aria-label={`Posturas de ${draw.label}`} className={resultStyles.postureTable}>
        <thead><tr><th scope="col">Postura</th><th scope="col">Número</th></tr></thead>
        <tbody>
          {postures.map(({ position, value }) => (
            <tr data-head={position === 1 ? "true" : undefined} data-position={position} key={position}>
              <th scope="row">
                {position}ª
                {position === 1 ? <span className={resultStyles.headLabel}>A la cabeza</span> : null}
              </th>
              <td>{value ?? <span aria-label="Postura sin informar" className={resultStyles.postureUnavailable}>—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {unpositioned.length > 0 ? (
        <div className={resultStyles.unpositioned}>
          <p className={resultStyles.hint}>Números sin postura informada</p>
          <ul aria-label="Números sin postura informada" className={resultStyles.values}>
            {unpositioned.map((value, index) => <li key={index}>{value}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DailyDrawCard({ draw, dateKey }: { draw: DailyDraw; dateKey: string }) {
  const primary = draw.publications.find((item) => item.drawNumbers !== undefined) ?? draw.publications.find((item) => item.gameId === "head") ?? draw.publications[0];
  const postures = selectDrawPostures(draw);
  const titleId = `result-${dateKey}-${draw.id}`;
  return (
    <article aria-labelledby={titleId} className={resultStyles.drawCard} data-draw-id={draw.id} data-state={primary ? "published" : "unpublished"} data-testid="daily-draw-card">
      <header className={resultStyles.drawHeader}>
        <DrawIcon drawId={draw.id} label={draw.label} size="sm" />
        <div>
          <h3 id={titleId}>{draw.label}</h3>
          <span className={resultStyles.status}>{primary ? "Publicado" : "Sin publicar"}</span>
        </div>
      </header>
      {primary ? (
        <>
          <div className={resultStyles.primary}>
            <span>A la Cabeza</span>
            <strong aria-label={postures[0].value ? undefined : "A la cabeza sin informar"} data-testid="daily-draw-number">{postures[0].value ?? "—"}</strong>
            {primary.occurredAt ? <time dateTime={primary.occurredAt}>Publicado a las {primary.timeLabel}</time> : null}
          </div>
          <details className={resultStyles.details}>
            <summary>Ver todos los números</summary>
            <DrawPostures draw={draw} postures={postures} />
          </details>
        </>
      ) : (
        <div className={resultStyles.missing}>
          <strong>Sin resultado</strong>
          <p>Todavía no hay una publicación para este sorteo.</p>
        </div>
      )}
    </article>
  );
}

function DatePagination({ pagination, onChange }: {
  pagination: ReturnType<typeof paginateDrawDays>;
  onChange: (page: number) => void;
}) {
  if (pagination.pageCount <= 1) return null;
  return (
    <nav aria-label="Paginación de fechas" className={resultStyles.pagination}>
      <button aria-controls="daily-results-history" disabled={pagination.page === 0} onClick={() => onChange(pagination.page - 1)} type="button">← Más recientes</button>
      <button aria-controls="daily-results-history" disabled={pagination.page + 1 === pagination.pageCount} onClick={() => onChange(pagination.page + 1)} type="button">Días anteriores →</button>
    </nav>
  );
}

export function ResultsClient() {
  const { catalog, results, loading, error, unauthorized, refresh } = useProduct();
  const [page, setPage] = useState(0);
  const historyRef = useRef<HTMLElement>(null);
  const unavailable = !catalog && !loading;
  const grouped = useMemo(() => catalog ? selectDailyDrawResults(catalog, results) : null, [catalog, results]);
  const pagination = paginateDrawDays(grouped?.days ?? [], page);

  function changePage(value: number) {
    setPage(value);
    // Keep keyboard users and readers at the beginning of the new date range.
    historyRef.current?.focus({ preventScroll: true });
    historyRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  return (
    <main className={`${styles.page} ${styles.pageStack}`}>
      <header className={resultStyles.heading}>
        <h1 className={styles.title}>Resultados</h1>
        {catalog && grouped ? <DatePagination onChange={changePage} pagination={pagination} /> : null}
      </header>
      {loading && !catalog ? <RemoteLoadingState label="Cargando resultados…" /> : null}
      {unavailable && unauthorized ? <RemoteUnauthorizedState message="Iniciá sesión para consultar los resultados disponibles." /> : null}
      {unavailable && !unauthorized && error ? <RemoteErrorState message={error} onRetry={() => void refresh()} /> : null}
      {unavailable && !unauthorized && !error ? <RemoteEmptyState message="Todavía no hay información de resultados." /> : null}

      {catalog && grouped ? (
        <>
          {loading ? <RemoteLoadingState label="Actualizando resultados…" /> : null}
          {error ? <RemoteErrorState message={error} onRetry={() => void refresh()} /> : null}
          <section aria-label="Resultados de sorteos por fecha" className={resultStyles.days} id="daily-results-history" ref={historyRef} tabIndex={-1}>
            {pagination.days.length === 0 ? <RemoteEmptyState message="No hay sorteos publicados por fecha." /> : pagination.days.map((day) => (
              <section aria-labelledby={`results-date-${day.dateKey}`} className={resultStyles.day} data-date={day.dateKey} data-testid="results-day" key={day.dateKey}>
                <header className={resultStyles.dayHeader}>
                  <h2 id={`results-date-${day.dateKey}`}><time dateTime={day.dateKey}>{day.dateLabel}</time></h2>
                  <span>{day.draws.filter((draw) => draw.publications.length > 0).length} de 4 sorteos publicados</span>
                </header>
                <div className={resultStyles.drawGrid} data-testid="daily-results-grid">
                  {day.draws.map((draw) => <DailyDrawCard dateKey={day.dateKey} draw={draw} key={draw.id} />)}
                </div>
              </section>
            ))}
          </section>

          {grouped.other.length > 0 ? (
            <section aria-label="Otros resultados publicados" className={resultStyles.other}>
              <h2>Otros resultados publicados</h2>
              <p className={resultStyles.hint}>Publicaciones sin fecha o sorteo diario identificado, o de otros sorteos.</p>
              {grouped.other.map((publication) => (
                <article key={publication.id}>
                  <h3>{publication.label}</h3>
                  <p className={resultStyles.hint}>{formatOccurredAt(publication.occurredAt)}</p>
                  <ul className={resultStyles.values}>{publication.values.map((value, index) => <li key={index}>{value}</li>)}</ul>
                </article>
              ))}
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
