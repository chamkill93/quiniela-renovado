"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
  const allStopped = normalized.length > 0 && stopped === normalized.length;
  const reelColumns = normalized.length === 1 ? 1 : Math.min(normalized.length, 5);

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
    <div
      aria-busy={!allStopped}
      aria-label="Rodillos numéricos"
      className={styles.reelStage}
      data-state={allStopped ? "result" : "spinning"}
    >
      <span aria-hidden="true" className={styles.reelStateLabel}>
        {allStopped ? "Rodillo resultado" : "Rodillo animado · girando"}
      </span>
      <span aria-live="polite" className={styles.reelAnnouncement} role="status">
        {allStopped
          ? `Resultado: ${normalized.join(", ")}`
          : `${normalized.length === 1 ? "Rodillo girando" : `${normalized.length} rodillos girando`}`}
      </span>
      <div
        className={styles.reels}
        data-count={normalized.length}
        data-layout={normalized.length === 1 ? "single" : "multiple"}
        style={{ "--reel-columns": reelColumns } as CSSProperties}
      >
        {normalized.map((result, index) => {
          const isStopped = index < stopped;
          const filler = padNumber(((index + 1) * 137 + tick * 47) % 999 || 999);
          const displayedNumber = isStopped ? result : filler;
          const parityMatches = selectedParity
            ? (Number(result) % 2 === 0 ? "PAR" : "IMPAR") === selectedParity
            : false;
          const matches = isStopped && (selectedNumbers.includes(result) || parityMatches);
          return (
            <div
              aria-label={isStopped ? `Rodillo ${index + 1}: ${result}` : `Rodillo ${index + 1}: girando`}
              className={styles.reel}
              data-match={matches}
              data-spinning={!isStopped}
              key={`${index}-${result}`}
              role="group"
            >
              <span aria-hidden="true" className={styles.reelDigits}>
                {displayedNumber.split("").map((digit, digitIndex) => {
                  const value = Number(digit);
                  const visibleDigits = [(value + 9) % 10, value, (value + 1) % 10];

                  return (
                    <span className={styles.reelDigit} key={`${index}-${digitIndex}`}>
                      {isStopped ? (
                        <span className={styles.reelValue}>{digit}</span>
                      ) : (
                        <span className={styles.reelDigitTrack}>
                          {visibleDigits.map((visibleDigit, visibleIndex) => (
                            <span key={`${visibleDigit}-${visibleIndex}`}>{visibleDigit}</span>
                          ))}
                        </span>
                      )}
                    </span>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
      {allStopped ? (
        <span aria-hidden="true" className={styles.reelConfetti}>
          {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
        </span>
      ) : null}
    </div>
  );
}
