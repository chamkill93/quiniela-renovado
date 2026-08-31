"use client";

import { useEffect } from "react";
import { Logo, Modal } from "@/components/ui";
import { DAILY_DRAW_SLOTS } from "@/lib/gaming/daily-draw-schedule";
import { formatInvertNumber } from "@/lib/gaming/invert";
import type { MockPlay, MockTicket } from "@/lib/product/api-types";
import { summarizeRedoblonaSelection, validateRedoblonaSelection, type RedoblonaSelection } from "@/lib/gaming/redoblona";
import { formatGs } from "@/lib/product/catalog";
import { ResultStateBadge, resultStateLabel } from "./result-state";
import { useSoundEffects } from "./use-sound-effects";
import productStyles from "./product.module.css";
import styles from "./ticket-receipt.module.css";

function describeSelection(selection: unknown, gameId?: string) {
  const isInvert = ["invert", "invertida"].includes(gameId?.trim().toLowerCase() ?? "");
  if (typeof selection === "string" || typeof selection === "number") {
    const value = String(selection);
    return isInvert && /^\d{3}$/.test(value) ? formatInvertNumber(value) : value;
  }
  if (Array.isArray(selection)) return selection.join(" · ");
  if (selection && typeof selection === "object") {
    const record = selection as Record<string, unknown>;
    if (gameId === "redoblona") {
      const candidate: RedoblonaSelection = {
        initialNumber: String(record.initialNumber ?? ""),
        initialUntil: Number(record.initialUntil),
        redoblonaNumber: String(record.redoblonaNumber ?? ""),
        redoblonaUntil: Number(record.redoblonaUntil),
      };
      if (Object.keys(validateRedoblonaSelection(candidate)).length === 0) {
        return summarizeRedoblonaSelection(candidate);
      }
      if (typeof record.head === "string" && typeof record.redoblona === "string" && typeof record.position === "number" && Number.isInteger(record.position)) {
        return `${record.head} Cabeza + ${record.redoblona} postura ${record.position}`;
      }
    }
    if (
      isInvert
      && typeof record.number === "string"
      && /^\d{3}$/.test(record.number)
      && typeof record.position === "number"
      && Number.isSafeInteger(record.position)
    ) {
      return `${formatInvertNumber(record.number)} · Postura ${record.position}`;
    }
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

function formatReceiptDraw(drawId: string) {
  const source = drawId.trim();
  const normalized = source.toLowerCase();
  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  const slot = DAILY_DRAW_SLOTS.find((candidate) =>
    normalized === candidate.id || normalized === candidate.slug ||
    tokens.includes(candidate.id) || tokens.includes(candidate.slug),
  );
  return slot?.label ?? source;
}

type ReceiptOutcome = "pending" | "won" | "lost" | "refunded";

function receiptOutcome(status: string): ReceiptOutcome {
  switch (status.trim().toUpperCase()) {
    case "WON":
      return "won";
    case "LOST":
      return "lost";
    case "REFUNDED":
      return "refunded";
    default:
      return "pending";
  }
}

function receiptOutcomeLabel(outcome: ReceiptOutcome) {
  switch (outcome) {
    case "won":
      return "Ganado";
    case "lost":
      return "Perdido";
    case "refunded":
      return "Reintegrado";
    default:
      return "Pendiente";
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
  const outcome = receiptOutcome(status);
  const drawId = ticket.drawId ?? play.drawId;
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
      size="md"
      className={styles.compactDialog}
      footer={<button className={productStyles.primaryButton} onClick={onClose} type="button">Listo</button>}
    >
      <div className={styles.receiptFrame}>
        <article className={styles.receipt} data-testid="ticket-dialog" aria-label={`Comprobante ${code}`}>
          <header className={styles.receiptHeader}>
            <Logo className={styles.receiptLogo} size="sm" surface="light" />
            <ResultStateBadge status={status} label={ticketStatusLabel(status)} />
          </header>

          <div className={styles.receiptGrid}>
            <dl className={styles.receiptFacts}>
              <div className={styles.receiptFact}><dt>Juego</dt><dd>{ticket.gameName ?? play.gameName ?? play.gameId}</dd></div>
              <div className={styles.receiptFact}><dt>Selección</dt><dd>{describeSelection(ticket.selection ?? play.selection, ticket.gameId ?? play.gameId)}</dd></div>
              {resultNumbers.length ? (
                <div className={styles.receiptFact}><dt>Resultado</dt><dd>{resultNumbers.join(" · ")}</dd></div>
              ) : null}
              {drawId ? (
                <div className={styles.receiptFact}><dt>Sorteo</dt><dd>{formatReceiptDraw(drawId)}</dd></div>
              ) : null}
              <div className={styles.receiptFact}><dt>Fecha</dt><dd>{formatReceiptDate(issuedAt)}</dd></div>
            </dl>

            <dl className={styles.receiptTotals}>
              <div className={styles.receiptFact}><dt>Monto</dt><dd>{formatMoney(amount, currency)}</dd></div>
              <div className={styles.receiptFact} data-emphasis="prize" data-outcome={outcome}>
                <dt>Monto a ganar</dt>
                <dd>
                  <span>{receiptOutcomeLabel(outcome)}</span>
                  {outcome === "won" && prize > 0 ? <span className={styles.prizeAmount}>{formatMoney(prize, currency)}</span> : null}
                </dd>
              </div>
            </dl>
          </div>

          <div className={styles.codeRow}>
            <span>Código de comprobante</span>
            <strong>{code}</strong>
          </div>
        </article>
      </div>
    </Modal>
  );
}
