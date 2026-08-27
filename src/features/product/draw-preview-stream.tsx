"use client";

import { useState } from "react";

import styles from "./draw-page.module.css";

export const PREVIEW_DRAW_VIDEO = "/assets/video/quinie-streaming-simulado.mp4";

export function DrawPreviewStream({ drawName }: { drawName: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={styles.streamFrame} data-testid="draw-stream-frame">
      {failed ? (
        <div className={styles.videoError} role="alert">
          <strong>No pudimos reproducir el video.</strong>
          <button onClick={() => setFailed(false)} type="button">
            Reintentar video
          </button>
        </div>
      ) : (
        <video
          aria-label={`Streaming de ${drawName}`}
          autoPlay
          controls
          data-testid="draw-preview-video"
          loop
          muted
          onError={() => setFailed(true)}
          playsInline
          preload="auto"
          src={PREVIEW_DRAW_VIDEO}
        >
          Tu navegador no admite la reproducción de este video.
        </video>
      )}
    </div>
  );
}
