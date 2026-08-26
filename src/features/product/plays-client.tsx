"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useProduct } from "@/providers/product-provider";
import type { MockPlay, MockTicket } from "@/lib/product/api-types";
import { formatGs } from "@/lib/product/catalog";
import { SectionHeader } from "./section-header";
import { RemoteUnauthorizedState } from "./remote-view-state";
import { ResultStateBadge } from "./result-state";
import { TicketDialog } from "./ticket-dialog";
import styles from "./product.module.css";
import receiptStyles from "./ticket-receipt.module.css";

interface OpenReceipt {
  play: MockPlay;
  ticket: MockTicket;
  ownerSessionId: string;
}

interface TicketRequestState {
  playId: string;
  status: "loading" | "error";
}

export function PlaysClient() {
  const { plays, session, loading, error, unauthorized, refresh, getTicket } = useProduct();
  const [openReceipt, setOpenReceipt] = useState<OpenReceipt | null>(null);
  const [ticketRequest, setTicketRequest] = useState<TicketRequestState | null>(null);
  const ticketRequestId = useRef(0);

  const showReceipt = async (play: MockPlay) => {
    if (!play.ticketId || !session) return;
    const requestId = ++ticketRequestId.current;
    setTicketRequest({ playId: play.id, status: "loading" });

    try {
      const ticket = await getTicket(play.ticketId);
      if (requestId !== ticketRequestId.current) return;
      if (ticket.playId !== play.id) {
        setTicketRequest({ playId: play.id, status: "error" });
        return;
      }
      setOpenReceipt({ play, ticket, ownerSessionId: session.id });
      setTicketRequest(null);
    } catch {
      if (requestId === ticketRequestId.current) {
        setTicketRequest({ playId: play.id, status: "error" });
      }
    }
  };

  const closeReceipt = () => {
    ticketRequestId.current += 1;
    setOpenReceipt(null);
  };

  return (
    <main className={styles.page}>
      <SectionHeader
        eyebrow="Tu actividad"
        title="Mis Jugadas"
        description="Cada jugada aceptada permanece disponible aunque cierres su comprobante o cambies de pantalla."
      />
      {loading ? <div className={styles.loadingBar} aria-label="Cargando jugadas" /> : null}
      {error ? <div className={styles.errorBox} role="alert">{error} <button className={styles.quietButton} onClick={() => void refresh()} type="button">Reintentar</button></div> : null}
      {!loading && !error && (unauthorized || !session) ? (
        <RemoteUnauthorizedState message="Iniciá sesión para consultar tus jugadas." />
      ) : !loading && !error && plays.length === 0 ? (
        <div className={styles.emptyState}>
          <div>
            <h2>Todavía no registraste jugadas</h2>
            <p>Cuando confirmes una Quiniela o Instantánea, aparecerá en este historial.</p>
            <Link className={styles.primaryButton} href="/quinielas">Hacer una jugada</Link>
          </div>
        </div>
      ) : (
        <div className={styles.list}>
          {plays.map((play) => (
            <article className={styles.listItem} key={play.id}>
              <div>
                <p className={styles.eyebrow}>{play.family === "INSTANT" ? "Instantánea" : "Quiniela"}</p>
                <h3>{play.gameName ?? play.gameId}</h3>
                <p>{new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Asuncion" }).format(new Date(play.createdAt))}</p>
                <ResultStateBadge status={play.status} />
              </div>
              <div className={receiptStyles.playReceiptActions}>
                <div className={styles.listAmount}>
                  {formatGs(play.amount)}
                  {typeof play.prize === "number" && play.prize > 0 ? <small>Premio {formatGs(play.prize)}</small> : null}
                </div>
                <div className={receiptStyles.playReceiptControl}>
                  <button
                    className={`${styles.quietButton} ${receiptStyles.playReceiptButton}`}
                    type="button"
                    aria-haspopup={play.ticketId ? "dialog" : undefined}
                    aria-busy={ticketRequest?.playId === play.id && ticketRequest.status === "loading"}
                    disabled={!play.ticketId || (ticketRequest?.playId === play.id && ticketRequest.status === "loading")}
                    onClick={() => void showReceipt(play)}
                  >
                    {!play.ticketId
                      ? "Comprobante no disponible"
                      : ticketRequest?.playId === play.id && ticketRequest.status === "loading"
                        ? "Cargando comprobante…"
                        : "Ver mi comprobante"}
                  </button>
                  {ticketRequest?.playId === play.id && ticketRequest.status === "error" ? (
                    <span className={receiptStyles.playReceiptError} role="alert">
                      No pudimos cargar el comprobante. Intentá de nuevo.
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {openReceipt && session?.id === openReceipt.ownerSessionId ? (
        <TicketDialog
          ticket={openReceipt.ticket}
          play={openReceipt.play}
          onClose={closeReceipt}
        />
      ) : null}
    </main>
  );
}
