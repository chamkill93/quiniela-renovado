"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { drawDateKey } from "@/lib/gaming/draw-calendar";
import { useProduct } from "@/providers/product-provider";

import { DrawIcon } from "./draw-icon";
import {
  getConfiguredDrawStreamUrl,
  getDrawPageDefinition,
  selectDrawPageSchedule,
} from "./draw-page-data";
import { DrawStreamContent } from "./draw-stream-content";
import {
  HOME_RESULT_TABS,
  selectHomeDrawCards,
  selectHomeLatestDrawResults,
  type HomeDrawCardView,
  type HomeLatestDrawResults,
  type HomeResultPositionView,
  type HomeResultTabId,
} from "./home-sections-data";
import styles from "./home-sections.module.css";
import { useDrawClock } from "./use-draw-clock";
import { useDrawScheduleRefresh } from "./use-draw-schedule-refresh";

import { MEGA_LOTO_LOGO, MEGA_LOTO_URL } from "./product-links";

function DrawCard({
  draw,
  expanded,
  disabled,
  onToggle,
}: {
  draw: HomeDrawCardView;
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const dateLabel = draw.dateLabel ? `, ${draw.dateLabel}` : "";
  const nextLabel = draw.isNext ? ", próximo sorteo" : "";

  return (
    <button
      aria-controls="home-draw-stream"
      aria-expanded={expanded}
      aria-label={`${expanded ? "Ocultar" : "Ver"} sorteo: ${draw.label}, ${draw.timeLabel}${dateLabel}${nextLabel}`}
      className={styles.drawCard}
      data-active={draw.isNext ? "true" : "false"}
      data-draw-id={draw.id}
      data-draw-slug={draw.slug}
      data-testid="home-draw-card"
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      {draw.isNext ? <span className={styles.nextBadge}>PRÓXIMO</span> : null}
      <DrawIcon
        className={styles.drawIcon}
        drawId={draw.id}
        label={draw.label}
        size="lg"
      />
      <span className={styles.drawContent}>
        <span className={styles.drawLabel}>{draw.label}</span>
        <strong className={styles.drawTime}>{draw.timeLabel}</strong>
        <span className={styles.drawDate}>
          {draw.dateLabel ?? "Horario por confirmar"}
        </span>
      </span>
      {draw.isNext && draw.statusLabel ? (
        <span className={styles.drawFooter}>
          <time
            aria-label={draw.statusLabel}
            className={styles.drawStatus}
            data-testid="home-draw-countdown"
            dateTime={draw.targetAt ?? undefined}
          >
            {draw.statusLabel.replace(/^EN (\d+)H (\d+)M (\d+)S$/, "$1:$2:$3")}
          </time>
          <span className={styles.drawAction} data-testid="home-next-draw-action">
            <svg
              aria-hidden="true"
              className={styles.drawActionIcon}
              data-state={expanded ? "collapse" : "play"}
              focusable="false"
              viewBox="0 0 16 16"
            >
              {expanded ? (
                <path d="m4 10 4-4 4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              ) : (
                <path d="M5 3.5a.75.75 0 0 1 1.12-.65l7 4a.75.75 0 0 1 0 1.3l-7 4A.75.75 0 0 1 5 11.5Z" fill="currentColor" />
              )}
            </svg>
            <span>{expanded ? "Ocultar" : "Ver sorteo"}</span>
          </span>
        </span>
      ) : null}
    </button>
  );
}

function DrawTimeline({ draws }: { draws: readonly HomeDrawCardView[] }) {
  const activeIndex = draws.findIndex((draw) => draw.isNext);
  const progress = activeIndex < 0 ? 0 : (activeIndex / (draws.length - 1)) * 75;

  return (
    <div aria-hidden="true" className={styles.drawTimeline}>
      <span className={styles.timelineRail} />
      <span className={styles.timelineProgress} style={{ width: `${progress}%` }} />
      {draws.map((draw) => (
        <span className={styles.timelineStop} data-active={draw.isNext ? "true" : "false"} key={draw.id}>
          <span className={styles.timelineDot} />
          <span>{draw.timeLabel}</span>
        </span>
      ))}
    </div>
  );
}

function NextDrawsPanel() {
  const { catalog, gatewayMode, loading, unauthorized, refresh } = useProduct();
  const { now } = useDrawClock();
  const [expandedDraw, setExpandedDraw] = useState<
    (HomeDrawCardView & { openedAt: number }) | null
  >(null);
  useDrawScheduleRefresh({
    enabled: gatewayMode === "backoffice" && !unauthorized,
    now,
    draws: catalog?.draws,
    loading,
    refresh,
  });
  const draws = useMemo(
    () => selectHomeDrawCards(
      now ?? Number.NaN,
      gatewayMode === "preview" ? undefined : catalog?.draws ?? [],
    ),
    [catalog, gatewayMode, now],
  );
  const nextDraw = draws.find((draw) => draw.isNext);
  // Keep the opened occurrence fixed while the next card continues advancing.
  const expandedDate = expandedDraw?.targetAt
    ? drawDateKey(Date.parse(expandedDraw.targetAt))
    : null;
  const expandedDrawsAt = useMemo(() => {
    if (!expandedDraw) return null;
    if (gatewayMode === "preview") return expandedDraw.targetAt;
    const definition = getDrawPageDefinition(expandedDraw.slug);
    return catalog && definition && expandedDate
      ? selectDrawPageSchedule(catalog.draws, definition, expandedDate, expandedDraw.openedAt)?.drawsAt ?? null
      : null;
  }, [catalog, expandedDate, expandedDraw, gatewayMode]);

  return (
    <section
      aria-busy={now === null || (loading && !catalog && gatewayMode !== "preview")}
      aria-labelledby="home-draws-title"
      className={`${styles.panel} ${styles.drawsPanel}`}
      data-testid="home-draws-section"
    >
      <header className={styles.sectionHeader}>
        <h2 id="home-draws-title">
          {nextDraw?.isTomorrow
            ? "Próximos sorteos de mañana"
            : nextDraw && nextDraw.dateLabel !== "Hoy"
              ? "Próximos sorteos programados"
              : "Próximos sorteos del día"}
        </h2>
      </header>

      <div className={styles.drawGrid} data-testid="home-draw-grid">
        {draws.map((draw) => (
          <DrawCard
            disabled={now === null || (!draw.targetAt && expandedDraw?.id !== draw.id)}
            draw={draw}
            expanded={expandedDraw?.id === draw.id}
            key={draw.id}
            onToggle={() => {
              if (now === null) return;
              setExpandedDraw((current) => current?.id === draw.id
                ? null
                : { ...draw, openedAt: now });
            }}
          />
        ))}
      </div>
      <DrawTimeline draws={draws} />
      <div
        aria-labelledby={expandedDraw ? "home-draw-stream-title" : undefined}
        className={styles.inlineStream}
        data-draw-target-at={expandedDrawsAt ?? undefined}
        data-testid="home-draw-stream"
        hidden={expandedDraw === null}
        id="home-draw-stream"
        role="region"
      >
        {expandedDraw ? (
          <>
            <h3
              className={styles.inlineStreamTitle}
              data-testid="home-draw-stream-title"
              id="home-draw-stream-title"
            >
              {expandedDraw.label}
            </h3>
            <DrawStreamContent
              drawName={expandedDraw.label}
              drawsAt={expandedDrawsAt}
              isSimulated={gatewayMode === "preview"}
              key={`${expandedDraw.id}:${expandedDate ?? "unknown"}`}
              now={now}
              streamUrl={getConfiguredDrawStreamUrl(expandedDraw.id)}
            />
          </>
        ) : null}
      </div>
      {!nextDraw && now !== null && !loading ? (
        <p className={styles.scheduleUnavailable}>
          No hay un próximo sorteo programado disponible.
        </p>
      ) : null}
    </section>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-hidden="true" className={styles.resultsGrid}>
      {[0, 1, 2, 3, 4, 5].map((slot) => (
        <span className={styles.resultSkeleton} key={slot} />
      ))}
    </div>
  );
}

function ResultCard({ result, tabId }: { result: HomeResultPositionView; tabId: HomeResultTabId }) {
  const displayedValue = tabId === "redoblona" ? result.ending : result.value;

  return (
    <article
      className={styles.resultCard}
      data-position={result.position}
      data-pending={result.value === null ? "true" : "false"}
      data-testid="home-result-card"
    >
      <span className={styles.resultTopline}>
        <span className={styles.resultPosition}>POSICIÓN {result.position}</span>
      </span>
      {tabId === "invert" ? <span className={styles.resultSourceLabel}>Sorteado</span> : null}
      <strong className={styles.resultValue} data-testid="home-result-value">
        {displayedValue ?? "—"}
      </strong>
      {result.value === null ? (
        <span className={styles.resultPending}>Pendiente</span>
      ) : tabId === "redoblona" ? (
        <span className={styles.resultSource}>Del número <strong>{result.value}</strong></span>
      ) : tabId === "invert" ? (
        <div
          aria-label={`Órdenes de las cifras de ${result.value}`}
          className={styles.resultCombinations}
          data-testid="home-result-combinations"
        >
          {result.combinations.map((value) => <span key={value}>{value}</span>)}
        </div>
      ) : null}
    </article>
  );
}

function PublishedResultsPanel({
  results,
  loading,
  emptyMessage,
}: {
  results: HomeLatestDrawResults | null;
  loading: boolean;
  emptyMessage: string;
}) {
  const [selectedTab, setSelectedTab] = useState<HomeResultTabId>("head");
  const visibleResults = useMemo(
    () => results?.positions.filter((result) => selectedTab === "head"
      ? result.position === 1
      : selectedTab === "invert" || result.position >= 2) ?? [],
    [results, selectedTab],
  );
  const headNumber = results?.positions.find((result) => result.position === 1)?.value;

  function handleTabKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    tabIndex: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (tabIndex + 1) % HOME_RESULT_TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (tabIndex - 1 + HOME_RESULT_TABS.length) % HOME_RESULT_TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = HOME_RESULT_TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = HOME_RESULT_TABS[nextIndex];
    setSelectedTab(nextTab.id);
    document.getElementById(`home-results-tab-${nextTab.id}`)?.focus();
  }

  return (
    <section
      aria-busy={loading}
      aria-labelledby="home-results-title"
      className={`${styles.panel} ${styles.resultsPanel}`}
      data-testid="home-results-section"
    >
      <header className={styles.sectionHeader}>
        <h2 id="home-results-title">Últimos resultados publicados</h2>
        <Link className={styles.resultsLink} href="/resultados">
          Ver todos
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M5 12h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </Link>
      </header>

      <div className={styles.resultsToolbar}>
        {results && !loading ? (
          <div className={styles.latestDraw} data-testid="home-results-draw">
            <span className={styles.latestDrawLabel}>Último sorteo</span>
            <strong>{results.drawLabel}</strong>
            <time dateTime={results.occurredAt}>{results.dateLabel} · {results.timeLabel}</time>
          </div>
        ) : null}
      </div>
      <div aria-label="Modalidad de resultado" className={styles.resultTabs} role="tablist">
        {HOME_RESULT_TABS.map((tab, tabIndex) => (
          <button
            aria-controls="home-results-grid"
            aria-selected={selectedTab === tab.id}
            className={styles.resultTab}
            id={`home-results-tab-${tab.id}`}
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, tabIndex)}
            role="tab"
            tabIndex={selectedTab === tab.id ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        aria-labelledby={`home-results-tab-${selectedTab}`}
        className={styles.resultsContent}
        id="home-results-grid"
        role="tabpanel"
        tabIndex={0}
      >
        {loading ? <ResultsSkeleton /> : results ? (
          <>
            {selectedTab === "redoblona" ? (
              <p className={styles.resultExplanation}>
                <span>Cabeza <strong data-testid="home-redoblona-head">{headNumber ?? "—"}</strong></span>
                <span>+ terminaciones de las posiciones 2 a 14</span>
              </p>
            ) : selectedTab === "invert" ? (
              <p className={styles.resultExplanation}>
                Número sorteado y órdenes posibles de sus cifras, por posición.
              </p>
            ) : null}
            <div className={styles.resultsGrid} data-modality={selectedTab}>
              {visibleResults.map((result) => (
                <ResultCard key={result.position} result={result} tabId={selectedTab} />
              ))}
            </div>
          </>
        ) : (
          <div className={styles.emptyResults}>
            <p role="status">{emptyMessage}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function MegaLotoBanner() {
  return (
    <section
      aria-labelledby="home-megaloto-title"
      className={styles.megaBanner}
      data-testid="home-megaloto-banner"
    >
      <Image
        alt="Bolillas de Mega Loto"
        className={styles.megaVisual}
        fill
        sizes="100vw"
        src="/assets/quinie-home-final/megaloto/bolillas-visual-mockup.png"
        unoptimized
      />

      <div className={styles.megaBrand}>
        <Image
          alt="Logo oficial de Mega Loto"
          className={styles.megaLogo}
          height={164}
          sizes="(max-width: 767px) 106px, (max-width: 1279px) 124px, 146px"
          src={MEGA_LOTO_LOGO}
          unoptimized
          width={164}
        />
        <h2 className={styles.megaCopy} id="home-megaloto-title">
          Sorteo exclusivo con 6 números.
        </h2>
      </div>

      <a
        aria-label="Ir al sitio oficial de Mega Loto (abre en una pestaña nueva)"
        className={styles.megaCta}
        href={MEGA_LOTO_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span>IR A MEGA LOTO</span>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 12h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </a>
    </section>
  );
}

export function HomeSections() {
  const { catalog, results, loading, error } = useProduct();
  const publishedResults = useMemo(
    () => (catalog ? selectHomeLatestDrawResults(catalog, results) : null),
    [catalog, results],
  );
  const waitingForResults = loading && !catalog;
  const emptyResultsMessage = error && !catalog
    ? "Los resultados no están disponibles en este momento."
    : "Todavía no hay resultados publicados.";

  return (
    <div className={styles.sections}>
      <NextDrawsPanel />
      <PublishedResultsPanel
        emptyMessage={emptyResultsMessage}
        loading={waitingForResults}
        results={publishedResults}
      />
      <MegaLotoBanner />
    </div>
  );
}
