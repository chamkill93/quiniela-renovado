"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui";
import type { MockPlay, MockTicket } from "@/lib/product/api-types";
import { formatGs } from "@/lib/product/catalog";
import { useSoundEffects } from "./use-sound-effects";
import styles from "./product.module.css";

function describeSelection(selection: unknown) {
  if (typeof selection === "string" || typeof selection === "number") return String(selection);
  if (Array.isArray(selection)) return selection.join(" · ");
  if (selection && typeof selection === "object") {
    const record = selection as Record<string, unknown>;
    if (Array.isArray(record.numbers)) return record.numbers.join(" · ");
    return Object.values(record).map(String).join(" · ");
  }
  return "Registrada";
}

function statusLabel(status: string) {
  return ({ PENDING: "Pendiente", WON: "Premiada", LOST: "Sin premio", REFUNDED: "Reintegrada" } as Record<string, string>)[status] ?? status;
}

export function TicketDialog({
  ticket,
  play,
  onClose,
}: {
  ticket: MockTicket;
  play: MockPlay;
  onClose: () => void;
}) {
  const playSound = useSoundEffects();

  useEffect(() => {
    playSound("ticket");
  }, [playSound]);

  return (
    <Modal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Jugada registrada"
      description="Comprobante digital de quinie.LA"
      size="sm"
      footer={<button className={styles.primaryButton} onClick={onClose} type="button">Listo</button>}
    >
      <div className={styles.ticketBody} data-testid="ticket-dialog">
        <Image src="/assets/brand/logo_quiniela_original.png" alt="quinie.LA" width={185} height={89} />
        <dl className={styles.summaryList}>
          <div className={styles.summaryRow}><dt>Juego</dt><dd>{play.gameName ?? play.gameId}</dd></div>
          <div className={styles.summaryRow}><dt>Selección</dt><dd>{describeSelection(play.selection ?? ticket.selection)}</dd></div>
          <div className={styles.summaryRow}><dt>Importe</dt><dd>{formatGs(play.amount)}</dd></div>
          {play.resultNumbers?.length ? (
            <div className={styles.summaryRow}><dt>Resultado</dt><dd>{play.resultNumbers.join(" · ")}</dd></div>
          ) : play.result ? (
            <div className={styles.summaryRow}><dt>Resultado</dt><dd>{play.result}</dd></div>
          ) : null}
          {typeof play.prize === "number" ? (
            <div className={styles.summaryRow}><dt>Premio</dt><dd>{formatGs(play.prize)}</dd></div>
          ) : null}
          <div className={styles.summaryRow}><dt>Estado</dt><dd>{statusLabel(play.status)}</dd></div>
        </dl>
        <div className={styles.ticketCode}>{ticket.code ?? ticket.id}</div>
      </div>
    </Modal>
  );
}
