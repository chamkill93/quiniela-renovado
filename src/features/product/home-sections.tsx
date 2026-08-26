"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
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

const MEGA_LOTO_URL = "https://lotoqr.megaloto.com.py/";

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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const draws = useMemo(
    () => selectHomeDrawCards(now ?? Number.NaN),
    [now],
  );
  const activeSlug = draws.find((draw) => draw.isNext)?.slug ?? null;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !activeSlug || !window.matchMedia("(max-width: 767px)").matches) {
      return;
    }
    const activeCard = scroller.querySelector<HTMLElement>(
      `[data-draw-slug="${activeSlug}"]`,
    );
    if (!activeCard) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cardLeft = activeCard.getBoundingClientRect().left
      - scroller.getBoundingClientRect().left
      + scroller.scrollLeft;
    scroller.scrollTo({
      left: Math.max(0, cardLeft - 12),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [activeSlug]);

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

      <div className={styles.drawScroller} ref={scrollerRef}>
        <div className={styles.drawGrid}>
          {draws.map((draw) => <DrawCard draw={draw} key={draw.id} />)}
        </div>
      </div>
      <DrawTimeline draws={draws} />
    </section>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-hidden="true" className={styles.resultsViewport}>
      <div className={styles.resultsTrack}>
        {[0, 1, 2, 3, 4, 5].map((slot) => (
          <span className={styles.resultSkeleton} key={slot} />
        ))}
      </div>
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

function ResultsCarousel({
  results,
  loading,
  emptyMessage,
}: {
  results: readonly HomePublishedResultView[];
  loading: boolean;
  emptyMessage: string;
}) {
  const [selectedTab, setSelectedTab] = useState<HomeResultTabId>("head");
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  const visibleResults = useMemo(
    () => results.filter((result) => result.tabId === selectedTab),
    [results, selectedTab],
  );

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    setCanScrollBack(viewport.scrollLeft > 2);
    setCanScrollForward(viewport.scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ left: 0, behavior: "auto" });
    const frame = window.requestAnimationFrame(updateScrollState);
    return () => window.cancelAnimationFrame(frame);
  }, [selectedTab, visibleResults.length, updateScrollState]);

  useEffect(() => {
    const handleResize = () => updateScrollState();
    const viewport = viewportRef.current;
    const resizeObserver = viewport && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(handleResize)
      : null;
    if (viewport) resizeObserver?.observe(viewport);
    window.addEventListener("resize", handleResize);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [loading, selectedTab, visibleResults.length, updateScrollState]);

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

  function scrollResults(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollBy({
      left: direction * Math.max(180, viewport.clientWidth * 0.82),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: viewport.scrollLeft,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active || event.pointerType !== "mouse") return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = dragRef.current.startScrollLeft - (event.clientX - dragRef.current.startX);
  }

  function stopDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    updateScrollState();
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
        <div aria-label="Modalidad de resultado" className={styles.resultTabs} role="tablist">
          {HOME_RESULT_TABS.map((tab, tabIndex) => (
            <button
              aria-controls="home-results-carousel"
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

        <div aria-label="Controles del carrusel" className={styles.carouselControls}>
          <button
            aria-label="Ver resultados anteriores"
            className={styles.carouselButton}
            disabled={!canScrollBack}
            onClick={() => scrollResults(-1)}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
          </button>
          <button
            aria-label="Ver más resultados"
            className={styles.carouselButton}
            disabled={!canScrollForward}
            onClick={() => scrollResults(1)}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
          </button>
        </div>
      </div>

      {loading ? (
        <ResultsSkeleton />
      ) : visibleResults.length > 0 ? (
        <div
          aria-labelledby={`home-results-tab-${selectedTab}`}
          className={styles.resultsViewport}
          data-dragging={dragging ? "true" : "false"}
          id="home-results-carousel"
          onPointerCancel={stopDragging}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onScroll={updateScrollState}
          ref={viewportRef}
          role="tabpanel"
          tabIndex={0}
        >
          <div className={styles.resultsTrack}>
            {visibleResults.map((result) => <ResultCard key={result.id} result={result} />)}
          </div>
        </div>
      ) : (
        <div
          aria-labelledby={`home-results-tab-${selectedTab}`}
          className={styles.emptyResults}
          id="home-results-carousel"
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
          src="/assets/quinie-home-final/megaloto/logo-mega-loto-circular-transparente.png"
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
      <ResultsCarousel
        emptyMessage={emptyResultsMessage}
        loading={waitingForResults}
        results={publishedResults}
      />
      <MegaLotoBanner />
    </div>
  );
}
