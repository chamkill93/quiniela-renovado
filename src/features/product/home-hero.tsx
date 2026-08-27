"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useProduct } from "@/providers/product-provider";

import { selectLatestHeroResult } from "./home-hero-data";
import { HeroVisual } from "./hero-visual";
import { createRandomHeroValue } from "./home-hero-random";
import styles from "./home-hero.module.css";

const PREVIEW_HERO_STORAGE_KEY = "quinie_home_hero_random";

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

export function HomeHero() {
  const { catalog, results, loading, gatewayMode } = useProduct();
  const isPromotionalReel = gatewayMode === "preview";
  const previewHeroValue = usePreviewHeroValue(isPromotionalReel);

  const latestResult = useMemo(
    () => (catalog ? selectLatestHeroResult(results, catalog) : null),
    [catalog, results],
  );
  const heroValue = isPromotionalReel
    ? previewHeroValue
    : latestResult?.value ?? null;
  const heroSpinKey = isPromotionalReel
    ? previewHeroValue
      ? `preview-${previewHeroValue}`
      : undefined
    : latestResult?.spinKey;

  return (
    <section
      aria-labelledby="home-hero-title"
      className={styles.hero}
      data-testid="home-hero"
    >
      <div className={styles.copy}>
        <p className={styles.eyebrow}>Quiniela online · Paraguay</p>
        <h1 className={styles.title} id="home-hero-title">
          <span>Tu jugada</span>{" "}
          <span>empieza acá<span className={styles.titleMark}>.</span></span>
        </h1>
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
      </div>
    </section>
  );
}
