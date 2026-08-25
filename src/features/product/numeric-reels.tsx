"use client";

import { useEffect, useMemo, useState } from "react";
import { padNumber } from "@/lib/product/catalog";
import { useSoundEffects } from "./use-sound-effects";
import styles from "./product.module.css";

export function NumericReels({
  results,
  selectedNumbers = [],
  selectedParity,
  onComplete,
}: {
  results: string[];
  selectedNumbers?: string[];
  selectedParity?: "PAR" | "IMPAR";
  onComplete?: () => void;
}) {
  const [stopped, setStopped] = useState(0);
  const [tick, setTick] = useState(0);
  const playSound = useSoundEffects();
  const normalized = useMemo(() => results.map((number) => padNumber(number)), [results]);

  useEffect(() => {
    if (normalized.length === 0) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    playSound("reelStart");
    const ticker = reduced
      ? undefined
      : window.setInterval(() => {
          setTick((value) => value + 1);
          playSound("reelTick");
        }, 170);
    const timers = normalized.map((_, index) =>
      window.setTimeout(
        () => {
          setStopped(index + 1);
          playSound("reelStop");
          if (index === normalized.length - 1) {
            if (ticker) window.clearInterval(ticker);
            onComplete?.();
          }
        },
        reduced ? 90 + index * 45 : 780 + index * 260,
      ),
    );
    return () => {
      if (ticker) window.clearInterval(ticker);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [normalized, onComplete, playSound]);

  return (
    <div className={styles.reelStage} aria-label="Rodillos numéricos" aria-live="polite">
      <div
        className={styles.reels}
        style={{ "--reel-count": Math.min(normalized.length, 5) } as React.CSSProperties}
      >
        {normalized.map((result, index) => {
          const isStopped = index < stopped;
          const filler = padNumber(((index + 1) * 137 + tick * 47) % 999 || 999);
          const parityMatches = selectedParity
            ? (Number(result) % 2 === 0 ? "PAR" : "IMPAR") === selectedParity
            : false;
          const matches = isStopped && (selectedNumbers.includes(result) || parityMatches);
          return (
            <div
              className={styles.reel}
              data-match={matches}
              data-spinning={!isStopped}
              key={`${index}-${result}`}
            >
              <span className={styles.reelValue}>{isStopped ? result : filler}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
