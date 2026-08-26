"use client";

import Image from "next/image";
import { memo, useEffect, useMemo, useRef, type CSSProperties } from "react";

import styles from "./hero-visual.module.css";

const REEL_CYCLES = 4;
const REEL_DIGITS = Array.from(
  { length: (REEL_CYCLES + 1) * 10 },
  (_, index) => index % 10,
);
const REEL_DURATIONS = [1_700, 2_100, 2_500] as const;
const HERO_REEL_ARTWORK = "/assets/hero/rodillo-fuego/rodillo-fuego-1600.webp";

type ReelStripStyle = CSSProperties & {
  "--hero-reel-row-count": number;
};

function normalizeResult(value: string | null) {
  if (value === null) return null;

  const candidate = value.trim();
  if (!/^\d{1,3}$/.test(candidate)) return null;

  const numericValue = Number(candidate);
  if (numericValue < 1 || numericValue > 999) return null;

  return candidate.padStart(3, "0");
}

function HeroVisualComponent({
  value,
  spinKey,
  loading = false,
  source = "published",
}: {
  value: string | null;
  spinKey?: string;
  loading?: boolean;
  source?: "promotional" | "published";
}) {
  const safeValue = useMemo(() => normalizeResult(value), [value]);
  const stripRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const strips = stripRefs.current;

    strips.forEach((strip) => {
      strip?.getAnimations?.().forEach((animation) => animation.cancel());
      if (strip) {
        strip.style.willChange = "auto";
      }
    });

    if (!safeValue) {
      strips.forEach((strip) => {
        if (strip) strip.style.transform = "translate3d(0, 0, 0)";
      });
      return undefined;
    }

    let disposed = false;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const settled = [false, false, false];
    const rows: HTMLElement[] = [];
    const animations: Animation[] = [];

    function finalOffset(strip: HTMLDivElement, columnIndex: number) {
      const row = strip.querySelector<HTMLElement>("[data-reel-row]");
      if (!row) return null;

      const rowHeight = row.getBoundingClientRect().height;
      if (!Number.isFinite(rowHeight) || rowHeight <= 0) return null;

      const targetDigit = Number(safeValue?.[columnIndex]);
      const stopIndex = REEL_CYCLES * 10 + targetDigit;
      return -(stopIndex * rowHeight);
    }

    strips.forEach((strip, columnIndex) => {
      if (!strip) return;

      const row = strip.querySelector<HTMLElement>("[data-reel-row]");
      if (row) rows.push(row);

      const finalY = finalOffset(strip, columnIndex);
      if (finalY === null) return;

      const finalTransform = `translate3d(0, ${finalY}px, 0)`;
      strip.style.transform = finalTransform;

      if (reduceMotion || typeof strip.animate !== "function") {
        settled[columnIndex] = true;
        return;
      }

      strip.style.willChange = "transform";
      const animation = strip.animate(
        [
          { transform: "translate3d(0, 0, 0)", offset: 0 },
          { transform: `translate3d(0, ${finalY * 0.45}px, 0)`, offset: 0.38 },
          { transform: `translate3d(0, ${finalY * 0.78}px, 0)`, offset: 0.68 },
          { transform: `translate3d(0, ${finalY * 0.95}px, 0)`, offset: 0.88 },
          { transform: finalTransform, offset: 1 },
        ],
        {
          duration: REEL_DURATIONS[columnIndex],
          delay: 0,
          easing: "cubic-bezier(.12,.74,.12,1)",
          fill: "forwards",
        },
      );

      animations.push(animation);
      void animation.finished
        .then(() => {
          if (disposed) return;
          const settledY = finalOffset(strip, columnIndex) ?? finalY;
          strip.style.transform = `translate3d(0, ${settledY}px, 0)`;
          strip.style.willChange = "auto";
          settled[columnIndex] = true;
          animation.cancel();
        })
        .catch(() => undefined);
    });

    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          strips.forEach((strip, columnIndex) => {
            if (!strip || !settled[columnIndex]) return;
            const finalY = finalOffset(strip, columnIndex);
            if (finalY !== null) {
              strip.style.transform = `translate3d(0, ${finalY}px, 0)`;
            }
          });
        });

    rows.forEach((row) => observer?.observe(row));

    return () => {
      disposed = true;
      observer?.disconnect();
      animations.forEach((animation) => animation.cancel());
      strips.forEach((strip) => {
        if (strip) {
          strip.style.willChange = "auto";
        }
      });
    };
  }, [safeValue, spinKey]);

  const accessibleLabel = source === "promotional"
    ? safeValue
      ? `Combinación aleatoria ${safeValue}`
      : loading
        ? "Preparando combinación aleatoria"
        : "Combinación aleatoria no disponible"
    : safeValue
      ? `Último resultado publicado ${safeValue}`
      : loading
        ? "Cargando último resultado publicado"
        : "Último resultado todavía no disponible";

  return (
    <div
      aria-busy={loading || undefined}
      aria-label={accessibleLabel}
      className={styles.visual}
      data-loading={loading ? "true" : "false"}
      data-reel-result={safeValue ?? ""}
      data-reel-source={source}
      role="img"
    >
      <div aria-hidden="true" className={styles.fire} data-testid="home-hero-fire" />

      <div aria-hidden="true" className={styles.reelHero}>
        <Image
          alt=""
          className={styles.artwork}
          fill
          priority
          sizes="(max-width: 1180px) calc(100vw - 40px), min(50vw, 760px)"
          src={HERO_REEL_ARTWORK}
          unoptimized
        />

        <div className={styles.shell}>
          {[0, 1, 2].map((columnIndex) => (
            <div
              className={styles.window}
              data-reel-column={columnIndex}
              key={columnIndex}
            >
              <div
                className={styles.strip}
                data-reel-strip={columnIndex}
                ref={(node) => {
                  stripRefs.current[columnIndex] = node;
                }}
                style={{
                  "--hero-reel-row-count": REEL_DIGITS.length,
                  ...(safeValue
                    ? {
                        transform: `translate3d(0, -${((REEL_CYCLES * 10 + Number(safeValue[columnIndex])) / REEL_DIGITS.length) * 100}%, 0)`,
                      }
                    : {}),
                } as ReelStripStyle}
              >
                {REEL_DIGITS.map((digit, rowIndex) => (
                  <span
                    className={styles.row}
                    data-reel-row=""
                    key={`${columnIndex}-${rowIndex}`}
                  >
                    {digit}
                  </span>
                ))}
              </div>

              {!safeValue ? <span className={styles.placeholder}>—</span> : null}
              <span className={styles.glass} />
            </div>
          ))}
        </div>
      </div>

      <span className={styles.srOnly}>{accessibleLabel}</span>
    </div>
  );
}

export const HeroVisual = memo(HeroVisualComponent);
