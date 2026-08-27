"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { useProduct } from "@/providers/product-provider";

import { DrawIcon } from "./draw-icon";
import {
  HOME_RESULT_TABS,
  selectHomeDrawCards,
  selectHomePublishedResults,
  type HomeDrawCardView,
  type HomePublishedResultView,
  type HomeResultTabId,
} from "./home-sections-data";
import styles from "./home-sections.module.css";

import { MEGA_LOTO_LOGO, MEGA_LOTO_URL } from "./product-links";

function useDrawClock() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  return now;
}

function DrawCard({ draw }: { draw: HomeDrawCardView }) {
  const tomorrowLabel = draw.isTomorrow ? ", del día siguiente" : "";
  const nextLabel = draw.isNext ? ", próximo sorteo" : "";
  const countdownLabel = draw.statusLabel ? `, ${draw.statusLabel}` : "";

  return (
    <Link
      aria-label={`${draw.label}, ${draw.timeLabel}${tomorrowLabel}${nextLabel}${countdownLabel}`}
      className={styles.drawCard}
      data-active={draw.isNext ? "true" : "false"}
      data-draw-id={draw.id}
      data-draw-slug={draw.slug}
      data-testid="home-draw-card"
      href={draw.href}
      prefetch={false}
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
      </span>
      {draw.isNext && draw.statusLabel ? (
        <time className={styles.drawStatus} dateTime={draw.targetAt ?? undefined}>
          {draw.statusLabel}
        </time>
      ) : null}
    </Link>
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
  const now = useDrawClock();
  const draws = useMemo(
    () => selectHomeDrawCards(now ?? Number.NaN),
    [now],
  );

  return (
    <section
      aria-busy={now === null}
      aria-labelledby="home-draws-title"
      className={`${styles.panel} ${styles.drawsPanel}`}
      data-testid="home-draws-section"
    >
      <header className={styles.sectionHeader}>
        <h2 id="home-draws-title">Próximos sorteos del día</h2>
      </header>

      <div className={styles.drawGrid} data-testid="home-draw-grid">
        {draws.map((draw) => <DrawCard draw={draw} key={draw.id} />)}
      </div>
      <DrawTimeline draws={draws} />
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

function ResultCard({ result }: { result: HomePublishedResultView }) {
  return (
    <article
      className={styles.resultCard}
      data-position={result.position}
      data-testid="home-result-card"
    >
      <span className={styles.resultTopline}>
        <span className={styles.resultModality}>{result.productLabel}</span>
        {result.position === null ? null : (
          <span className={styles.resultPosition}>POSICIÓN {result.position}</span>
        )}
      </span>
      <strong className={styles.resultValue}>{result.value}</strong>
      <span className={styles.resultMeta}>
        <span>{result.dateLabel} · <time dateTime={result.occurredAt}>{result.timeLabel}</time></span>
        <strong>{result.drawLabel}</strong>
      </span>
    </article>
  );
}

function PublishedResultsPanel({
  results,
  loading,
  emptyMessage,
  preview,
}: {
  results: readonly HomePublishedResultView[];
  loading: boolean;
  emptyMessage: string;
  preview: boolean;
}) {
  const [selectedTab, setSelectedTab] = useState<HomeResultTabId>("head");
  const visibleResults = useMemo(
    () => results.filter((result) => result.tabId === selectedTab).slice(0, 6),
    [results, selectedTab],
  );

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
        {preview ? <span className={styles.previewLabel}>Resultados de muestra</span> : null}
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
      </div>

      {loading ? (
        <ResultsSkeleton />
      ) : visibleResults.length > 0 ? (
        <div
          aria-labelledby={`home-results-tab-${selectedTab}`}
          className={styles.resultsGrid}
          id="home-results-grid"
          role="tabpanel"
          tabIndex={0}
        >
          {visibleResults.map((result) => <ResultCard key={result.id} result={result} />)}
        </div>
      ) : (
        <div
          aria-labelledby={`home-results-tab-${selectedTab}`}
          className={styles.emptyResults}
          id="home-results-grid"
          role="tabpanel"
        >
          <p role="status">{emptyMessage}</p>
        </div>
      )}
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
  const { catalog, results, loading, error, gatewayMode } = useProduct();
  const publishedResults = useMemo(
    () => (catalog ? selectHomePublishedResults(catalog, results) : []),
    [catalog, results],
  );
  const waitingForResults = loading && !catalog;
  const emptyResultsMessage = error && !catalog
    ? "Los resultados no están disponibles en este momento."
    : "Todavía no hay resultados publicados para esta modalidad.";

  return (
    <div className={styles.sections}>
      <NextDrawsPanel />
      <PublishedResultsPanel
        emptyMessage={emptyResultsMessage}
        loading={waitingForResults}
        preview={gatewayMode === "preview"}
        results={publishedResults}
      />
      <MegaLotoBanner />
    </div>
  );
}
