"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import type { DrawDefinition, TraditionalGameDefinition } from "@/lib/gaming/types";
import { summarizeRedoblonaSelection, validateRedoblonaSelection, type RedoblonaSelection } from "@/lib/gaming/redoblona";
import { getTraditionalStakeTotals, isTraditionalStakeAmount, TRADITIONAL_MAX_STAKE_PER_DRAW } from "@/lib/gaming/traditional-stake";
import type { ProductPlayCommand } from "@/lib/product/gateway";
import { type ProductGame, type TraditionalGameId, formatGs } from "@/lib/product/catalog";
import { publicProductErrorMessage } from "@/lib/product/public-error";
import { useProduct } from "@/providers/product-provider";
import { GameIcon } from "./game-icon";
import { AmountChip } from "./amount-chip";
import { DrawIcon } from "./draw-icon";
import {
  buildTraditionalPlayInput, createTraditionalDraft, getTraditionalPositionLabel,
  getRedoblonaRanges, getTraditionalPositionRange, normalizeTraditionalNumber, randomizeTraditionalDraft,
  validateTraditionalDraft, type TraditionalDraft,
} from "./traditional-game-form";
import { useDrawClock } from "./use-draw-clock";
import { useSoundEffects } from "./use-sound-effects";
import styles from "./traditional-game.module.css";

type AcceptedPayment = { id: string; amount: number; replayed: boolean };
type ReviewEntry = {
  command: Extract<ProductPlayCommand, { kind: "traditional" }>;
  draw: DrawDefinition;
  state: "ready" | "unconfirmed" | "accepted";
  receipt?: AcceptedPayment;
};
type Review = { entries: ReviewEntry[]; draft: TraditionalDraft; sessionId: string; sessionRevision: number };
type AcceptedBatch = { payments: AcceptedPayment[]; sessionId: string; skipped?: number };

function formatDrawDate(value: string) {
  return new Intl.DateTimeFormat("es-PY", { day: "numeric", month: "short", timeZone: "America/Asuncion" }).format(new Date(value));
}

function formatDrawTime(value: string) {
  return new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Asuncion" }).format(new Date(value));
}

function formatDrawName(draw: DrawDefinition) {
  return draw.label.replace(/\s*·\s*\d{1,2}:\d{2}\s*$/, "");
}

function isDrawOpen(draw: DrawDefinition, now: number | null) {
  return now !== null && draw.status === "OPEN" && Date.parse(draw.closesAt) > now;
}

function isDrawOpenAtSubmission(draw: DrawDefinition) {
  return isDrawOpen(draw, Date.now());
}

function isReviewEntryAvailable(entry: ReviewEntry, draws: DrawDefinition[], now: number | null) {
  const current = draws.find((draw) => draw.id === entry.draw.id);
  return Boolean(current && current.drawsAt === entry.draw.drawsAt &&
    current.closesAt === entry.draw.closesAt && isDrawOpen(current, now));
}

function paymentFailureDetails(reason: unknown) {
  const failure = reason && typeof reason === "object" ? reason as { status?: unknown; code?: unknown } : {};
  return { status: Number(failure.status), code: typeof failure.code === "string" ? failure.code : "" };
}

function isDefiniteRejection(reason: unknown) {
  const { status, code } = paymentFailureDetails(reason);
  return status >= 400 && status < 500 && [
    "INSUFFICIENT_BALANCE", "INSUFFICIENT_FUNDS", "ACCOUNT_AMOUNT_LIMIT", "ACCOUNT_PAUSED",
    "ACCOUNT_TIME_LIMIT", "GAME_NOT_FOUND", "DRAW_NOT_AVAILABLE", "VALIDATION_ERROR",
    "INVALID_JSON", "IDEMPOTENCY_KEY_REQUIRED",
  ].includes(code);
}

function preventsPaymentRetry(reason: unknown) {
  const { status, code } = paymentFailureDetails(reason);
  return [401, 419, 440].includes(status) ||
    ["PRODUCT_OPERATION_SUPERSEDED", "ACCOUNT_SESSION_CHANGED", "IDEMPOTENCY_CONFLICT"].includes(code);
}

export function TraditionalGameClient({ game }: { game: ProductGame<TraditionalGameId> }) {
  return <TraditionalBetForm game={game} key={game.id} />;
}

function TraditionalBetForm({ game }: { game: ProductGame<TraditionalGameId> }) {
  const { requestPlay, getSessionRevision, catalog, session, loading, unauthorized, error: gatewayError, refresh, walletAvailable } = useProduct();
  const { now, openedAt } = useDrawClock();
  const [draft, setDraft] = useState(() => createTraditionalDraft(game.id));
  const [touched, setTouched] = useState<Partial<Record<keyof TraditionalDraft, boolean>>>({});
  const [drawIds, setDrawIds] = useState<string[] | null>(null);
  const [amount, setAmount] = useState(0);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [retryBlocked, setRetryBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<string | null>(null);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [accepted, setAccepted] = useState<AcceptedBatch | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [randomAnnouncement, setRandomAnnouncement] = useState("");
  const paymentLock = useRef(false);
  const reviewRef = useRef<Review | null>(null);
  const interruptedReview = useRef(false);
  const mounted = useRef(true);
  const latestContext = useRef({ catalog, session, unauthorized });
  const editButton = useRef<HTMLButtonElement>(null);
  const playSound = useSoundEffects();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    latestContext.current = { catalog, session, unauthorized };
    if (reviewRef.current && (unauthorized || session?.id !== reviewRef.current.sessionId)) {
      // Authentication resets the provider's idempotency keys, even for a later login with the same ID.
      interruptedReview.current = true;
    }
  }, [catalog, session, unauthorized]);

  const remoteGame = catalog?.traditional.find((definition) => definition.id === game.id);
  const displayName = remoteGame?.name ?? game.name;
  const availableAmounts = [...new Set((catalog?.amounts ?? []).filter(isTraditionalStakeAmount))];
  const availableTotals = getTraditionalStakeTotals(availableAmounts);
  const availableDraws = useMemo(() => {
    if (!catalog || !remoteGame) return [];
    const allowed = new Set(remoteGame.drawIds);
    return catalog.draws.filter((draw) => allowed.has(draw.id));
  }, [catalog, remoteGame]);
  const effectiveAmount = availableTotals.includes(amount) ? amount : 0;
  const initialDraw = availableDraws.filter((draw) => isDrawOpen(draw, openedAt))
    .sort((first, second) => Date.parse(first.drawsAt) - Date.parse(second.drawsAt))[0];
  // An explicit empty selection stays empty. A cutoff never selects a different draw.
  const selectedIds = drawIds ?? (initialDraw ? [initialDraw.id] : []);
  const selectedDraws = availableDraws.filter((draw) => selectedIds.includes(draw.id))
    .sort((first, second) => Date.parse(first.drawsAt) - Date.parse(second.drawsAt));
  const drawsOpen = selectedDraws.length > 0 && selectedDraws.length === selectedIds.length &&
    selectedDraws.every((draw) => isDrawOpen(draw, now));
  const total = effectiveAmount * selectedDraws.length;
  const draftErrors = remoteGame ? validateTraditionalDraft(game.id, draft, remoteGame) : {};
  const validSelection = Boolean(remoteGame) && Object.keys(draftErrors).length === 0;
  const insufficientBalance = Boolean(session && session.balance < total);
  const canReview = !loading && !gatewayError && !unauthorized && Boolean(session) && Boolean(remoteGame) &&
    validSelection && drawsOpen && total > 0 && Number.isSafeInteger(total) && !insufficientBalance && !pending && !accepted;
  const fieldsDisabled = loading || !remoteGame || pending || Boolean(accepted) || Boolean(review);
  const positionRange = remoteGame ? getTraditionalPositionRange(remoteGame) : null;
  const redoblonaRanges = remoteGame ? getRedoblonaRanges(remoteGame) : null;
  const outstanding = review?.entries.filter((entry) => entry.state !== "accepted") ?? [];
  const paidEntries = review?.entries.filter((entry) => entry.state === "accepted") ?? [];
  const hasUnconfirmed = outstanding.some((entry) => entry.state === "unconfirmed");
  const reviewTotal = review?.entries.reduce((sum, entry) => sum + entry.command.input.amount, 0) ?? 0;
  const remainingTotal = outstanding.reduce((sum, entry) => sum + entry.command.input.amount, 0);
  const paidTotal = paidEntries.reduce((sum, entry) => sum + (entry.receipt?.amount ?? 0), 0);
  const entriesToValidate = hasUnconfirmed ? outstanding.filter((entry) => entry.state === "unconfirmed") : outstanding;
  const reviewStillValid = Boolean(review && session?.id === review.sessionId && remoteGame &&
    outstanding.length && entriesToValidate.every((entry) => availableTotals.includes(entry.command.input.amount) &&
      isReviewEntryAvailable(entry, availableDraws, now)) &&
    Object.keys(validateTraditionalDraft(game.id, review.draft, remoteGame)).length === 0);
  // A lost response may already have debited this amount; let the same request recover its receipt.
  const reviewInsufficient = Boolean(review && session && !hasUnconfirmed && session.balance < remainingTotal);
  const canPayReview = reviewStillValid && !reviewInsufficient && !loading && !gatewayError &&
    !unauthorized && !pending && !retryBlocked && !paymentInfo && !refreshingBalance;
  const reviewCanEdit = Boolean(review && review.entries.every((entry) => entry.state === "ready"));
  const acceptedAmount = accepted?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
  const acceptedCount = accepted?.payments.length ?? 0;
  const acceptedReplayed = accepted?.payments.some((payment) => payment.replayed) ?? false;

  function saveReview(next: Review | null) {
    reviewRef.current = next;
    if (mounted.current) setReview(next);
  }

  function updateDraft(key: keyof TraditionalDraft, value: string | number) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
    setRandomAnnouncement("");
  }

  function updateInitialUntil(value: number) {
    setDraft((current) => ({
      ...current,
      initialUntil: value,
      redoblonaUntil: Math.max(current.redoblonaUntil, value),
    }));
    setError(null);
  }

  function removeClosedDraws() {
    if (fieldsDisabled || reviewRef.current || paymentLock.current) return;
    const openIds = new Set(availableDraws.filter(isDrawOpenAtSubmission).map((draw) => draw.id));
    setDrawIds(selectedIds.filter((id) => openIds.has(id)));
    setError(null);
  }

  function addAmount(value: number) {
    if (fieldsDisabled || reviewRef.current || paymentLock.current || !availableAmounts.includes(value)) return;
    setAmount((current) => {
      const base = availableTotals.includes(current) ? current : 0;
      const next = base + value;
      return isTraditionalStakeAmount(next) ? next : current;
    });
    setError(null);
  }

  function clearAmount() {
    if (fieldsDisabled || reviewRef.current || paymentLock.current) return;
    setAmount(0);
    setError(null);
  }

  function randomize() {
    if (fieldsDisabled) return;
    const next = randomizeTraditionalDraft(game.id, draft);
    setDraft(next);
    setTouched({});
    setError(null);
    setRandomAnnouncement(game.id === "redoblona" ? "Números elegidos: " + next.initialNumber + " y " + next.redoblonaNumber + "." : "Número elegido: " + next.number + ".");
  }

  function openReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reviewRef.current) {
      setReview(reviewRef.current);
      setReviewOpen(true);
      return;
    }
    if (!canReview || !session || !selectedDraws.every(isDrawOpenAtSubmission)) return;
    setError(null);
    setPaymentInfo(null);
    setRetryBlocked(false);
    interruptedReview.current = false;
    saveReview({
      entries: selectedDraws.map((draw) => ({
        command: { kind: "traditional", input: buildTraditionalPlayInput(game.id, effectiveAmount, draw.id, draft) },
        draw: { ...draw },
        state: "ready",
      })),
      draft: { ...draft },
      sessionId: session.id,
      sessionRevision: getSessionRevision(),
    });
    setReviewOpen(true);
  }

  async function submitPayment() {
    let current = reviewRef.current;
    if (paymentLock.current || !current || !canPayReview || !session) return;
    if (interruptedReview.current || getSessionRevision() !== current.sessionRevision) {
      setRetryBlocked(true);
      setError("La sesión cambió. Revisá Mis jugadas antes de preparar otra jugada.");
      return;
    }
    paymentLock.current = true;
    setPending(true);
    setError(null);
    setPaymentInfo(null);
    let confirmedBalance = session.balance;
    try {
      // Each accepted draw is recorded before the next request. Retries only use outstanding commands.
      for (const entry of current.entries) {
        if (entry.state === "accepted") continue;
        if (!mounted.current) return;
        const context = latestContext.current;
        if (interruptedReview.current || getSessionRevision() !== current.sessionRevision || context.unauthorized || context.session?.id !== current.sessionId) {
          interruptedReview.current = true;
          setRetryBlocked(true);
          throw new Error("La sesión cambió. Revisá Mis jugadas antes de continuar.");
        }
        const definition = context.catalog?.traditional.find((item) => item.id === game.id);
        const offeredDraws = context.catalog?.draws.filter((draw) => definition?.drawIds.includes(draw.id)) ?? [];
        // With generic draw IDs, a retry after rollover could target a different date.
        if (!definition || !getTraditionalStakeTotals(context.catalog?.amounts ?? []).includes(entry.command.input.amount) ||
          !isReviewEntryAvailable(entry, offeredDraws, now) || !isDrawOpenAtSubmission(entry.draw) ||
          Object.keys(validateTraditionalDraft(game.id, current.draft, definition)).length > 0) {
          throw new Error("Cambió la disponibilidad de un sorteo. Los pagos registrados se conservan; revisá Mis jugadas.");
        }
        if (entry.state === "ready") {
          const needed = current.entries.filter((item) => item.state !== "accepted")
            .reduce((sum, item) => sum + item.command.input.amount, 0);
          if (confirmedBalance < needed) {
            throw new Error("Tu saldo no alcanza para los sorteos pendientes. Los pagos registrados se conservan.");
          }
        }
        const wasUnconfirmed = entry.state === "unconfirmed";
        current = { ...current, entries: current.entries.map((item) => item === entry ? { ...item, state: "unconfirmed" } : item) };
        saveReview(current);
        try {
          const data = await requestPlay(entry.command);
          const receipt = { id: data.play.id, amount: data.play.amount, replayed: data.replayed };
          current = {
            ...current,
            entries: current.entries.map((item) => item.draw.id === entry.draw.id ? { ...item, state: "accepted", receipt } : item),
          };
          saveReview(current);
          if (!data.replayed) confirmedBalance = data.session.balance;
          // A replay carries an old balance. Let the provider reconcile before offering more payments.
          if (data.replayed && current.entries.some((item) => item.state !== "accepted")) {
            if (mounted.current) setPaymentInfo("Pago recuperado. Revisá el saldo actualizado para continuar con los sorteos pendientes.");
            return;
          }
        } catch (reason) {
          if (!wasUnconfirmed && isDefiniteRejection(reason)) {
            current = { ...current, entries: current.entries.map((item) => item.draw.id === entry.draw.id ? { ...item, state: "ready" } : item) };
            saveReview(current);
          }
          if (preventsPaymentRetry(reason) && mounted.current) {
            interruptedReview.current = true;
            setRetryBlocked(true);
          }
          throw reason;
        }
      }
      if (!mounted.current) return;
      const payments = current.entries.flatMap((entry) => entry.receipt ? [entry.receipt] : []);
      if (payments.length !== current.entries.length) return;
      setAccepted({ payments, sessionId: current.sessionId });
      saveReview(null);
      setReviewOpen(false);
      setShowSuccess(true);
      playSound("confirm");
    } catch (reason) {
      if (mounted.current) setError(publicProductErrorMessage(reason, "No pudimos confirmar el pago. Revisá Mis jugadas antes de crear otra jugada."));
    } finally {
      paymentLock.current = false;
      if (mounted.current) setPending(false);
    }
  }

  function closeReview() {
    if (paymentLock.current) return;
    setReviewOpen(false);
    if (reviewRef.current?.entries.every((entry) => entry.state === "ready")) {
      saveReview(null);
      setError(null);
    }
  }

  async function updateReviewedBalance() {
    if (refreshingBalance || paymentLock.current) return;
    setRefreshingBalance(true);
    try {
      await refresh();
      if (mounted.current) setPaymentInfo(null);
    } finally {
      if (mounted.current) setRefreshingBalance(false);
    }
  }

  function finishRegistered() {
    const current = reviewRef.current;
    if (paymentLock.current || !current || current.entries.some((entry) => entry.state === "unconfirmed")) return;
    const payments = current.entries.flatMap((entry) => entry.receipt ? [entry.receipt] : []);
    if (!payments.length) return;
    setAccepted({ payments, sessionId: current.sessionId, skipped: current.entries.length - payments.length });
    saveReview(null);
    setReviewOpen(false);
    setShowSuccess(true);
  }

  function newPlay() {
    setAccepted(null);
    setShowSuccess(false);
    saveReview(null);
    setReviewOpen(false);
    setError(null);
    setPaymentInfo(null);
    setTouched({});
    setDraft(createTraditionalDraft(game.id));
    setAmount(0);
    setRandomAnnouncement("");
  }

  return (
    <main className={styles.page} data-game={game.id}>
      <div className={styles.breadcrumb}>
        <Link href="/quinielas"><Icon name="arrowLeft" size={16} />Quinielas</Link>
        <Link className={styles.rulesLink} href="/reglas"><Icon name="rules" size={16} />Cómo jugar</Link>
      </div>
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}><GameIcon gameId={game.id} className={styles.heroIcon} /><div className={styles.titleCopy}><h1>{displayName}</h1>{game.id === "redoblona" ? <p>Acertá dos números y combiná sus alcances.</p> : null}</div></div>
      </header>
      {game.id === "redoblona" ? <details className={styles.howItWorks}><summary>¿Cómo funciona?</summary><p>Elegís dos números de 2 cifras. Ambos deben aparecer en posiciones distintas dentro de sus alcances. Con Cabeza, la Redoblona se busca desde la 2.ª posición.</p></details> : null}
      {loading ? <div className={styles.notice} role="status">Cargando sorteos y saldo…</div> : null}
      {!loading && catalog && !remoteGame ? <div className={styles.errorNotice} role="alert">Este juego no está disponible en este momento. <Link href="/quinielas">Ver otras modalidades</Link></div> : null}
      {gatewayError ? <div className={styles.errorNotice} role="alert"><p>{gatewayError}</p><button type="button" className={styles.textButton} onClick={() => void refresh()}>Reintentar conexión</button></div> : null}
      {!gatewayError && (unauthorized || (!loading && !session)) ? <div className={styles.notice} role="alert">Iniciá sesión para pagar con tu saldo. <Link href="/cuenta">Ir a Cuenta<Icon name="chevronRight" size={14} /></Link></div> : null}

      <form className={styles.layout} onSubmit={openReview} noValidate aria-label="Preparar jugada">
        <div className={styles.steps}>
          <section className={styles.stepCard} aria-labelledby="draw-step-title">
            <StepHeading number="1" id="draw-step-title" title="Sorteos" />
            <fieldset className={styles.fieldset} disabled={fieldsDisabled}>
              <legend className="q-sr-only">Sorteos</legend>
              <div className={styles.drawGrid}>
                {availableDraws.map((draw) => {
                  const open = isDrawOpen(draw, now);
                  const selected = selectedIds.includes(draw.id);
                  return <label className={styles.drawOption} key={draw.id} data-selected={selected} data-closed={!open}>
                    <input type="checkbox" name="traditional-draw" value={draw.id} checked={selected} disabled={!open}
                      aria-label={formatDrawName(draw) + " · " + formatDrawTime(draw.drawsAt) + " · " + formatDrawDate(draw.drawsAt) + (now !== null && !open ? " · Cerrado" : "")}
                      onChange={() => {
                        if (fieldsDisabled || reviewRef.current || paymentLock.current || !isDrawOpenAtSubmission(draw)) return;
                        setDrawIds(selected ? selectedIds.filter((id) => id !== draw.id) : [...selectedIds, draw.id]);
                        setError(null);
                      }} />
                    <span className={styles.radioMark} aria-hidden="true">{selected ? <Icon name="check" size={11} /> : null}</span>
                    <DrawIcon drawId={draw.id} label={formatDrawName(draw)} size="sm" className={styles.drawLogo} />
                    <span className={styles.drawName}>{formatDrawName(draw)}</span><strong className={styles.drawTime}>{formatDrawTime(draw.drawsAt)}</strong>
                    <span className={styles.drawDate}>{now !== null && !open ? "Cerrado" : formatDrawDate(draw.drawsAt)}</span>
                  </label>;
                })}
              </div>
            </fieldset>
            {!loading && remoteGame && now !== null && !drawsOpen ? <div className={styles.inlineWarning} role="status">
              {selectedIds.length === 0 ? "Seleccioná al menos un sorteo." : "Hay sorteos cerrados o no disponibles en tu selección."}
              {selectedIds.length > 0 ?
                <button className={styles.textButton} type="button" disabled={fieldsDisabled} onClick={removeClosedDraws}>Quitar cerrados</button> :
                <button className={styles.textButton} type="button" disabled={fieldsDisabled} onClick={() => void refresh()}>Actualizar sorteos</button>}
            </div> : null}
          </section>

          <section className={styles.stepCard} aria-labelledby="number-step-title">
            <StepHeading number="2" id="number-step-title" title={game.id === "redoblona" ? "Números" : "Número"} />
            <fieldset className={styles.fieldset} disabled={fieldsDisabled}>
              <legend className="q-sr-only">Números de la jugada</legend>
              {game.id === "redoblona" && redoblonaRanges ? <RedoblonaFields
                draft={draft}
                ranges={redoblonaRanges}
                errors={{
                  initialNumber: touched.initialNumber ? draftErrors.initialNumber : undefined,
                  initialUntil: draftErrors.initialUntil,
                  redoblonaNumber: touched.redoblonaNumber ? draftErrors.redoblonaNumber : undefined,
                  redoblonaUntil: draftErrors.redoblonaUntil,
                }}
                onInitialNumber={(value) => updateDraft("initialNumber", value)}
                onInitialBlur={() => setTouched((current) => ({ ...current, initialNumber: true }))}
                onInitialUntil={updateInitialUntil}
                onRedoblonaNumber={(value) => updateDraft("redoblonaNumber", value)}
                onRedoblonaBlur={() => setTouched((current) => ({ ...current, redoblonaNumber: true }))}
                onRedoblonaUntil={(value) => updateDraft("redoblonaUntil", value)}
              /> : <div className={styles.numberPanel}>
                <div className={styles.singleNumber}><NumberField id="traditional-number" label="Número de tres cifras" hideLabel accessibleLabel="Número de tres cifras" digits={3} value={draft.number} error={touched.number ? draftErrors.number : undefined} onChange={(value) => updateDraft("number", value)} onBlur={() => setTouched((current) => ({ ...current, number: true }))} /></div>
                {game.id !== "head" && remoteGame && positionRange ? <PositionField definition={remoteGame} value={draft.position} onChange={(value) => updateDraft("position", value)} error={draftErrors.position} /> : <div className={styles.positionNote}><Icon name="head" size={17} /><span>A la <strong>1.ª posición</strong></span></div>}
              </div>}
              <div className={styles.randomAction}>
                <button className={styles.randomButton} aria-label="Números aleatorios" disabled={fieldsDisabled} onClick={randomize} type="button"><ShuffleIcon />Al azar</button>
              </div>
              <span className="q-sr-only" role="status">{randomAnnouncement}</span>
            </fieldset>
          </section>

          <section className={styles.stepCard} aria-labelledby="amount-step-title">
            <div className={styles.amountHeading}>
              <StepHeading number="3" id="amount-step-title" title="Importe" />
              <div className={styles.amountValue}>
                <output aria-label="Importe por sorteo" aria-live="polite" aria-atomic="true" data-testid="traditional-stake">{formatGs(effectiveAmount)}</output>
                <small>Máx. {formatGs(TRADITIONAL_MAX_STAKE_PER_DRAW)} por sorteo</small>
              </div>
              <button className={styles.clearAmount} type="button" aria-label="Borrar importe" disabled={fieldsDisabled || amount === 0} onClick={clearAmount}>Borrar</button>
            </div>
            <fieldset className={styles.fieldset} disabled={fieldsDisabled}>
              <legend className="q-sr-only">Importe por sorteo</legend>
              <div className={styles.amountGrid}>
                {availableAmounts.map((value) => <div key={value} className={styles.amountOption}>
                  <AmountChip value={value} selected={false} additive disabled={effectiveAmount + value > TRADITIONAL_MAX_STAKE_PER_DRAW} onSelect={addAmount} />
                  <span className={styles.amountLabel} aria-hidden="true">{new Intl.NumberFormat("es-PY").format(value)}</span>
                </div>)}
              </div>
            </fieldset>
            {insufficientBalance && session && !review && !accepted ? <div className={styles.inlineWarning} role="status"><Icon name="warning" size={18} /><span>Saldo insuficiente. Te faltan <strong>{formatGs(total - session.balance)}</strong>.{walletAvailable ? <> <Link href="/saldos">Recargar saldo</Link></> : null}</span></div> : null}
          </section>
        </div>
        <div className={styles.checkoutAction}>
          <div className={styles.total}><span>{accepted ? "Pago confirmado" : "Total a pagar"}</span><strong data-testid="traditional-total">{formatGs(accepted ? acceptedAmount : total)}</strong>
            {!accepted ? game.id === "redoblona" ? <RedoblonaLiveSummary draft={draft} /> : <small>{selectedDraws.length + (selectedDraws.length === 1 ? " sorteo × " : " sorteos × ") + formatGs(effectiveAmount)}</small> : null}
          </div>
          {accepted ? <button className={styles.payButton} onClick={newPlay} type="button">Nueva jugada<Icon name="plus" size={18} /></button> :
            <button className={styles.payButton} type="submit" disabled={pending || reviewOpen || (!review && !canReview)}><span>{review ? "Revisar pendientes" : "Revisar y pagar"}</span><Icon name="chevronRight" size={18} /></button>}
        </div>
      </form>

      <Modal open={Boolean(review) && reviewOpen} onOpenChange={(open) => { if (!open) closeReview(); }} title="Confirmá tu jugada" description="Resumen de los sorteos elegidos. El pago se realiza con tu saldo." size="sm" closeOnBackdrop={!pending} initialFocusRef={editButton}
        footer={<div className={styles.modalActions}>
          <button ref={editButton} className={styles.editButton} onClick={closeReview} disabled={pending} type="button">{reviewCanEdit ? "Volver a editar" : "Cerrar"}</button>
          <button className={styles.payButton} disabled={!canPayReview} type="button" onClick={() => void submitPayment()}>
            {pending ? <><span className={styles.spinner} />Procesando pago…</> : <><Icon name="wallet" size={18} />{hasUnconfirmed ? "Reintentar pendientes" : (paidEntries.length ? "Pagar pendientes " : "Pagar ") + formatGs(remainingTotal)}</>}
          </button>
        </div>}>
        {review ? <div className={styles.confirmation} aria-busy={pending}>
          <div className={styles.confirmGame}><GameIcon gameId={game.id} className={styles.ticketGameIcon} /><strong>{displayName}</strong></div>
          <SelectionPreview gameId={game.id} draft={review.draft} />
          <ul className={styles.reviewDraws} aria-label="Sorteos de la jugada">
            {review.entries.map((entry) => <li key={entry.draw.id}>
              <div><strong>{formatDrawName(entry.draw)}</strong><span>{formatDrawDate(entry.draw.drawsAt) + " · " + formatDrawTime(entry.draw.drawsAt)}</span></div>
              <span className={styles.drawStatus} data-state={entry.state}>{entry.state === "accepted" ? <><Icon name="check" size={14} />Registrado</> : entry.state === "unconfirmed" ? "Por confirmar" : formatGs(entry.command.input.amount)}</span>
            </li>)}
          </ul>
          <dl className={styles.summaryDetails}>
            {game.id === "redoblona" ? <div><dt>Alcances</dt><dd>{formatRedoblonaScopes(review.draft)}</dd></div> : <div><dt>Posición</dt><dd>{getTraditionalPositionLabel(game.id, review.draft.position)}</dd></div>}
            <div><dt>Por sorteo</dt><dd>{formatGs(review.entries[0]?.command.input.amount ?? 0)}</dd></div>
            <div><dt>{paidEntries.length ? "Total seleccionado" : "Total a pagar"}</dt><dd className={styles.confirmTotal}>{formatGs(reviewTotal)}</dd></div>
            {paidEntries.length ? <><div><dt>Ya registrado</dt><dd>{formatGs(paidTotal)}</dd></div><div><dt>Pendiente de confirmar</dt><dd>{formatGs(remainingTotal)}</dd></div></> : null}
          </dl>
          <div className={styles.balanceBreakdown}>
            <div><span>Saldo disponible</span><strong>{session?.id === review.sessionId ? formatGs(session.balance) : "—"}</strong></div>
            {!hasUnconfirmed && session?.id === review.sessionId ? <div><span>Saldo estimado después</span><strong>{session.balance >= remainingTotal ? formatGs(session.balance - remainingTotal) : "—"}</strong></div> : null}
          </div>
          {paidEntries.length ? <p className={styles.batchProgress} role="status">{paidEntries.length + " de " + review.entries.length + " sorteos registrados. No se volverán a cobrar."}</p> : null}
          <p className={styles.paymentNote}>{hasUnconfirmed ? "Hay un pago por confirmar. El reintento usa la misma referencia; no crees otra jugada para reemplazarlo." : "Se descontará " + formatGs(remainingTotal) + " de tu saldo al confirmar."}
            {review.entries.length > 1 ? " Cada sorteo genera su propia jugada." : ""}</p>
          {!reviewStillValid ? <div className={styles.errorNotice} role="alert">Cambió la disponibilidad de los sorteos o de la jugada. {reviewCanEdit ? "Volvé a editar y revisá los datos." : "Consultá Mis jugadas; no reenviaremos pagos a otra fecha."}</div> : null}
          {reviewInsufficient ? <div className={styles.errorNotice} role="alert">Tu saldo ya no alcanza para los sorteos pendientes.{reviewCanEdit ? " Volvé a editar el importe." : ""}</div> : null}
          {error ? <div className={styles.errorNotice} role="alert"><p>{error}</p><Link href="/mis-jugadas">Revisar Mis jugadas</Link></div> : null}
          {!error && !reviewStillValid && !reviewCanEdit ? <Link className={styles.textButton} href="/mis-jugadas">Revisar Mis jugadas</Link> : null}
          {paymentInfo ? <div className={styles.pendingNotice} role="status"><p>{paymentInfo}</p><button className={styles.textButton} disabled={refreshingBalance || pending} type="button" onClick={() => void updateReviewedBalance()}>{refreshingBalance ? "Actualizando saldo…" : "Actualizar saldo"}</button></div> : null}
          {paidEntries.length > 0 && !hasUnconfirmed && !pending ? <button className={styles.textButton} type="button" onClick={finishRegistered}>Terminar con las jugadas registradas</button> : null}
          {pending ? <p className={styles.pendingNotice} role="status">Confirmando sorteos… {paidEntries.length + " de " + review.entries.length}</p> : null}
        </div> : null}
      </Modal>
      <Modal open={showSuccess && Boolean(accepted)} onOpenChange={setShowSuccess} title={acceptedCount > 1 ? "Jugadas registradas" : "Jugada registrada"} description="Podés consultar cada comprobante en Mis jugadas." size="sm"
        footer={<div className={styles.modalActions}><button className={styles.editButton} onClick={newPlay} type="button">Nueva jugada</button><Link className={styles.payButton} href="/mis-jugadas">Ver en Mis jugadas<Icon name="chevronRight" size={17} /></Link></div>}>
        {accepted ? <div className={styles.successBody}><span className={styles.successMark}><Icon name="check" size={32} /></span>
          <p>{acceptedReplayed ? "Pagos confirmados. Las jugadas ya registradas no se volvieron a cobrar." : acceptedCount > 1 ? acceptedCount + " sorteos pagados con tu saldo" : "Pago confirmado con tu saldo"}</p>
          {accepted.skipped ? <p>{accepted.skipped + (accepted.skipped === 1 ? " sorteo pendiente no se cobró." : " sorteos pendientes no se cobraron.")}</p> : null}
          <strong className={styles.successAmount}>{formatGs(acceptedAmount)}</strong>
          <div className={styles.successBalance}><span>{acceptedReplayed ? "Saldo disponible" : "Saldo actualizado"}</span><strong>{session?.id === accepted.sessionId ? formatGs(session.balance) : "—"}</strong></div>
        </div> : null}
      </Modal>
    </main>
  );
}

function StepHeading({ number, id, title }: { number: string; id: string; title: string }) {
  return <div className={styles.stepHeading}><span className={styles.stepNumber} aria-hidden="true">{number}</span><div><h2 id={id}>{title}</h2></div></div>;
}

function NumberField({ id, label, hideLabel = false, accessibleLabel, digits, value, error, onChange, onBlur }: {
  id: string; label: string; hideLabel?: boolean; accessibleLabel: string; digits: number; value: string; error?: string; onChange: (value: string) => void; onBlur: () => void;
}) {
  return <div className={styles.numberField}><label htmlFor={id} className={hideLabel ? "q-sr-only" : undefined}>{label}</label>
    <input id={id} aria-label={accessibleLabel} className={styles.numberInput} type="text" inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={digits} placeholder={digits === 3 ? "123" : "12"} value={value} aria-invalid={Boolean(error)} aria-describedby={id + "-hint" + (error ? " " + id + "-error" : "")}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, digits))} onBlur={(event) => { onChange(normalizeTraditionalNumber(event.target.value, digits)); onBlur(); }} />
    <span className="q-sr-only" id={id + "-hint"}>{digits === 3 ? "Del 001 al 999" : "Del 00 al 99"}</span>{error ? <span id={id + "-error"} className={styles.fieldError}>{error}</span> : null}
  </div>;
}

type RedoblonaRanges = NonNullable<ReturnType<typeof getRedoblonaRanges>>;

function redoblonaSelectionFromDraft(draft: TraditionalDraft): RedoblonaSelection {
  return {
    initialNumber: normalizeTraditionalNumber(draft.initialNumber, 2),
    initialUntil: draft.initialUntil,
    redoblonaNumber: normalizeTraditionalNumber(draft.redoblonaNumber, 2),
    redoblonaUntil: draft.redoblonaUntil,
  };
}

function formatRedoblonaSummary(draft: TraditionalDraft) {
  const selection = redoblonaSelectionFromDraft(draft);
  return Object.keys(validateRedoblonaSelection(selection)).length === 0
    ? summarizeRedoblonaSelection(selection)
    : `${selection.initialNumber || "— —"} ${draft.initialUntil === 1 ? "Cabeza" : `hasta ${draft.initialUntil}`} + ${selection.redoblonaNumber || "— —"} hasta ${draft.redoblonaUntil}`;
}

function formatRedoblonaScopes(draft: TraditionalDraft) {
  return `${draft.initialUntil === 1 ? "Cabeza" : `Inicial hasta ${draft.initialUntil}`} · Redoblona hasta ${draft.redoblonaUntil}`;
}

function TwoDigitField({ id, label, accessibleLabel, value, error, onChange, onBlur }: {
  id: string;
  label: string;
  accessibleLabel: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const description = id + "-hint" + (error ? " " + id + "-error" : "");
  return <div className={styles.redoblonaNumberField}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.digitCells} data-invalid={Boolean(error)}>
      <input id={id} aria-label={accessibleLabel} type="text" inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={2} value={value} aria-invalid={Boolean(error)} aria-describedby={description}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={(event) => { onChange(normalizeTraditionalNumber(event.target.value, 2)); onBlur(); }} />
      <span aria-hidden="true">{value[0] ?? "–"}</span><span aria-hidden="true">{value[1] ?? "–"}</span>
    </div>
    <span className="q-sr-only" id={id + "-hint"}>Dos cifras, del 00 al 99</span>
    {error ? <span id={id + "-error"} className={styles.fieldError}>{error}</span> : null}
  </div>;
}

function RedoblonaUntilField({ id, label, value, min, max, initial = false, onChange, error }: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  initial?: boolean;
  onChange: (value: number) => void;
  error?: string;
}) {
  const positions = Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => index + min);
  return <div className={styles.redoblonaUntilField}>
    <label htmlFor={id}>Hasta qué postura</label>
    <select id={id} aria-label={label} value={positions.includes(value) ? value : ""} aria-invalid={Boolean(error)} aria-describedby={error ? id + "-error" : undefined} onChange={(event) => onChange(Number(event.target.value))}>
      {!positions.includes(value) ? <option value="" disabled>Elegir</option> : null}
      {positions.map((position) => <option key={position} value={position}>{initial && position === 1 ? "Cabeza · 1" : `Hasta ${position}`}</option>)}
    </select>
    {error ? <span id={id + "-error"} className={styles.fieldError}>{error}</span> : null}
  </div>;
}

function RedoblonaFields({ draft, ranges, errors, onInitialNumber, onInitialBlur, onInitialUntil, onRedoblonaNumber, onRedoblonaBlur, onRedoblonaUntil }: {
  draft: TraditionalDraft;
  ranges: RedoblonaRanges;
  errors: Partial<Record<"initialNumber" | "initialUntil" | "redoblonaNumber" | "redoblonaUntil", string>>;
  onInitialNumber: (value: string) => void;
  onInitialBlur: () => void;
  onInitialUntil: (value: number) => void;
  onRedoblonaNumber: (value: string) => void;
  onRedoblonaBlur: () => void;
  onRedoblonaUntil: (value: number) => void;
}) {
  return <div className={styles.redoblonaBuilder}>
    <section className={styles.redoblonaPart} role="group" aria-labelledby="initial-part-title">
      <header><span aria-hidden="true">1</span><div><h3 id="initial-part-title">Apuesta inicial</h3><p>Busca el primer número en este alcance.</p></div></header>
      <div className={styles.redoblonaControls}>
        <TwoDigitField id="redoblona-initial-number" label="Número" accessibleLabel="Número de apuesta inicial" value={draft.initialNumber} error={errors.initialNumber} onChange={onInitialNumber} onBlur={onInitialBlur} />
        <RedoblonaUntilField id="redoblona-initial-until" label="Alcance de apuesta inicial" value={draft.initialUntil} min={ranges.initialUntil.min} max={ranges.initialUntil.max} initial onChange={onInitialUntil} error={errors.initialUntil} />
      </div>
    </section>
    <div className={styles.redoblonaConnector} aria-hidden="true"><span>+</span></div>
    <section className={styles.redoblonaPart} role="group" aria-labelledby="redoblona-part-title">
      <header><span aria-hidden="true">2</span><div><h3 id="redoblona-part-title">Redoblona</h3><p>{draft.initialUntil === 1 ? `Busca desde la 2.ª hasta la ${draft.redoblonaUntil + 1}.ª.` : "Busca el segundo número en otra posición."}</p></div></header>
      <div className={styles.redoblonaControls}>
        <TwoDigitField id="redoblona-second-number" label="Número" accessibleLabel="Número de Redoblona" value={draft.redoblonaNumber} error={errors.redoblonaNumber} onChange={onRedoblonaNumber} onBlur={onRedoblonaBlur} />
        <RedoblonaUntilField id="redoblona-until" label="Alcance de Redoblona" value={draft.redoblonaUntil} min={Math.max(ranges.redoblonaUntil.min, draft.initialUntil)} max={ranges.redoblonaUntil.max} onChange={onRedoblonaUntil} error={errors.redoblonaUntil} />
      </div>
    </section>
  </div>;
}

function RedoblonaLiveSummary({ draft }: { draft: TraditionalDraft }) {
  return <output className={styles.redoblonaSummary} aria-label="Resumen de Redoblona" aria-live="polite" aria-atomic="true">
    {formatRedoblonaSummary(draft)}
  </output>;
}

function PositionField({ definition, value, onChange, error }: {
  definition: TraditionalGameDefinition; value: number; onChange: (value: number) => void; error?: string;
}) {
  const range = getTraditionalPositionRange(definition);
  if (!range) return null;
  const positions = Array.from({ length: Math.max(0, range.max - range.min + 1) }, (_, index) => index + range.min);
  return <div className={styles.positionField}><div className={styles.positionLabel}><label htmlFor="position">Hasta</label></div>
    <div className={styles.positionControls}><select id="position" aria-label="Hasta la posición" value={positions.includes(value) ? value : ""} aria-invalid={Boolean(error)} aria-describedby={error ? "position-error" : undefined} onChange={(event) => onChange(Number(event.target.value))}>
      {!positions.includes(value) ? <option value="" disabled>Elegir</option> : null}{positions.map((position) => <option key={position} value={position}>{position + ".ª"}</option>)}
    </select></div>
    {error ? <span id="position-error" className={styles.fieldError}>{error}</span> : null}
  </div>;
}

function SelectionPreview({ gameId, draft }: { gameId: TraditionalGameId; draft: TraditionalDraft }) {
  if (gameId === "redoblona") {
    const selection = redoblonaSelectionFromDraft(draft);
    return <div className={styles.selectionPreview} aria-label={formatRedoblonaSummary(draft)}>
      <div><span>Apuesta inicial</span><strong>{selection.initialNumber || "— —"}</strong><small>{draft.initialUntil === 1 ? "Cabeza" : `Hasta ${draft.initialUntil}`}</small></div>
      <span className={styles.previewPlus} aria-hidden="true">+</span>
      <div><span>Redoblona</span><strong>{selection.redoblonaNumber || "— —"}</strong><small>Hasta {draft.redoblonaUntil}</small></div>
      <p className={styles.selectionSentence}>{formatRedoblonaSummary(draft)}</p>
    </div>;
  }
  const first = normalizeTraditionalNumber(draft.number, 3);
  return <div className={styles.selectionPreview} aria-label="Número seleccionado"><div><span>Tu número</span><strong>{first || "— — —"}</strong></div></div>;
}

function ShuffleIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m17 3 4 4-4 4M17 13l4 4-4 4M3 7h3c4 0 8 10 12 10h3M3 17h3c1.5 0 3-1.5 4.5-3.5M14 10c1.5-2 2.5-3 4-3h3" /></svg>;
}
