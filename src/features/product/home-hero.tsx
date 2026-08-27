"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { useProduct } from "@/providers/product-provider";

import {
  getHeroCountdown,
  getHomeHeroDrawIcon,
  selectLatestHeroResult,
  selectNextHeroDraw,
} from "./home-hero-data";
import { HeroVisual } from "./hero-visual";
import { createRandomHeroValue } from "./home-hero-random";
import { SAPYAITE_PATH } from "./product-links";
import styles from "./home-hero.module.css";

type DrawIconStyle = CSSProperties & {
  "--hero-draw-icon-dark": string;
  "--hero-draw-icon-light": string;
};

const PREVIEW_HERO_STORAGE_KEY = "quinie_home_hero_random";

function useCurrentTime() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  return now;
}

function usePreviewHeroValue(enabled: boolean) {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const storeValue = (nextValue: string) => {
      try {
        window.sessionStorage.setItem(PREVIEW_HERO_STORAGE_KEY, nextValue);
      } catch {
        // The promotional reel still works when browser storage is unavailable.
      }
    };

    let previousValue: string | null = null;
    try {
      previousValue = window.sessionStorage.getItem(PREVIEW_HERO_STORAGE_KEY);
    } catch {
      previousValue = null;
    }

    const initialTimer = window.setTimeout(() => {
      const nextValue = createRandomHeroValue(Math.random, previousValue);
      setValue(nextValue);
      storeValue(nextValue);
    }, 0);

    return () => window.clearTimeout(initialTimer);
  }, [enabled]);

  return value;
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32">
      <circle cx="16" cy="16" fill="none" r="11" stroke="currentColor" strokeWidth="2.2" />
      <path d="M16 9v7l4.8 2.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
      <path d="M11 4h10" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

export function HomeHero() {
  const { catalog, results, loading, error, gatewayMode } = useProduct();
  const now = useCurrentTime();
  const isPromotionalReel = gatewayMode === "preview";
  const previewHeroValue = usePreviewHeroValue(isPromotionalReel);

  const latestResult = useMemo(
    () => (catalog ? selectLatestHeroResult(results, catalog) : null),
    [catalog, results],
  );
  const nextDraw = useMemo(
    () => (catalog && now !== null ? selectNextHeroDraw(catalog.draws, now) : null),
    [catalog, now],
  );
  const countdown = nextDraw && now !== null
    ? getHeroCountdown(nextDraw.closesAt, now)
    : null;
  const drawIcon = nextDraw ? getHomeHeroDrawIcon(nextDraw.id) : null;
  const drawIconStyle: DrawIconStyle | undefined = drawIcon
    ? ({
        "--hero-draw-icon-dark": `url("${drawIcon.dark}")`,
        "--hero-draw-icon-light": `url("${drawIcon.light}")`,
      })
    : undefined;
  const waitingForData = loading || now === null;
  const heroValue = isPromotionalReel
    ? previewHeroValue
    : latestResult?.value ?? null;
  const heroSpinKey = isPromotionalReel
    ? previewHeroValue
      ? `preview-${previewHeroValue}`
      : undefined
    : latestResult?.spinKey;

  let unavailableMessage = "Próximo sorteo no publicado";
  if (waitingForData) unavailableMessage = "Consultando próximo sorteo…";
  else if (error && !catalog) unavailableMessage = "Próximo sorteo no disponible";

  return (
    <section
      aria-labelledby="home-hero-title"
      className={styles.hero}
      data-testid="home-hero"
    >
      <div className={styles.copy}>
        <p className={styles.eyebrow}>Quiniela online · Paraguay</p>
        <h1 className={styles.title} id="home-hero-title">
          <span>Tus números.</span>
          <span>Tu momento<span className={styles.titleMark}>.</span></span>
        </h1>

        <span className={styles.nextDrawLabel}>Próximo sorteo</span>
        {nextDraw ? (
          <Link
            aria-label={`${nextDraw.name}, ${nextDraw.timeLabel}. Ir a Quiniela`}
            className={styles.nextDraw}
            href={nextDraw.href}
          >
            {drawIconStyle ? (
              <span aria-hidden="true" className={styles.drawIcon} style={drawIconStyle} />
            ) : (
              <span aria-hidden="true" className={styles.drawIconFallback}>
                <ClockIcon />
              </span>
            )}
            <strong className={styles.drawName}>{nextDraw.name}</strong>
            <span className={styles.drawTime}>{nextDraw.timeLabel}</span>
            <svg aria-hidden="true" className={styles.chevron} viewBox="0 0 24 24">
              <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </Link>
        ) : (
          <div className={styles.nextDrawUnavailable} role="status">
            <span aria-hidden="true" className={styles.drawIconFallback}>
              <ClockIcon />
            </span>
            <span>{unavailableMessage}</span>
          </div>
        )}

        {countdown?.state === "open" ? (
          <div
            aria-label={`Cierra en ${countdown.hours} horas, ${countdown.minutes} minutos y ${countdown.seconds} segundos`}
            className={styles.countdown}
            role="timer"
          >
            <span aria-hidden="true" className={styles.countdownLabel}>Cierra en:</span>
            {[
              [countdown.hours, "Horas"],
              [countdown.minutes, "Min"],
              [countdown.seconds, "Seg"],
            ].map(([value, label], index) => (
              <span aria-hidden="true" className={styles.timeGroup} key={label}>
                {index > 0 ? <i className={styles.countdownDivider}>:</i> : null}
                <span className={styles.timeUnit}>
                  <strong className={styles.timeValue}>{value}</strong>
                  <small className={styles.timeLabel}>{label}</small>
                </span>
              </span>
            ))}
          </div>
        ) : nextDraw ? (
          <div className={styles.drawState} role="status">
            {countdown?.state === "closed"
              ? "Venta cerrada · sorteo próximo"
              : "Horario de cierre no disponible"}
          </div>
        ) : (
          <div aria-hidden="true" className={styles.drawState}>Esperando programación</div>
        )}

      </div>

      <div className={styles.reelColumn}>
        <HeroVisual
          loading={isPromotionalReel ? previewHeroValue === null : loading && !latestResult}
          source={isPromotionalReel ? "promotional" : "published"}
          spinKey={heroSpinKey}
          value={heroValue}
        />
      </div>

      <div className={styles.actions}>
        <Link className={styles.primaryAction} href="/quinielas">
          Jugar Quiniela
          <svg aria-hidden="true" className={styles.actionIcon} viewBox="0 0 24 24">
            <path d="m8 5 11 7-11 7Z" fill="currentColor" />
          </svg>
        </Link>
        <Link className={styles.secondaryAction} href={SAPYAITE_PATH}>
          <svg aria-hidden="true" className={styles.actionIcon} viewBox="0 0 24 24">
            <path d="m13.4 2-8 11h6l-.8 9 8-12h-5.8Z" fill="currentColor" />
          </svg>
          Jugar Sapy’aite
        </Link>
      </div>
    </section>
  );
}
