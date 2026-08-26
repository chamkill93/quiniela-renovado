"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { padNumber } from "@/lib/product/catalog";
import { useSoundEffects } from "./use-sound-effects";
import styles from "./product.module.css";

export type ReelVariant = "classic" | "light" | "neon" | "gold";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function NumericReels({
  results,
  selectedNumbers = [],
  selectedParity,
  variant = "classic",
  continuous = false,
  onComplete,
}: {
  results: readonly string[];
  selectedNumbers?: readonly string[];
  selectedParity?: "PAR" | "IMPAR";
  variant?: ReelVariant;
  continuous?: boolean;
  onComplete?: () => void;
}) {
  const [stopped, setStopped] = useState(0);
  const [tick, setTick] = useState(0);
  const playSound = useSoundEffects();
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    readReducedMotion,
    () => false,
  );
  const normalized = useMemo(() => results.map((number) => padNumber(number)), [results]);
  const allStopped = !continuous && normalized.length > 0 && stopped === normalized.length;
  const reelColumns = normalized.length === 1 ? 1 : Math.min(normalized.length, 5);

  useEffect(() => {
    if (normalized.length === 0) return;

    if (continuous) {
      if (reducedMotion) {
        playSound("reelTick", "stop");
        return;
      }

      playSound("reelStart");
      let motionTicks = 0;
      const ticker = window.setInterval(() => {
        motionTicks += 1;
        setTick((value) => value + 1);
        // The preview keeps moving, but only plays a short, subtle mechanical
        // introduction instead of an endless audio loop.
        if (motionTicks <= 12 && motionTicks % 3 === 0) {
          playSound("reelTick");
        }
      }, 170);
      return () => {
        window.clearInterval(ticker);
        playSound("reelTick", "stop");
      };
    }

    if (!reducedMotion) playSound("reelStart");
    let motionTicks = 0;
    const ticker = reducedMotion
      ? undefined
      : window.setInterval(() => {
          motionTicks += 1;
          setTick((value) => value + 1);
          if (motionTicks % 2 === 0) playSound("reelTick");
        }, 170);
    const timers = normalized.map((_, index) =>
      window.setTimeout(
        () => {
          setStopped(index + 1);
          if (!reducedMotion) playSound("reelStop");
          if (index === normalized.length - 1) {
            if (ticker) window.clearInterval(ticker);
            onComplete?.();
          }
        },
        reducedMotion ? 90 + index * 45 : 780 + index * 260,
      ),
    );
    return () => {
      if (ticker) window.clearInterval(ticker);
      timers.forEach((timer) => window.clearTimeout(timer));
      playSound("reelTick", "stop");
    };
  }, [continuous, normalized, onComplete, playSound, reducedMotion]);

  const reelStateLabel = continuous
    ? "Rodillo activo · girando"
    : allStopped
      ? "Rodillo resultado"
      : "Resultado · girando";
  const visualState = continuous ? "preview" : allStopped ? "result" : "spinning";

  return (
    <div
      aria-busy={continuous ? false : !allStopped}
      aria-label="Rodillos numéricos"
      className={styles.reelStage}
      data-state={visualState}
      data-variant={variant}
      data-continuous={continuous}
    >
      <span aria-hidden="true" className={styles.reelStateLabel}>
        {reelStateLabel}
      </span>
      <span aria-live={continuous ? "off" : "polite"} className={styles.reelAnnouncement} role="status">
        {continuous
          ? "Rodillo activo; jugá para obtener resultado"
          : allStopped
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
          const isStopped = !continuous && index < stopped;
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
      {allStopped && !continuous ? (
        <span aria-hidden="true" className={styles.reelConfetti}>
          {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
        </span>
      ) : null}
    </div>
  );
}
