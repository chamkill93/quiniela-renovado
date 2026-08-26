"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { useProduct } from "@/providers/product-provider";

import {
  selectHomeDrawCards,
  selectHomePublishedResults,
  type HomeDrawCardView,
} from "./home-sections-data";
import styles from "./home-sections.module.css";

const MEGA_LOTO_URL = "https://lotoqr.megaloto.com.py/";
const MEGA_LOTO_BALLS = ["6", "12", "33", "44", "9"] as const;

type DrawIconStyle = CSSProperties & {
  "--home-draw-icon-dark": string;
  "--home-draw-icon-light": string;
};

function useCurrentTime() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return now;
}

function drawIconStyle(draw: HomeDrawCardView): DrawIconStyle {
  return {
    "--home-draw-icon-dark": `url("${draw.iconDark}")`,
    "--home-draw-icon-light": `url("${draw.iconLight}")`,
  };
}

function DrawsSection({
  draws,
  loading,
}: {
  draws: readonly HomeDrawCardView[];
  loading: boolean;
}) {
  return (
    <section
      aria-busy={loading}
      aria-labelledby="home-draws-title"
      className={styles.panel}
      data-testid="home-draws-section"
    >
      <header className={styles.sectionHeader}>
        <h2 id="home-draws-title">Próximos sorteos del día</h2>
      </header>

      <div className={styles.drawGrid}>
        {draws.map((draw) => (
          <Link
            aria-label={`${draw.label}, ${draw.timeLabel}, ${draw.statusLabel}`}
            className={styles.drawCard}
            data-active={draw.isNext ? "true" : "false"}
            data-draw-id={draw.id}
            data-draw-slug={draw.slug}
            data-state={draw.state}
            data-testid="home-draw-card"
            href={draw.href}
            key={draw.id}
            prefetch={false}
          >
            <span
              aria-hidden="true"
              className={styles.drawIcon}
              style={drawIconStyle(draw)}
            />
            <span className={styles.drawLabel}>{draw.label}</span>
            <strong className={styles.drawTime}>{draw.timeLabel}</strong>
            <span className={styles.drawStatus}>{draw.statusLabel}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-hidden="true" className={styles.resultGrid}>
      {[0, 1, 2, 3].map((slot) => (
        <span className={styles.resultSkeleton} key={slot} />
      ))}
    </div>
  );
}

function MegaLotoBanner() {
  return (
    <a
      aria-label="Ir al sitio oficial de Mega Loto (abre en una pestaña nueva)"
      className={styles.megaBanner}
      data-testid="home-megaloto-banner"
      href={MEGA_LOTO_URL}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className={styles.megaBrand}>
        <Image
          alt="Mega Loto"
          className={styles.megaLogo}
          height={164}
          sizes="(max-width: 600px) 78px, 112px"
          src="/assets/quinie-home-v3/megaloto/mega-loto-logo-oficial.png"
          width={180}
        />
        <span className={styles.megaCopy}>
          <strong>Sorteos exclusivos con 6 números del 1 al 45.</strong>
          <span>Un producto de Lotería Mega Loto.</span>
        </span>
      </span>

      <span aria-hidden="true" className={styles.megaBalls}>
        {MEGA_LOTO_BALLS.map((number, index) => (
          <span
            className={styles.megaBall}
            data-position={index + 1}
            key={`${number}-${index}`}
          >
            {number}
          </span>
        ))}
      </span>

      <span className={styles.megaCta}>
        IR A MEGA LOTO
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 12h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </span>
    </a>
  );
}

export function HomeSections() {
  const { catalog, results, loading, error } = useProduct();
  const now = useCurrentTime();
  const drawCards = useMemo(
    () => selectHomeDrawCards(catalog?.draws ?? [], now ?? Number.NaN),
    [catalog, now],
  );
  const publishedResults = useMemo(
    () => (catalog ? selectHomePublishedResults(catalog, results) : []),
    [catalog, results],
  );
  const waitingForResults = loading && !catalog;
  const emptyResultsMessage = error && !catalog
    ? "Los resultados no están disponibles en este momento."
    : "Todavía no hay resultados de Quiniela publicados.";

  return (
    <div className={styles.sections}>
      <DrawsSection draws={drawCards} loading={loading || now === null} />

      <section
        aria-busy={waitingForResults}
        aria-labelledby="home-results-title"
        className={styles.panel}
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

        {waitingForResults ? (
          <ResultsSkeleton />
        ) : publishedResults.length > 0 ? (
          <div className={styles.resultGrid}>
            {publishedResults.map((result) => (
              <article
                className={styles.resultCard}
                data-testid="home-result-card"
                key={result.id}
              >
                <span className={styles.resultModality}>{result.modality}</span>
                <strong className={styles.resultValue}>{result.value}</strong>
                <span className={styles.resultMeta}>
                  <time dateTime={result.occurredAt}>{result.dateLabel}</time>
                  <span>{result.drawLabel}</span>
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.emptyResults} role="status">{emptyResultsMessage}</p>
        )}
      </section>

      <MegaLotoBanner />
    </div>
  );
}
