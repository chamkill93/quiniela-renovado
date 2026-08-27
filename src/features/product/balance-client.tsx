"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import type { WalletMovement } from "@/lib/gaming/types";
import { formatGs } from "@/lib/product/catalog";
import { useProduct } from "@/providers/product-provider";
import { BalanceHistory } from "./balance-history";
import { BalanceOperationForm } from "./balance-operation-form";
import { WALLET_CHANNELS, summarizeWalletMovements, type WalletChannel, type WalletOperation } from "./balance-data";
import styles from "./balance.module.css";

export function BalanceClient() {
  const { session, loading, error, unauthorized, movements, movementsLoading, movementsError, walletAvailable, withdrawalAvailable, refresh, refreshMovements } = useProduct();
  const [operation, setOperation] = useState<{ type: WalletOperation; channel: WalletChannel; sessionId: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState<WalletMovement | null>(null);
  const historyHeading = useRef<HTMLHeadingElement>(null);
  const authenticated = !!session && !unauthorized;
  const canOperate = authenticated && walletAvailable && !loading && !error;
  const balanceUnavailable = loading || !authenticated || !!error;
  const summary = summarizeWalletMovements(authenticated ? movements : []);
  const summaryReady = authenticated && walletAvailable && !loading && !error && !movementsLoading && !movementsError;
  const activeOperation = operation?.sessionId === session?.id ? operation : null;

  function openOperation(type: WalletOperation, channel: WalletChannel = "card") {
    if (!canOperate || !session || (type === "withdrawal" && !withdrawalAvailable)) return;
    setPending(false);
    setOperation({ type, channel, sessionId: session.id });
  }

  function showMovements() {
    setOperation(null);
    window.requestAnimationFrame(() => historyHeading.current?.focus());
  }

  return <main className={styles.page}>
    <header className={styles.pageHeader}>
      <div><p className={styles.eyebrow}>TU BILLETERA</p><h1>Saldo y movimientos</h1><p className={styles.intro}>Cargá, retirá y llevá el control de tu saldo.</p></div>
      <Link className={styles.accountLink} href="/cuenta"><Icon name="user" size={16} />Mi cuenta<Icon name="chevronRight" size={14} /></Link>
    </header>

    {error ? <div className={styles.connectionError} role="alert"><Icon name="warning" size={20} /><p>No pudimos consultar tu saldo. Revisá la conexión e intentá nuevamente.</p><button disabled={loading} onClick={() => void refresh()} type="button">Reintentar</button></div> : null}

    <section aria-label="Resumen de tu billetera" className={styles.summaryGrid}>
      <article className={styles.balanceCard}>
        <div className={styles.balanceTopline}><span><Icon name="wallet" size={21} />Saldo disponible</span><span className={styles.currencyBadge}>PYG</span></div>
        <p aria-label={`Saldo disponible: ${balanceUnavailable ? "no disponible" : formatGs(session!.balance)}`} aria-live="polite" className={styles.balanceValue}><span aria-hidden="true">₲</span>{balanceUnavailable ? "—" : new Intl.NumberFormat("es-PY").format(session!.balance)}</p>
        <p className={styles.balanceCaption}>Tu saldo en guaraníes, siempre a mano.</p>
        <div className={styles.balanceActions}>
          <button className={styles.primaryButton} disabled={!canOperate} onClick={() => openOperation("deposit")} type="button"><Icon name="plus" size={18} />Cargar saldo</button>
          <button className={styles.secondaryButton} disabled={!canOperate || !withdrawalAvailable} onClick={() => openOperation("withdrawal")} type="button"><Icon name="arrowUpRight" size={18} />Retirar saldo</button>
        </div>
        {!loading && !error && !authenticated ? <p className={styles.balanceNotice}>Iniciá sesión para operar. <Link href="/cuenta">Ingresar a mi cuenta</Link></p> : null}
        {!loading && authenticated && !walletAvailable ? <p className={styles.balanceNotice}>Las operaciones no están disponibles en este momento.</p> : !loading && authenticated && walletAvailable && !withdrawalAvailable ? <p className={styles.balanceNotice}>Los retiros no están disponibles en este momento.</p> : null}
      </article>
      <aside className={styles.activityCard}>
        <div className={styles.activityHeader}><h2>Tu actividad</h2><span>Historial disponible</span></div>
        <div className={styles.activityItem} data-direction="deposit"><span aria-hidden="true" className={styles.directionIcon}><Icon name="arrowDownLeft" size={23} /></span><div><p>Depósitos</p><span>{summaryReady ? `${summary.depositCount} ${summary.depositCount === 1 ? "operación" : "operaciones"}` : "—"}</span></div><strong>{summaryReady ? formatGs(summary.deposits) : "—"}</strong></div>
        <div className={styles.activityItem} data-direction="withdrawal"><span aria-hidden="true" className={styles.directionIcon}><Icon name="arrowUpRight" size={23} /></span><div><p>Retiros</p><span>{summaryReady ? `${summary.withdrawalCount} ${summary.withdrawalCount === 1 ? "operación" : "operaciones"}` : "—"}</span></div><strong>{summaryReady ? formatGs(summary.withdrawals) : "—"}</strong></div>
        <p className={styles.activityNote}>Totales de los movimientos registrados en este historial.</p>
      </aside>
    </section>

    <section aria-labelledby="wallet-channels-title" className={styles.channelsSection}>
      <div className={styles.channelsHeader}><h2 id="wallet-channels-title">Canales disponibles</h2><p>Elegí un canal para cargar saldo.</p></div>
      <div className={styles.channelCards}>{WALLET_CHANNELS.map((channel) => <button aria-label={`Cargar saldo por ${channel.label.toLowerCase()}`} className={styles.channelCard} data-channel={channel.id} disabled={!canOperate} key={channel.id} onClick={() => openOperation("deposit", channel.id)} type="button">
        <span aria-hidden="true" className={styles.channelIcon}><Icon name={channel.icon} size={24} /></span><span className={styles.channelCopy}><strong>{channel.label}</strong>{channel.id === "phone" ? <span className={styles.phoneNames}><span data-operator="TIGO">Tigo</span><span data-operator="CLARO">Claro</span><span data-operator="PERSONAL">Personal</span></span> : <span>{channel.description}</span>}</span><Icon className={styles.channelChevron} name="chevronRight" size={14} />
      </button>)}</div>
    </section>

    <BalanceHistory authenticated={authenticated} available={walletAvailable} error={!!movementsError || !!error} headingRef={historyHeading} key={`${session?.id ?? "guest"}:${completed?.id ?? "initial"}`} loading={loading || movementsLoading} movements={authenticated ? movements : []} onDeposit={() => openOperation("deposit")} onRefresh={error ? refresh : refreshMovements} />

    <aside className={styles.responsibleFooter}><span><Icon name="shield" size={17} />Vos decidís cuánto y cuándo operar.</span><Link href="/cuenta">Gestionar mis límites<Icon name="chevronRight" size={13} /></Link></aside>

    <Modal closeDisabled={pending} closeOnBackdrop={!pending} description="Elegí el importe y el canal de tu operación." onOpenChange={(open) => { if (!open && !pending) setOperation(null); }} open={!!activeOperation && authenticated} size="md" title={activeOperation?.type === "withdrawal" ? "Retirar saldo" : "Cargar saldo"}>
      {activeOperation ? <BalanceOperationForm initialChannel={activeOperation.channel} key={`${activeOperation.sessionId}:${activeOperation.type}:${activeOperation.channel}`} onBusyChange={setPending} onComplete={setCompleted} onDone={showMovements} operation={activeOperation.type} /> : null}
    </Modal>
  </main>;
}
