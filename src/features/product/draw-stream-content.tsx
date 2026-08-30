"use client";

import { isDrawOccurrenceLive } from "@/lib/gaming/daily-draw-schedule";

import { getDrawPageCountdown } from "./draw-page-data";
import styles from "./draw-page.module.css";
import { DrawPreviewStream } from "./draw-preview-stream";

export const DRAW_ADVERTISING_VIDEO_IDS = [
  "Z3eXyAIz65I",
  "JV9ajM_6Rsc",
] as const;

export const DRAW_ADVERTISING_EMBED_URL =
  `https://www.youtube-nocookie.com/embed/${DRAW_ADVERTISING_VIDEO_IDS[0]}`
  + `?autoplay=1&mute=1&playsinline=1&controls=1&rel=0&loop=1&playlist=${DRAW_ADVERTISING_VIDEO_IDS.join(",")}`;

interface DrawStreamContentProps {
  drawName: string;
  drawsAt: string | null;
  isSimulated: boolean;
  now: number | null;
  streamUrl: string | null;
}

export function DrawStreamContent({
  drawName,
  drawsAt,
  isSimulated,
  now,
  streamUrl,
}: DrawStreamContentProps) {
  const countdown = drawsAt && now !== null
    ? getDrawPageCountdown(drawsAt, now)
    : null;
  const isLive = now !== null && isDrawOccurrenceLive(now, drawsAt);

  return (
    <>
      {!isLive ? (
        <div
          className={styles.streamFrame}
          data-stream-mode="advertising"
          data-testid="draw-stream-frame"
        >
          <iframe
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            data-testid="draw-advertising-player"
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            src={DRAW_ADVERTISING_EMBED_URL}
            title="Publicidad de Quiniela"
          />
        </div>
      ) : isSimulated ? (
        <DrawPreviewStream drawName={drawName} />
      ) : streamUrl ? (
        <div className={styles.streamFrame} data-stream-mode="live" data-testid="draw-stream-frame">
          <iframe
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            src={streamUrl}
            title={`Streaming de ${drawName}`}
          />
        </div>
      ) : (
        <div
          className={`${styles.streamFrame} ${styles.streamPlaceholder}`}
          data-stream-mode="live"
          data-testid="draw-stream-placeholder"
          role="status"
        >
          Transmisión no disponible
        </div>
      )}

      {countdown?.state === "upcoming" ? (
        <div
          aria-label={`Faltan ${countdown.hours} horas, ${countdown.minutes} minutos y ${countdown.seconds} segundos`}
          className={styles.countdown}
          data-testid="draw-countdown"
          role="timer"
        >
          <span aria-hidden="true">
            {countdown.hours}:{countdown.minutes}:{countdown.seconds}
          </span>
        </div>
      ) : null}
    </>
  );
}
