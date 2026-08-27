"use client";

import { useMemo, useRef, useState } from "react";
import { useProduct } from "@/providers/product-provider";
import { mapPublishedResults } from "./product-view-mappers";
import { DrawIcon } from "./draw-icon";
import { paginateDrawDays, selectDailyDrawResults, type DailyDraw, type DailyPublication } from "./results-page-data";
import {
  RemoteEmptyState, RemoteErrorState, RemoteLoadingState, RemoteUnauthorizedState,
} from "./remote-view-state";
import { SectionHeader } from "./section-header";
import styles from "./product.module.css";
import resultStyles from "./results.module.css";

function formatOccurredAt(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Asuncion",
  }).format(new Date(value));
}

function PublicationNumbers({ publication }: { publication: DailyPublication }) {
  return (
    <div className={resultStyles.publication}>
      <h4>{publication.label}</h4>
      <ul aria-label={publication.label} className={resultStyles.values}>
        {publication.values.map((value, index) => <li key={`${publication.id}-${index}`}>{value}</li>)}
      </ul>
    </div>
  );
}

function DailyDrawCard({ draw, dateKey }: { draw: DailyDraw; dateKey: string }) {
  const primary = draw.publications.find((item) => item.gameId === "head") ?? draw.publications[0];
  const hasDetails = draw.publications.length > 1 || (primary?.values.length ?? 0) > 1;
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
            <span>{primary.label}</span>
            <strong data-testid="daily-draw-number">{primary.values[0]}</strong>
            {primary.occurredAt ? <time dateTime={primary.occurredAt}>Publicado a las {primary.timeLabel}</time> : null}
          </div>
          {hasDetails ? (
            <details className={resultStyles.details}>
              <summary>Ver todos los números</summary>
              {draw.publications.map((publication) => <PublicationNumbers key={publication.id} publication={publication} />)}
            </details>
          ) : null}
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

function DatePagination({ pagination, placement, onChange }: {
  pagination: ReturnType<typeof paginateDrawDays>;
  placement: "top" | "bottom";
  onChange: (page: number) => void;
}) {
  if (pagination.pageCount <= 1) return null;
  return (
    <nav aria-label={placement === "top" ? "Paginación de fechas" : "Paginación de fechas inferior"} className={resultStyles.pagination}>
      <button aria-controls="daily-results-history" disabled={pagination.page === 0} onClick={() => onChange(pagination.page - 1)} type="button">← Más recientes</button>
      <div aria-live={placement === "top" ? "polite" : "off"} aria-atomic="true">
        <strong>Página {pagination.page + 1} de {pagination.pageCount}</strong>
        <span>Días {pagination.from}–{pagination.to} de {pagination.totalDays}</span>
      </div>
      <button aria-controls="daily-results-history" disabled={pagination.page + 1 === pagination.pageCount} onClick={() => onChange(pagination.page + 1)} type="button">Días anteriores →</button>
    </nav>
  );
}

export function ResultsClient() {
  const { catalog, results, session, loading, error, unauthorized, refresh, gatewayMode } = useProduct();
  const [selectedDate, setSelectedDate] = useState("");
  const [page, setPage] = useState(0);
  const historyRef = useRef<HTMLElement>(null);
  const unavailable = !catalog && !loading;
  const grouped = useMemo(() => catalog ? selectDailyDrawResults(catalog, results, selectedDate) : null, [catalog, results, selectedDate]);
  const instantResults = catalog ? mapPublishedResults(catalog, results, "INSTANT") : [];
  const pagination = paginateDrawDays(grouped?.days ?? [], selectedDate ? 0 : page);

  function changeDate(value: string) {
    setSelectedDate(value);
    setPage(0);
  }

  function changePage(value: number) {
    setPage(value);
    // Keep keyboard users and readers at the beginning of the new date range.
    historyRef.current?.focus({ preventScroll: true });
    historyRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  return (
    <main className={`${styles.page} ${styles.pageStack}`}>
      <SectionHeader description="Los cuatro sorteos de cada día, ordenados por fecha." eyebrow="Sorteos diarios" title="Resultados" />
      {loading && !catalog ? <RemoteLoadingState label="Cargando resultados…" /> : null}
      {unavailable && unauthorized ? <RemoteUnauthorizedState message="Iniciá sesión para consultar los resultados disponibles." /> : null}
      {unavailable && !unauthorized && error ? <RemoteErrorState message={error} onRetry={() => void refresh()} /> : null}
      {unavailable && !unauthorized && !error ? <RemoteEmptyState message="Todavía no hay información de resultados." /> : null}

      {catalog && grouped ? (
        <>
          {loading ? <RemoteLoadingState label="Actualizando resultados…" /> : null}
          {error ? <RemoteErrorState message={error} onRetry={() => void refresh()} /> : null}
          <div className={resultStyles.toolbar}>
            <label className={resultStyles.dateField} htmlFor="results-date">
              Buscar por fecha
              <input id="results-date" onChange={(event) => changeDate(event.target.value)} type="date" value={selectedDate} />
            </label>
            <button className={resultStyles.clear} disabled={!selectedDate} onClick={() => changeDate("")} type="button">Ver todas las fechas</button>
            <p className={resultStyles.hint}>
              Fechas y horas de Paraguay.{gatewayMode === "preview" ? " Resultados de muestra." : ""}
            </p>
          </div>

          <DatePagination onChange={changePage} pagination={pagination} placement="top" />
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
          <DatePagination onChange={changePage} pagination={pagination} placement="bottom" />

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

          <section aria-label="Resultados instantáneos de la cuenta">
            <SectionHeader description="Tus resultados personales, separados de los sorteos diarios." eyebrow="Mi historial" headingLevel={2} title="Resultados instantáneos" />
            {unauthorized || !session ? (
              <RemoteUnauthorizedState message="Iniciá sesión para ver tus resultados instantáneos." />
            ) : instantResults.length === 0 ? (
              <p className={resultStyles.historyEmpty} role="status">Tus próximas jugadas instantáneas confirmadas aparecerán acá.</p>
            ) : (
              <div className={styles.list}>
                {instantResults.map((result) => (
                  <article className={styles.listItem} key={result.id}>
                    <div><h3>{result.label}</h3><p>{formatOccurredAt(result.occurredAt)}</p></div>
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
