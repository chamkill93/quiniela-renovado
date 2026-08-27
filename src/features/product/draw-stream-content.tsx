"use client";

import { getDrawPageCountdown } from "./draw-page-data";
import styles from "./draw-page.module.css";
import { DrawPreviewStream } from "./draw-preview-stream";

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

  return (
    <>
      {isSimulated ? (
        <DrawPreviewStream drawName={drawName} />
      ) : streamUrl ? (
        <div className={styles.streamFrame} data-testid="draw-stream-frame">
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
