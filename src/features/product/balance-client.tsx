"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui";
import type { TopupMethod } from "@/lib/gaming/types";
import { formatGs } from "@/lib/product/catalog";
import { publicProductErrorMessage } from "@/lib/product/public-error";
import { useProduct } from "@/providers/product-provider";
import { AmountChip } from "./amount-chip";
import { SectionHeader } from "./section-header";
import styles from "./product.module.css";

export function BalanceClient() {
  const {
    session,
    loading,
    error,
    unauthorized,
    movements,
    movementsLoading,
    movementsError,
    walletAvailable,
    refresh,
    refreshMovements,
    requestTopUp,
  } = useProduct();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(50_000);
  const [method, setMethod] = useState<TopupMethod>("CASH_POINT");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const topup = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await requestTopUp({ amount, method });
      setMessage("Recarga acreditada correctamente.");
    } catch (reason) {
      setMessage(publicProductErrorMessage(reason, "No pudimos completar la recarga."));
    } finally {
      setPending(false);
    }
  };

  return (
    <main className={`${styles.page} ${styles.pageStack}`}>
      <section>
        <SectionHeader eyebrow="Tu billetera" title="Saldo y movimientos" description="El saldo se consulta y actualiza desde el servidor después de cada operación aceptada." />
        <div className={styles.accountGrid}>
          <article className={styles.contentCard}>
            <p className={styles.eyebrow}>Saldo disponible</p>
            <h2 className={styles.title}>{loading ? "—" : formatGs(session?.balance ?? 0)}</h2>
            <p className={styles.lede}>Moneda: {session?.currency ?? "PYG"}</p>
            <button className={styles.primaryButton} disabled={!walletAvailable || !session} onClick={() => setOpen(true)} style={{ marginTop: 24 }} type="button">Recargar saldo</button>
            {!walletAvailable ? <p className={styles.fieldHint}>La recarga no está disponible en este momento.</p> : null}
            {error ? <div className={styles.errorBox} role="alert"><p>{error}</p><button className={styles.quietButton} onClick={() => void refresh()} type="button">Reintentar conexión</button></div> : null}
            {!error && (unauthorized || (!loading && !session)) ? <p className={styles.fieldHint}>Iniciá sesión para consultar o recargar tu saldo. <Link className={styles.textLink} href="/cuenta">Ir a Cuenta</Link></p> : null}
          </article>
          <aside className={styles.contentCard}>
            <p className={styles.eyebrow}>Control</p>
            <h2 className={styles.sectionTitle}>Movimientos trazables</h2>
            <p className={styles.lede}>Cada apuesta, recarga y premio conserva una referencia para que puedas seguir el movimiento de tu saldo.</p>
          </aside>
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Actividad" title="Últimos movimientos" headingLevel={2} />
        {!error && !session ? (
          <div className={styles.statusBox} role="status">
            <p>Iniciá sesión para consultar tus movimientos.</p>
            <Link className={styles.secondaryButton} href="/cuenta">Ir a Cuenta</Link>
          </div>
        ) : movementsLoading ? <div className={styles.loadingBar} aria-label="Cargando movimientos" /> : null}
        {!error && session && movementsError ? (
          <div className={styles.errorBox} role="alert">
            <p>{movementsError}</p>
            <button className={styles.quietButton} onClick={() => void refreshMovements()} type="button">Reintentar</button>
          </div>
        ) : !error && session && !walletAvailable ? (
          <div className={styles.emptyState}><p>El historial de movimientos no está disponible en este momento.</p></div>
        ) : !error && session && !movementsLoading && movements.length === 0 ? <div className={styles.emptyState}><div><p>Tus movimientos aparecerán después de la primera jugada o recarga.</p><button className={styles.quietButton} onClick={() => void refreshMovements()} type="button">Actualizar</button></div></div> : !error && session ? (
          <div className={styles.list}>
            {movements.map((movement) => (
              <article className={styles.listItem} key={movement.id}>
                <div><h3>{({ TOPUP: "Recarga", STAKE: "Apuesta", PRIZE: "Premio", REFUND: "Reintegro" } as const)[movement.type]}</h3><p>{new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Asuncion" }).format(new Date(movement.createdAt))} · Saldo {formatGs(movement.balanceAfter)}</p></div>
                <div className={styles.listAmount}>{movement.amount > 0 ? "+" : "−"}{formatGs(Math.abs(movement.amount))}</div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <Modal open={open} onOpenChange={setOpen} title="Recargar saldo" description="Elegí el importe y el medio que vas a utilizar." size="sm">
        <form className={`${styles.ticketBody} ${styles.formStack}`} onSubmit={topup}>
          <div className={styles.fieldGroup}><span className={styles.fieldLabel}>Importe</span><div className={styles.chipGrid}>{[20_000, 50_000, 100_000, 200_000].map((value) => <AmountChip key={value} onSelect={setAmount} selected={amount === value} value={value} />)}</div></div>
          <div className={styles.fieldGroup}><label htmlFor="topup-method">Método</label><select className={styles.select} id="topup-method" onChange={(event) => setMethod(event.target.value as TopupMethod)} value={method}><option value="CASH_POINT">Punto autorizado</option><option value="BANK_TRANSFER">Transferencia</option><option value="CARD">Tarjeta</option></select></div>
          {message ? <div className={message.startsWith("Recarga") ? styles.statusBox : styles.errorBox} role={message.startsWith("Recarga") ? "status" : "alert"}>{message}</div> : null}
          <button className={styles.primaryButton} disabled={pending} type="submit">{pending ? "Procesando…" : "Confirmar recarga"}</button>
        </form>
      </Modal>
    </main>
  );
}
