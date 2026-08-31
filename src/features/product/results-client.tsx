"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useProduct } from "@/providers/product-provider";
import { DrawIcon } from "./draw-icon";
import { paginateDrawDays, selectDailyDrawResults, selectDrawPostures, type DailyDraw, type DailyDrawResults } from "./results-page-data";
import { useResultsCarousel } from "./use-results-carousel";
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

function postureRank(position: number) {
  return position === 1 ? "gold" : undefined;
}

function DrawPostures({ draw, id }: { draw: DailyDraw; id: string }) {
  const trackId = useId();
  const { trackRef, navigation, scrollPage, handleKeyDown } = useResultsCarousel<HTMLOListElement>();
  const postures = selectDrawPostures(draw);
  const unpositioned = draw.publications.some((publication) => publication.drawNumbers !== undefined) ? []
    : draw.publications.flatMap((publication) => publication.gameId === "head" ? publication.values.slice(1) : publication.values);
  return (
    <section aria-labelledby={`${id}-title`} className={resultStyles.postures} data-draw-id={draw.id} data-testid="draw-postures-panel" id={id}>
      <header className={resultStyles.posturesHeader}>
        <h3 id={`${id}-title`}>Posturas de {draw.label}</h3>
        <div className={resultStyles.carouselControls}>
          <button aria-controls={trackId} aria-label={`Posturas anteriores de ${draw.label}`} disabled={!navigation.previous} onClick={() => scrollPage(-1)} type="button">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="m14 6-6 6 6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
          </button>
          <button aria-controls={trackId} aria-label={`Posturas siguientes de ${draw.label}`} disabled={!navigation.next} onClick={() => scrollPage(1)} type="button">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="m10 6 6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
          </button>
        </div>
      </header>
      <ol aria-label={`Números de ${draw.label}`} aria-roledescription="carrusel" className={resultStyles.postureTrack} data-testid="draw-postures-carousel" id={trackId} onKeyDown={handleKeyDown} ref={trackRef} role="list" tabIndex={0}>
        {postures.map(({ position, value }) => {
          const rank = value === null ? undefined : postureRank(position);
          return (
            <li className={resultStyles.postureCard} data-head={position === 1 ? "true" : undefined} data-pending={value === null ? "true" : undefined} data-position={position} data-rank={rank} data-testid="draw-posture" key={position}>
              <span className={resultStyles.posturePosition}>{position}ª postura</span>
              <span aria-hidden="true" className={resultStyles.rankSlot}>
                {rank === "gold" ? (
                  <svg aria-hidden="true" className={resultStyles.rankIcon} data-rank={rank} data-testid="draw-posture-rank" focusable="false" viewBox="0 0 24 24">
                    <path d="m3 7 4.5 3L12 3l4.5 7L21 7l-2 13H5L3 7Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
                    <path d="M6.5 16.5h11M9 12l3-5 3 5" fill="none" stroke="var(--q-panel)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                  </svg>
                ) : null}
              </span>
              <strong className={resultStyles.postureNumber} data-testid="draw-posture-number">{value ?? <span aria-label="Postura sin informar" className={resultStyles.postureUnavailable}>—</span>}</strong>
              {position === 1 ? <span className={resultStyles.headLabel}>A la cabeza</span> : null}
            </li>
          );
        })}
      </ol>
      {unpositioned.length > 0 ? (
        <div className={resultStyles.unpositioned}>
          <p className={resultStyles.hint}>Números sin postura informada</p>
          <ul aria-label="Números sin postura informada" className={resultStyles.values}>
            {unpositioned.map((value, index) => <li key={index}>{value}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function DailyDrawCard({ draw, dateKey, expanded, panelId, onToggle }: {
  draw: DailyDraw;
  dateKey: string;
  expanded: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  const primary = draw.publications.find((item) => item.drawNumbers !== undefined) ?? draw.publications.find((item) => item.gameId === "head") ?? draw.publications[0];
  const postures = selectDrawPostures(draw);
  const titleId = `result-${dateKey}-${draw.id}`;
  return (
    <article aria-labelledby={titleId} className={resultStyles.drawCard} data-draw-id={draw.id} data-selected={expanded ? "true" : undefined} data-state={primary ? "published" : "unpublished"} data-testid="daily-draw-card">
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
          <button aria-controls={panelId} aria-expanded={expanded} aria-label={`${expanded ? "Ocultar números" : "Ver todos los números"} de ${draw.label}`} className={resultStyles.drawToggle} data-testid="daily-draw-toggle" onClick={onToggle} type="button">
            <span>{expanded ? "Ocultar números" : "Ver todos los números"}</span>
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
          </button>
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

function DailyResultsDay({ day }: { day: DailyDrawResults }) {
  const [selectedId, setSelectedId] = useState<DailyDraw["id"] | null>(null);
  const selectedDraw = day.draws.find((draw) => draw.id === selectedId && draw.publications.length > 0);
  const panelId = `result-postures-${day.dateKey}`;

  return (
    <section aria-labelledby={`results-date-${day.dateKey}`} className={resultStyles.day} data-date={day.dateKey} data-testid="results-day">
      <header className={resultStyles.dayHeader}>
        <h2 id={`results-date-${day.dateKey}`}><time dateTime={day.dateKey}>{day.dateLabel}</time></h2>
        <span>{day.draws.filter((draw) => draw.publications.length > 0).length} de 4 sorteos publicados</span>
      </header>
      <div className={resultStyles.drawGrid} data-testid="daily-results-grid">
        {[0, 2].map((start) => {
          const pair = day.draws.slice(start, start + 2);
          return (
            <div className={resultStyles.drawPair} data-testid="daily-draw-pair" key={start}>
              {pair.map((draw) => <DailyDrawCard dateKey={day.dateKey} draw={draw} expanded={selectedDraw?.id === draw.id} key={draw.id} onToggle={() => setSelectedId((current) => current === draw.id ? null : draw.id)} panelId={panelId} />)}
              {selectedDraw && pair.some((draw) => draw.id === selectedDraw.id) ? <DrawPostures draw={selectedDraw} id={panelId} key={selectedDraw.id} /> : null}
            </div>
          );
        })}
      </div>
    </section>
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
              <DailyResultsDay day={day} key={day.dateKey} />
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
