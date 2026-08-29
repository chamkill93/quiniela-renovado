"use client";

import { DAILY_DRAW_SLOTS, selectLiveDraw } from "@/lib/gaming/daily-draw-schedule";
import { useProduct } from "@/providers/product-provider";
import { useDrawClock } from "./use-draw-clock";
import styles from "./draw-live-indicator.module.css";

export function DrawLiveIndicator() {
  const { catalog, gatewayMode } = useProduct();
  const { now } = useDrawClock();
  const liveDraw = selectLiveDraw(
    now ?? Number.NaN,
    gatewayMode === "preview" ? undefined : catalog?.draws ?? [],
  );
  const drawLabel = DAILY_DRAW_SLOTS.find((slot) => slot.id === liveDraw?.id)?.label;

  return (
    <span
      aria-atomic="true"
      aria-label="Estado LIVE del sorteo"
      className={styles.indicator}
      data-active={liveDraw ? "true" : "false"}
      data-draw-id={liveDraw?.id}
      data-testid="draw-live-indicator"
      role="status"
    >
      <span aria-hidden="true" className={styles.dot} />
      <span aria-hidden="true">LIVE</span>
      <span className="q-sr-only">
        {liveDraw ? `Sorteo en horario LIVE: ${drawLabel}` : "Fuera del horario LIVE"}
      </span>
    </span>
  );
}
