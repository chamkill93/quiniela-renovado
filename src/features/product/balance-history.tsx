"use client";

import Link from "next/link";
import { useState, type RefObject } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import type { TopupMethod, WalletMovement } from "@/lib/gaming/types";
import { formatGs } from "@/lib/product/catalog";
import {
  filterWalletMovements, walletChannelForMethod, walletDate, walletMethodLabel, walletMovementLabel, walletReference,
  type MovementFilter, type MovementPeriod,
} from "./balance-data";
import styles from "./balance.module.css";

const FILTERS = [
  { value: "ALL", label: "Todos" },
  { value: "TOPUP", label: "Depósitos" },
  { value: "WITHDRAWAL", label: "Retiros" },
  { value: "OTHER", label: "Otros" },
] as const;
const PAGE_SIZE = 8;

function movementIcon(movement: WalletMovement): IconName {
  if (movement.type === "STAKE") return "ticket";
  if (movement.type === "PRIZE") return "prize";
  if (movement.type === "REFUND") return "refresh";
  return movement.amount > 0 ? "arrowDownLeft" : "arrowUpRight";
}

export function BalanceHistory({
  movements, loading, error, authenticated, available, onRefresh, onDeposit, headingRef,
}: {
  movements: readonly WalletMovement[];
  loading: boolean;
  error: boolean;
  authenticated: boolean;
  available: boolean;
  onRefresh: () => Promise<void>;
  onDeposit: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const [type, setType] = useState<MovementFilter>("ALL");
  const [method, setMethod] = useState<TopupMethod | "ALL">("ALL");
  const [period, setPeriod] = useState<MovementPeriod>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<WalletMovement | null>(null);
  const filtered = filterWalletMovements(movements, { type, method, period, query });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = type !== "ALL" || method !== "ALL" || period !== "ALL" || query.trim() !== "";
  const ready = authenticated && available && !loading && !error;

  function resetFilters() {
    setType("ALL"); setMethod("ALL"); setPeriod("ALL"); setQuery(""); setPage(1);
  }

  return <section aria-labelledby="wallet-movements-title" className={styles.history}>
    <header className={styles.historyHeader}>
      <div><h2 id="wallet-movements-title" ref={headingRef} tabIndex={-1}>Movimientos<span className={styles.historyCount}>{ready ? movements.length : "—"}</span></h2><p>Todo lo que entra y sale de tu cuenta.</p></div>
      <button aria-label="Actualizar movimientos" className={styles.refreshButton} disabled={loading || !authenticated || !available} onClick={() => void onRefresh()} type="button"><Icon className={loading ? styles.spinning : ""} name="refresh" size={17} /><span>Actualizar</span></button>
    </header>
    <div className={styles.historyControls}>
      <div aria-label="Tipo de movimiento" className={styles.movementTabs} role="group">{FILTERS.map((filter) => <button aria-pressed={type === filter.value} key={filter.value} onClick={() => { setType(filter.value); setPage(1); }} type="button"><span aria-hidden="true" className={styles.filterDot} data-type={filter.value} />{filter.label}</button>)}</div>
      <div className={styles.filterFields}>
        <div className={styles.searchField}><Icon name="search" size={18} /><label className="q-sr-only" htmlFor="wallet-search">Buscar movimientos</label><input autoComplete="off" id="wallet-search" onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar canal o referencia" type="search" value={query} /></div>
        <div className={styles.selectField}><label className="q-sr-only" htmlFor="wallet-channel-filter">Filtrar por canal</label><select id="wallet-channel-filter" onChange={(event) => { setMethod(event.target.value as TopupMethod | "ALL"); setPage(1); }} value={method}><option value="ALL">Todos los canales</option><option value="CARD">Tarjeta</option><option value="QR">QR</option><option value="CASH_POINT">Efectivo</option><option value="TIGO">Tigo</option><option value="CLARO">Claro</option><option value="PERSONAL">Personal</option><option value="BANK_TRANSFER">Transferencia</option></select></div>
        <div className={styles.selectField}><label className="q-sr-only" htmlFor="wallet-period-filter">Filtrar por período</label><select id="wallet-period-filter" onChange={(event) => { setPeriod(event.target.value as MovementPeriod); setPage(1); }} value={period}><option value="ALL">Todo el período</option><option value="7D">Últimos 7 días</option><option value="30D">Últimos 30 días</option></select></div>
      </div>
    </div>
    {loading ? <div aria-label="Cargando movimientos" className={styles.historyLoading} role="status"><span className={styles.spinner} /><p>Cargando tus movimientos…</p></div>
      : !authenticated ? <div className={styles.emptyState}><Icon name="user" size={30} /><h3>Tu billetera, en un solo lugar</h3><p>Iniciá sesión para ver tu saldo y consultar tus movimientos.</p><Link className={styles.primaryButton} href="/cuenta">Ir a mi cuenta<Icon name="chevronRight" size={16} /></Link></div>
      : error ? <div className={styles.emptyState} role="alert"><Icon name="warning" size={30} /><h3>No pudimos cargar tus movimientos</h3><p>Tu saldo no se modifica al actualizar el historial.</p><button className={styles.secondaryButton} onClick={() => void onRefresh()} type="button">Reintentar</button></div>
      : !available ? <div className={styles.emptyState}><Icon name="info" size={30} /><h3>El historial no está disponible</h3><p>Volvé a consultar en unos momentos.</p></div>
      : movements.length === 0 ? <div className={styles.emptyState}><span className={styles.emptyIcon}><Icon name="wallet" size={30} /></span><h3>Tu historial empieza acá</h3><p>Cuando hagas un depósito, retiro o jugada, vas a encontrar todos los detalles en este espacio.</p><button className={styles.primaryButton} onClick={onDeposit} type="button"><Icon name="plus" size={17} />Hacer un depósito</button></div>
      : filtered.length === 0 ? <div className={styles.emptyState}><Icon name="search" size={30} /><h3>No encontramos movimientos</h3><p>Probá con otro canal, período o referencia.</p><button className={styles.secondaryButton} onClick={resetFilters} type="button">Limpiar filtros</button></div>
      : <>
        <div aria-hidden="true" className={styles.tableHead}><span>Movimiento</span><span>Canal</span><span>Fecha y hora</span><span>Importe</span><span>Saldo resultante</span><span /></div>
        <ol aria-label="Historial de movimientos" className={styles.movementList}>
          {visible.map((movement) => <li key={movement.id}>
            <button aria-label={`Ver detalle: ${walletMovementLabel(movement.type)}, ${walletMethodLabel(movement.method)}, ${formatGs(Math.abs(movement.amount))}`} className={styles.movementRow} data-movement-type={movement.type} onClick={() => setDetail(movement)} type="button">
              <span className={styles.movementName}><span aria-hidden="true" className={styles.movementIcon}><Icon name={movementIcon(movement)} size={19} /></span><span className={styles.movementCopy}><strong>{walletMovementLabel(movement.type)}</strong><span className={styles.movementStatus}><Icon name="check" size={11} />Completado</span></span></span>
              <span className={styles.movementChannel}><span className={styles.channelBadge} data-channel={walletChannelForMethod(movement.method)} data-operator={movement.method}>{walletMethodLabel(movement.method)}</span></span>
              <time className={styles.movementDate} dateTime={movement.createdAt}><span>{walletDate(movement.createdAt)}</span><span>{walletDate(movement.createdAt, "time")}</span></time>
              <span className={styles.movementAmount}>{movement.amount >= 0 ? "+" : "−"}{formatGs(Math.abs(movement.amount))}</span>
              <span className={styles.movementBalance}><span>Saldo </span>{formatGs(movement.balanceAfter)}</span>
              <Icon className={styles.rowChevron} name="chevronRight" size={15} />
            </button>
          </li>)}
        </ol>
        <footer className={styles.historyFooter}>
          <p aria-live="polite" role="status">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} {filtered.length === 1 ? "movimiento" : "movimientos"}{hasFilters ? (filtered.length === 1 ? " filtrado" : " filtrados") : ""}</p>
          {pages > 1 ? <nav aria-label="Páginas de movimientos" className={styles.pagination}><button aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} type="button"><Icon name="arrowLeft" size={15} /></button><span>{currentPage} / {pages}</span><button aria-label="Página siguiente" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} type="button"><Icon name="chevronRight" size={15} /></button></nav> : <span className={styles.historyTimezone}>Hora de Paraguay</span>}
        </footer>
      </>}
    <Modal onOpenChange={(open) => { if (!open) setDetail(null); }} open={!!detail} size="sm" title="Detalle del movimiento">
      {detail ? <div className={styles.movementDetail}>
        <span aria-hidden="true" className={styles.detailIcon} data-movement-type={detail.type}><Icon name={movementIcon(detail)} size={28} /></span>
        <h3>{walletMovementLabel(detail.type)}</h3>
        <p className={styles.receiptAmount} data-direction={detail.amount >= 0 ? "deposit" : "withdrawal"}>{detail.amount >= 0 ? "+" : "−"}{formatGs(Math.abs(detail.amount))}</p>
        <dl className={styles.receiptDetails}><div><dt>Estado</dt><dd className={styles.completedBadge}><Icon name="check" size={13} />Completado</dd></div><div><dt>Canal</dt><dd>{walletMethodLabel(detail.method)}</dd></div><div><dt>Fecha y hora</dt><dd>{walletDate(detail.createdAt)} · {walletDate(detail.createdAt, "time")}</dd></div><div><dt>Referencia</dt><dd className={styles.reference}>{walletReference(detail)}</dd></div><div className={styles.receiptBalance}><dt>Saldo después de la operación</dt><dd>{formatGs(detail.balanceAfter)}</dd></div></dl>
        <button className={styles.secondaryButton} onClick={() => setDetail(null)} type="button">Cerrar detalle</button>
      </div> : null}
    </Modal>
  </section>;
}
