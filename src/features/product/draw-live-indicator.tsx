"use client";

import { useState } from "react";

import { Modal } from "@/components/ui";
import { DAILY_DRAW_SLOTS, selectLiveDraw } from "@/lib/gaming/daily-draw-schedule";
import { useProduct } from "@/providers/product-provider";
import { getConfiguredDrawStreamUrl } from "./draw-page-data";
import { DrawStreamContent } from "./draw-stream-content";
import { useDrawClock } from "./use-draw-clock";
import styles from "./draw-live-indicator.module.css";

export function DrawLiveIndicator() {
  const [open, setOpen] = useState(false);
  const { catalog, gatewayMode } = useProduct();
  const { now } = useDrawClock();
  const liveDraw = selectLiveDraw(
    now ?? Number.NaN,
    gatewayMode === "preview" ? undefined : catalog?.draws ?? [],
  );
  const liveSlot = DAILY_DRAW_SLOTS.find((slot) => slot.id === liveDraw?.id);
  const drawLabel = liveSlot?.label;
  const accessibleState = liveDraw
    ? `Sorteo en horario LIVE: ${drawLabel}`
    : "Fuera del horario LIVE";

  return (
    <>
      <button
        aria-controls="draw-live-popout"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={liveDraw
          ? `Abrir transmisión LIVE de ${drawLabel}`
          : "Abrir canal LIVE de Quiniela"}
        className={styles.indicator}
        data-active={liveDraw ? "true" : "false"}
        data-draw-id={liveDraw?.id}
        data-testid="draw-live-indicator"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span aria-hidden="true" className={styles.dot} />
        <span aria-hidden="true">LIVE</span>
      </button>
      <span aria-atomic="true" aria-live="polite" className="q-sr-only" role="status">
        {accessibleState}
      </span>
      <Modal
        className={styles.liveDialog}
        closeLabel="Cerrar transmisión LIVE"
        description={liveDraw
          ? `Transmisión del sorteo ${drawLabel}.`
          : "Programación publicitaria hasta la próxima transmisión."}
        onOpenChange={setOpen}
        open={open}
        size="lg"
        title="LIVE de Quiniela"
      >
        <div
          className={styles.popout}
          data-mode={liveDraw ? "live" : "advertising"}
          data-testid="draw-live-popout"
          id="draw-live-popout"
        >
          <p className={styles.popoutState} data-active={liveDraw ? "true" : "false"}>
            <span aria-hidden="true" className={styles.dot} />
            {liveDraw ? `EN VIVO · ${drawLabel}` : "PROGRAMACIÓN PUBLICITARIA"}
          </p>
          <DrawStreamContent
            drawName={drawLabel ?? "Quiniela"}
            drawsAt={liveDraw?.drawsAt ?? null}
            isSimulated={gatewayMode === "preview"}
            key={liveDraw?.id ?? "advertising"}
            now={now}
            streamUrl={liveSlot ? getConfiguredDrawStreamUrl(liveSlot.id) : null}
          />
        </div>
      </Modal>
    </>
  );
}
