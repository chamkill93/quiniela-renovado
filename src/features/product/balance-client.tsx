"use client";

import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui";
import { formatGs } from "@/lib/product/catalog";
import { useProduct } from "@/providers/product-provider";
import { SectionHeader } from "./section-header";
import styles from "./product.module.css";

export function BalanceClient() {
  const { session, loading, refresh } = useProduct();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(50_000);
  const [method, setMethod] = useState("CASH_POINT");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [movements, setMovements] = useState<Array<{
    id: string;
    type: "TOPUP" | "STAKE" | "PRIZE" | "REFUND";
    amount: number;
    createdAt: string;
    balanceAfter: number;
  }>>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/mock/wallet/movements", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("movements")))
      .then((body: { movements?: typeof movements }) => setMovements(body.movements ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const refreshMovements = async () => {
    const response = await fetch("/api/mock/wallet/movements", { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as { movements?: typeof movements };
    setMovements(body.movements ?? []);
  };

  const topup = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/mock/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ amount, method }),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "No pudimos completar la recarga.");
      await refresh();
      await refreshMovements();
      setMessage("Recarga acreditada correctamente.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No pudimos completar la recarga.");
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
            <button className={styles.primaryButton} onClick={() => setOpen(true)} style={{ marginTop: 24 }} type="button">Recargar saldo</button>
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
        {movements.length === 0 ? <div className={styles.emptyState}><p>Tus movimientos aparecerán después de la primera jugada o recarga.</p></div> : (
          <div className={styles.list}>
            {movements.map((movement) => (
              <article className={styles.listItem} key={movement.id}>
                <div><h3>{({ TOPUP: "Recarga", STAKE: "Apuesta", PRIZE: "Premio", REFUND: "Reintegro" } as const)[movement.type]}</h3><p>{new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(movement.createdAt))} · Saldo {formatGs(movement.balanceAfter)}</p></div>
                <div className={styles.listAmount}>{movement.amount > 0 ? "+" : "−"}{formatGs(Math.abs(movement.amount))}</div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal open={open} onOpenChange={setOpen} title="Recargar saldo" description="Elegí el importe y el medio que vas a utilizar." size="sm">
        <form className={`${styles.ticketBody} ${styles.formStack}`} onSubmit={topup}>
          <div className={styles.fieldGroup}><span className={styles.fieldLabel}>Importe</span><div className={styles.chipGrid}>{[20_000, 50_000, 100_000, 200_000].map((value) => <button className={styles.chip} data-selected={amount === value} key={value} onClick={() => setAmount(value)} type="button">{formatGs(value).replace("Gs. ", "")}</button>)}</div></div>
          <div className={styles.fieldGroup}><label htmlFor="topup-method">Método</label><select className={styles.select} id="topup-method" onChange={(event) => setMethod(event.target.value)} value={method}><option value="CASH_POINT">Punto autorizado</option><option value="BANK_TRANSFER">Transferencia</option><option value="CARD">Tarjeta</option></select></div>
          {message ? <div className={message.startsWith("Recarga") ? styles.statusBox : styles.errorBox} role="status">{message}</div> : null}
          <button className={styles.primaryButton} disabled={pending} type="submit">{pending ? "Procesando…" : "Confirmar recarga"}</button>
        </form>
      </Modal>
    </main>
  );
}
