"use client";

import { useEffect } from "react";
import { Logo, Modal } from "@/components/ui";
import type { MockPlay, MockTicket } from "@/lib/product/api-types";
import { formatGs } from "@/lib/product/catalog";
import { ResultStateBadge, resultStateLabel } from "./result-state";
import { useSoundEffects } from "./use-sound-effects";
import productStyles from "./product.module.css";
import styles from "./ticket-receipt.module.css";

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

function formatReceiptDate(value: string | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Asuncion",
  }).format(date);
}

function formatMoney(value: number, currency: string | undefined) {
  if (!currency || currency === "PYG") return formatGs(value);
  try {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${new Intl.NumberFormat("es-PY").format(value)}`;
  }
}

function ticketStatusLabel(status: string) {
  switch (status.trim().toUpperCase()) {
    case "WON":
      return "Ganadora";
    case "LOST":
      return "No ganadora";
    default:
      return resultStateLabel(status);
  }
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
  const status = ticket.status ?? play.status;
  const currency = ticket.currency ?? "PYG";
  const amount = ticket.amount;
  const prize = ticket.prize ?? play.prize;
  const resultNumbers = ticket.resultNumbers?.length
    ? ticket.resultNumbers
    : play.resultNumbers?.length
      ? play.resultNumbers
      : play.result
        ? [play.result]
        : [];
  const code = ticket.code ?? ticket.id;
  const issuedAt = ticket.issuedAt ?? ticket.createdAt ?? play.createdAt;

  useEffect(() => {
    playSound("ticket");
  }, [playSound]);

  return (
    <Modal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Jugada registrada"
      description="Comprobante digital de quinie.LA"
      size="lg"
      footer={<button className={productStyles.primaryButton} onClick={onClose} type="button">Listo</button>}
    >
      <div className={styles.receiptFrame}>
        <article className={styles.receipt} data-testid="ticket-dialog" aria-label={`Comprobante ${code}`}>
          <header className={styles.receiptHeader}>
            <Logo className={styles.receiptLogo} size="sm" surface="light" />
            <div className={styles.receiptHeading}>
              <strong>Comprobante</strong>
              <ResultStateBadge status={status} label={ticketStatusLabel(status)} />
            </div>
          </header>

          <div className={styles.receiptGrid}>
            <dl className={styles.receiptFacts}>
              <div className={styles.receiptFact}><dt>Juego</dt><dd>{ticket.gameName ?? play.gameName ?? play.gameId}</dd></div>
              <div className={styles.receiptFact}><dt>Selección</dt><dd>{describeSelection(ticket.selection ?? play.selection)}</dd></div>
              {resultNumbers.length ? (
                <div className={styles.receiptFact}><dt>Resultado</dt><dd>{resultNumbers.join(" · ")}</dd></div>
              ) : null}
              {ticket.drawId ?? play.drawId ? (
                <div className={styles.receiptFact}><dt>Sorteo</dt><dd>{ticket.drawId ?? play.drawId}</dd></div>
              ) : null}
              <div className={styles.receiptFact}><dt>Fecha</dt><dd>{formatReceiptDate(issuedAt)}</dd></div>
            </dl>

            <dl className={styles.receiptFacts}>
              <div className={styles.receiptFact}><dt>Monto</dt><dd>{formatMoney(amount, currency)}</dd></div>
              <div className={styles.receiptFact} data-emphasis="prize"><dt>Premio</dt><dd>{formatMoney(prize, currency)}</dd></div>
              <div className={styles.receiptFact}><dt>Estado</dt><dd>{resultStateLabel(status)}</dd></div>
            </dl>
          </div>

          <div className={styles.codeRow}>
            <span>Código de comprobante</span>
            <strong>{code}</strong>
          </div>
          <div className={styles.barcode} aria-hidden="true" />
          <p className={styles.receiptFooter}>¡Gracias por jugar!</p>
        </article>
      </div>
    </Modal>
  );
}
