"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import type { TraditionalPlayRequest } from "@/lib/gaming/schemas";
import type { DrawDefinition, TraditionalGameDefinition } from "@/lib/gaming/types";
import { TRADITIONAL_GAMES, type ProductGame, type TraditionalGameId, formatGs } from "@/lib/product/catalog";
import { publicProductErrorMessage } from "@/lib/product/public-error";
import { useProduct } from "@/providers/product-provider";
import { AmountChip } from "./amount-chip";
import { DrawIcon } from "./draw-icon";
import { GameIcon } from "./game-icon";
import {
  buildTraditionalPlayInput, createTraditionalDraft, getTraditionalPositionLabel,
  getTraditionalPositionRange, normalizeTraditionalNumber, randomizeTraditionalDraft,
  validateTraditionalDraft, type TraditionalDraft,
} from "./traditional-game-form";
import { useDrawClock } from "./use-draw-clock";
import { useSoundEffects } from "./use-sound-effects";
import styles from "./traditional-game.module.css";

type Review = { input: TraditionalPlayRequest; draft: TraditionalDraft; draw: DrawDefinition; sessionId: string };
type AcceptedPayment = { id: string; amount: number; replayed: boolean };

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

// Called only by submit handlers: recheck the cutoff even between clock ticks.
function isDrawOpenAtSubmission(draw: DrawDefinition) {
  return isDrawOpen(draw, Date.now());
}

export function TraditionalGameClient({ game }: { game: ProductGame<TraditionalGameId> }) {
  // Each modality owns a separate draft, including during client navigation.
  return <TraditionalBetForm game={game} key={game.id} />;
}

function TraditionalBetForm({ game }: { game: ProductGame<TraditionalGameId> }) {
  const { requestPlay, catalog, session, loading, unauthorized, error: gatewayError, refresh, walletAvailable } = useProduct();
  const { now, openedAt } = useDrawClock();
  const [draft, setDraft] = useState(() => createTraditionalDraft(game.id));
  const [touched, setTouched] = useState<Partial<Record<keyof TraditionalDraft, boolean>>>({});
  const [drawId, setDrawId] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<AcceptedPayment | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [randomAnnouncement, setRandomAnnouncement] = useState("");
  const paymentLock = useRef(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const playSound = useSoundEffects();

  const remoteGame = catalog?.traditional.find((definition) => definition.id === game.id);
  const displayName = remoteGame?.name ?? game.name;
  const availableAmounts = (catalog?.amounts ?? []).filter((value) => Number.isSafeInteger(value) && value > 0);
  const availableDraws = useMemo(() => {
    if (!catalog || !remoteGame) return [];
    const allowed = new Set(remoteGame.drawIds);
    return catalog.draws.filter((draw) => allowed.has(draw.id));
  }, [catalog, remoteGame]);
  const effectiveAmount = amount !== null && availableAmounts.includes(amount) ? amount : (availableAmounts[0] ?? 0);
  // Keep the initial draw at its cutoff: never silently move a bet to another draw.
  const initialDraw = availableDraws.filter((draw) => isDrawOpen(draw, openedAt))
    .sort((first, second) => Date.parse(first.drawsAt) - Date.parse(second.drawsAt))[0];
  const effectiveDrawId = drawId || initialDraw?.id || "";
  const selectedDraw = availableDraws.find((draw) => draw.id === effectiveDrawId);
  const selectedDrawOpen = Boolean(selectedDraw && isDrawOpen(selectedDraw, now));
  const draftErrors = remoteGame ? validateTraditionalDraft(game.id, draft, remoteGame) : {};
  const validSelection = Boolean(remoteGame) && Object.keys(draftErrors).length === 0;
  const insufficientBalance = Boolean(session && session.balance < effectiveAmount);
  const estimatedBalance = session ? session.balance - effectiveAmount : null;
  const canReview = !loading && !gatewayError && !unauthorized && Boolean(session) && Boolean(remoteGame) &&
    validSelection && selectedDrawOpen && effectiveAmount > 0 && !insufficientBalance && !pending && !accepted;
  const fieldsDisabled = loading || !remoteGame || pending || Boolean(accepted) || Boolean(review);
  const positionRange = remoteGame ? getTraditionalPositionRange(remoteGame) : null;
  const reviewedDraw = review ? availableDraws.find((draw) => draw.id === review.draw.id) : null;
  const reviewStillValid = Boolean(review && session?.id === review.sessionId && remoteGame &&
    availableAmounts.includes(review.input.amount) && reviewedDraw &&
    reviewedDraw.closesAt === review.draw.closesAt && reviewedDraw.drawsAt === review.draw.drawsAt &&
    isDrawOpen(reviewedDraw, now) && Object.keys(validateTraditionalDraft(game.id, review.draft, remoteGame)).length === 0);
  const reviewInsufficient = Boolean(review && session && session.balance < review.input.amount);
  const canPayReview = reviewStillValid && !reviewInsufficient && !loading && !gatewayError && !unauthorized && !pending && !accepted;

  function updateDraft(key: keyof TraditionalDraft, value: string | number) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
    setRandomAnnouncement("");
  }

  function randomize() {
    if (fieldsDisabled) return;
    const next = randomizeTraditionalDraft(game.id, draft);
    setDraft(next);
    setTouched({});
    setError(null);
    setRandomAnnouncement(game.id === "redoblona" ? `Números elegidos: ${next.head} y ${next.redoblona}.` : `Número elegido: ${next.number}.`);
  }

  function openReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReview || !selectedDraw || !session || !isDrawOpenAtSubmission(selectedDraw)) return;
    setError(null);
    setReview({ input: buildTraditionalPlayInput(game.id, effectiveAmount, effectiveDrawId, draft), draft: { ...draft }, draw: { ...selectedDraw }, sessionId: session.id });
  }

  async function submitPayment() {
    if (paymentLock.current || !review || !canPayReview || !reviewedDraw || !isDrawOpenAtSubmission(reviewedDraw)) return;
    paymentLock.current = true;
    setPending(true);
    setError(null);
    try {
      const data = await requestPlay({ kind: "traditional", input: review.input });
      setAccepted({ id: data.play.id, amount: data.play.amount, replayed: data.replayed });
      setReview(null);
      setShowSuccess(true);
      playSound("confirm");
    } catch (reason) {
      setError(publicProductErrorMessage(reason, "No pudimos confirmar el pago. Revisá Mis jugadas antes de crear otra jugada."));
    } finally {
      paymentLock.current = false;
      setPending(false);
    }
  }

  function closeReview() {
    if (paymentLock.current) return;
    setReview(null);
    setError(null);
  }

  function newPlay() {
    setAccepted(null);
    setShowSuccess(false);
    setReview(null);
    setError(null);
    setTouched({});
    setDraft(createTraditionalDraft(game.id));
    setRandomAnnouncement("");
    formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  return (
    <main className={styles.page} data-game={game.id}>
      <div className={styles.breadcrumb}>
        <Link href="/quinielas"><Icon name="arrowLeft" size={16} />Quinielas</Link><span aria-hidden="true">/</span><span>{displayName}</span>
        <Link className={styles.rulesLink} href="/reglas"><Icon name="rules" size={16} />Cómo jugar</Link>
      </div>
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}><GameIcon gameId={game.id} className={styles.heroIcon} />
          <div><p className={styles.eyebrow}>Quiniela tradicional</p><h1>{displayName}</h1><p className={styles.intro}>Elegí tus números y pagá con tu saldo.</p></div>
        </div>
        <div className={styles.wallet}>
          <span className={styles.walletIcon}><Icon name="wallet" size={22} /></span>
          <div><span>Saldo disponible</span><strong data-testid="traditional-balance">{session ? formatGs(session.balance) : "—"}</strong></div>
          {walletAvailable ? <Link href="/saldos" aria-label="Recargar saldo" className={styles.walletAdd}><Icon name="plus" size={18} /></Link> : null}
        </div>
      </header>
      <nav className={styles.gameNav} aria-label="Modalidades de quiniela">
        {TRADITIONAL_GAMES.filter((item) => !catalog || catalog.traditional.some((definition) => definition.id === item.id)).map((item) => (
          <Link key={item.id} href={`/quinielas/${item.id}`} aria-current={item.id === game.id ? "page" : undefined} aria-disabled={pending || undefined}
            onClick={(event) => { if (paymentLock.current) event.preventDefault(); }}>
            <GameIcon gameId={item.id} className={styles.navIcon} /><span>{catalog?.traditional.find((definition) => definition.id === item.id)?.name ?? item.name}</span>
          </Link>
        ))}
      </nav>
      {loading ? <div className={styles.notice} role="status">Cargando sorteos y saldo…</div> : null}
      {!loading && catalog && !remoteGame ? <div className={styles.errorNotice} role="alert">Este juego no está disponible en este momento. <Link href="/quinielas">Ver otras modalidades</Link></div> : null}
      {gatewayError ? <div className={styles.errorNotice} role="alert"><p>{gatewayError}</p><button type="button" className={styles.textButton} onClick={() => void refresh()}>Reintentar conexión</button></div> : null}
      {!gatewayError && (unauthorized || (!loading && !session)) ? <div className={styles.notice} role="alert">Iniciá sesión para pagar con tu saldo. <Link href="/cuenta">Ir a Cuenta<Icon name="chevronRight" size={14} /></Link></div> : null}

      <form className={styles.layout} onSubmit={openReview} ref={formRef} noValidate aria-label="Preparar jugada">
        <div className={styles.steps}>
          <section className={styles.stepCard} aria-labelledby="draw-step-title">
            <StepHeading number="01" id="draw-step-title" title="Elegí tu sorteo" detail="Fecha y hora de Paraguay" />
            <fieldset className={styles.fieldset} disabled={fieldsDisabled}>
              <legend className="q-sr-only">Sorteo</legend>
              <div className={styles.drawGrid}>
                {availableDraws.map((draw) => {
                  const open = isDrawOpen(draw, now);
                  const selected = draw.id === effectiveDrawId;
                  return <label className={styles.drawOption} key={draw.id} data-selected={selected} data-closed={!open}>
                    <input type="radio" name="traditional-draw" value={draw.id} checked={selected} disabled={!open} aria-label={`${formatDrawName(draw)} · ${formatDrawTime(draw.drawsAt)} · ${formatDrawDate(draw.drawsAt)}`} onChange={() => { setDrawId(draw.id); setError(null); }} />
                    <span className={styles.drawOptionTop} aria-hidden="true"><DrawIcon drawId={draw.id} label={draw.label} size="sm" /><span className={styles.radioMark}>{selected ? <Icon name="check" size={12} /> : null}</span></span>
                    <span className={styles.drawName}>{formatDrawName(draw)}</span><strong className={styles.drawTime}>{formatDrawTime(draw.drawsAt)}</strong>
                    <span className={styles.drawDate}>{formatDrawDate(draw.drawsAt)}{now !== null && !open ? " · Cerrado" : ""}</span>
                  </label>;
                })}
              </div>
            </fieldset>
            {selectedDrawOpen && selectedDraw ? <p className={styles.drawHint}><span className={styles.liveDot} />Cierre de apuestas a las {formatDrawTime(selectedDraw.closesAt)} · {formatDrawDate(selectedDraw.closesAt)}</p> : null}
            {!loading && remoteGame && now !== null && !selectedDrawOpen ? <div className={styles.inlineWarning} role="status">{selectedDraw ? "Este sorteo ya cerró. Elegí otro para continuar." : "No hay un sorteo abierto seleccionado."} <button className={styles.textButton} type="button" disabled={pending} onClick={() => void refresh()}>Actualizar sorteos</button></div> : null}
          </section>

          <section className={styles.stepCard} aria-labelledby="number-step-title">
            <StepHeading number="02" id="number-step-title" title={game.id === "redoblona" ? "Elegí tus números" : "Elegí tu número"} detail={game.id === "redoblona" ? "Una cabeza + una terminación" : "Escribilo o probá una selección al azar"} />
            <fieldset className={styles.fieldset} disabled={fieldsDisabled}>
              <legend className="q-sr-only">Números de la jugada</legend>
              <div className={styles.numberPanel}>
                <div className={game.id === "redoblona" ? styles.doubleNumbers : styles.singleNumber}>
                  {game.id === "redoblona" ? <>
                    <NumberField id="head-number" label="Número de cabeza" digits={3} value={draft.head} error={touched.head ? draftErrors.head : undefined} onChange={(value) => updateDraft("head", value)} onBlur={() => setTouched((current) => ({ ...current, head: true }))} />
                    <span className={styles.numberConnector} aria-hidden="true">+</span>
                    <NumberField id="double-number" label="Número redoblona" digits={2} value={draft.redoblona} error={touched.redoblona ? draftErrors.redoblona : undefined} onChange={(value) => updateDraft("redoblona", value)} onBlur={() => setTouched((current) => ({ ...current, redoblona: true }))} />
                  </> : <NumberField id="traditional-number" label="Número de tres cifras" digits={3} value={draft.number} error={touched.number ? draftErrors.number : undefined} onChange={(value) => updateDraft("number", value)} onBlur={() => setTouched((current) => ({ ...current, number: true }))} />}
                </div>
                <button className={styles.randomButton} onClick={randomize} type="button"><ShuffleIcon />Números aleatorios</button>
                <p className={styles.randomHint}>Podés cambiarlos antes de pagar. Elegir números no consume saldo.</p>
                <span className="q-sr-only" role="status">{randomAnnouncement}</span>
              </div>
              {game.id !== "head" && remoteGame && positionRange ? <PositionField gameId={game.id} definition={remoteGame} value={draft.position} onChange={(value) => updateDraft("position", value)} error={draftErrors.position} /> : <div className={styles.positionNote}><Icon name="head" size={17} /><span>Tu número juega en la <strong>1.ª posición</strong>.</span></div>}
              {game.id === "invert" && draft.number ? <p className={styles.invertHint}>Tus cifras: <strong>{normalizeTraditionalNumber(draft.number, 3).split("").join(" · ")}</strong></p> : null}
            </fieldset>
          </section>

          <section className={styles.stepCard} aria-labelledby="amount-step-title">
            <StepHeading number="03" id="amount-step-title" title="Elegí el importe" detail="Un único pago por esta jugada" />
            <fieldset className={styles.fieldset} disabled={fieldsDisabled}>
              <legend className="q-sr-only">Importe de la jugada</legend>
              <div className={styles.amountGrid}>
                {availableAmounts.map((value) => <div key={value} className={styles.amountOption} data-selected={value === effectiveAmount}>
                  <AmountChip value={value} selected={effectiveAmount === value} onSelect={(next) => { setAmount(next); setError(null); }} /><span aria-hidden="true">{formatGs(value)}</span>
                </div>)}
              </div>
            </fieldset>
            <div className={styles.selectedAmount}><span>Importe seleccionado</span><strong>{effectiveAmount ? formatGs(effectiveAmount) : "—"}</strong></div>
            {insufficientBalance && session ? <div className={styles.inlineWarning} role="status"><Icon name="warning" size={18} /><span>Saldo insuficiente. Te faltan <strong>{formatGs(effectiveAmount - session.balance)}</strong>.{walletAvailable ? <> <Link href="/saldos">Recargar saldo</Link></> : null}</span></div> : null}
          </section>
        </div>

        <aside className={styles.summary} aria-label="Resumen de jugada">
          <div className={styles.summaryHeader}><span className={styles.ticketIcon}><Icon name="ticket" size={22} /></span><div><p className={styles.eyebrow}>Antes de pagar</p><h2>Resumen de jugada</h2></div></div>
          <div className={styles.ticketBody}>
            <div className={styles.ticketGame}><GameIcon gameId={game.id} className={styles.ticketGameIcon} /><strong>{displayName}</strong></div>
            <SelectionPreview gameId={game.id} draft={draft} />
            <dl className={styles.summaryDetails}>
              <div><dt>Sorteo</dt><dd>{selectedDraw ? formatDrawName(selectedDraw) : "Por elegir"}</dd></div>
              {selectedDraw ? <div><dt>Fecha y hora</dt><dd>{formatDrawDate(selectedDraw.drawsAt)} · {formatDrawTime(selectedDraw.drawsAt)}</dd></div> : null}
              <div><dt>Posición</dt><dd>{getTraditionalPositionLabel(game.id, draft.position)}</dd></div>
              <div><dt>Medio de pago</dt><dd><Icon name="wallet" size={15} />Tu saldo</dd></div>
            </dl>
            <div className={styles.balanceBreakdown}>
              <div><span>Saldo actual</span><strong>{session ? formatGs(session.balance) : "—"}</strong></div>
              {!accepted ? <div data-insufficient={insufficientBalance}><span>Saldo estimado después</span><strong>{estimatedBalance !== null && estimatedBalance >= 0 ? formatGs(estimatedBalance) : "—"}</strong></div> : null}
            </div>
            {accepted ? <div className={styles.successInline} role="status"><Icon name="check" size={19} /><div><strong>Jugada registrada</strong><Link href="/mis-jugadas">Ver en Mis jugadas<Icon name="chevronRight" size={13} /></Link></div></div> : <p className={styles.paymentNote}><Icon name="info" size={15} />El importe se descuenta de tu saldo únicamente al confirmar el pago.</p>}
          </div>
          <div className={styles.checkoutAction}>
            <div className={styles.total}><span>{accepted ? "Pago confirmado" : "Total a pagar"}</span><strong>{formatGs(accepted?.amount ?? effectiveAmount)}</strong></div>
            {accepted ? <button className={styles.payButton} onClick={newPlay} type="button">Nueva jugada<Icon name="plus" size={18} /></button> : <button className={styles.payButton} type="submit" disabled={!canReview || Boolean(review)}><span>Revisar y pagar</span><Icon name="chevronRight" size={18} /></button>}
            <span className={styles.checkoutHint}>{accepted ? "Tu comprobante está en Mis jugadas." : !validSelection ? "Elegí tus números para continuar." : "Vas a revisar los datos antes de confirmar."}</span>
          </div>
          <p className={styles.responsibleNote}>Solo mayores de 18 años. Jugá con responsabilidad.</p>
        </aside>
      </form>

      <Modal open={Boolean(review)} onOpenChange={(open) => { if (!open) closeReview(); }} title="Confirmá tu jugada" description="Revisá estos datos. El pago se realiza con tu saldo disponible." size="sm" closeOnBackdrop={!pending} initialFocusRef={editButton}
        footer={<div className={styles.modalActions}><button ref={editButton} className={styles.editButton} onClick={closeReview} disabled={pending} type="button">Volver a editar</button><button className={styles.payButton} disabled={!canPayReview} type="button" onClick={() => void submitPayment()}>{pending ? <><span className={styles.spinner} />Procesando pago…</> : <><Icon name="wallet" size={18} />Pagar {formatGs(review?.input.amount ?? 0)}</>}</button></div>}>
        {review ? <div className={styles.confirmation} aria-busy={pending}>
          <div className={styles.confirmGame}><GameIcon gameId={game.id} className={styles.ticketGameIcon} /><strong>{displayName}</strong></div><SelectionPreview gameId={game.id} draft={review.draft} />
          <dl className={styles.summaryDetails}>
            <div><dt>Sorteo</dt><dd>{formatDrawName(review.draw)}</dd></div><div><dt>Fecha y hora</dt><dd>{formatDrawDate(review.draw.drawsAt)} · {formatDrawTime(review.draw.drawsAt)}</dd></div>
            <div><dt>Posición</dt><dd>{getTraditionalPositionLabel(game.id, review.draft.position)}</dd></div><div><dt>Total a pagar</dt><dd className={styles.confirmTotal}>{formatGs(review.input.amount)}</dd></div><div><dt>Saldo disponible</dt><dd>{session ? formatGs(session.balance) : "—"}</dd></div>
          </dl>
          <p className={styles.paymentNote}>Se descontará {formatGs(review.input.amount)} de tu saldo al confirmar. El saldo final se actualiza cuando se acepta la jugada.</p>
          {!reviewStillValid ? <div className={styles.errorNotice} role="alert">Cambió la disponibilidad del sorteo o de la jugada. Volvé a editar y revisá los datos.</div> : null}
          {reviewInsufficient ? <div className={styles.errorNotice} role="alert">Tu saldo ya no alcanza para esta jugada. Volvé a editar el importe.</div> : null}
          {error ? <div className={styles.errorNotice} role="alert"><p>{error}</p><Link href="/mis-jugadas">Revisar Mis jugadas</Link></div> : null}
          {pending ? <p className={styles.pendingNotice} role="status">Estamos confirmando el pago. No vuelvas a enviarlo.</p> : null}
        </div> : null}
      </Modal>
      <Modal open={showSuccess && Boolean(accepted)} onOpenChange={setShowSuccess} title="Jugada registrada" description="Tu jugada quedó guardada. Podés consultar el comprobante en Mis jugadas." size="sm"
        footer={<div className={styles.modalActions}><button className={styles.editButton} onClick={newPlay} type="button">Nueva jugada</button><Link className={styles.payButton} href="/mis-jugadas">Ver en Mis jugadas<Icon name="chevronRight" size={17} /></Link></div>}>
        {accepted ? <div className={styles.successBody}><span className={styles.successMark}><Icon name="check" size={32} /></span><p>{accepted.replayed ? "Esta jugada ya estaba registrada. No se volvió a cobrar." : "Pago confirmado con tu saldo"}</p><strong className={styles.successAmount}>{formatGs(accepted.amount)}</strong><div className={styles.successBalance}><span>{accepted.replayed ? "Saldo disponible" : "Saldo actualizado"}</span><strong>{session ? formatGs(session.balance) : "—"}</strong></div></div> : null}
      </Modal>
    </main>
  );
}

function StepHeading({ number, id, title, detail }: { number: string; id: string; title: string; detail: string }) {
  return <div className={styles.stepHeading}><span className={styles.stepNumber} aria-hidden="true">{number}</span><div><h2 id={id}>{title}</h2><p>{detail}</p></div></div>;
}

function NumberField({ id, label, digits, value, error, onChange, onBlur }: {
  id: string; label: string; digits: number; value: string; error?: string; onChange: (value: string) => void; onBlur: () => void;
}) {
  return <div className={styles.numberField}><label htmlFor={id}>{label}</label>
    <input id={id} className={styles.numberInput} type="text" inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={digits} placeholder={digits === 3 ? "123" : "12"} value={value} aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, digits))} onBlur={(event) => { onChange(normalizeTraditionalNumber(event.target.value, digits)); onBlur(); }} />
    <span className={styles.numberHint} id={`${id}-hint`}>{digits === 3 ? "Del 001 al 999" : "Del 00 al 99"}</span>{error ? <span id={`${id}-error`} className={styles.fieldError}>{error}</span> : null}
  </div>;
}

function PositionField({ gameId, definition, value, onChange, error }: {
  gameId: TraditionalGameId; definition: TraditionalGameDefinition; value: number; onChange: (value: number) => void; error?: string;
}) {
  const range = getTraditionalPositionRange(definition);
  if (!range) return null;
  const positions = Array.from({ length: Math.max(0, range.max - range.min + 1) }, (_, index) => index + range.min);
  const shortcuts = [5, 10, 14].filter((position) => positions.includes(position));
  return <div className={styles.positionField}><div className={styles.positionLabel}><label htmlFor="position">Hasta la posición</label><p>{gameId === "redoblona" ? "Para tu número de redoblona" : "Elegí la postura de tu jugada"}</p></div>
    <div className={styles.positionControls}><select id="position" value={positions.includes(value) ? value : ""} aria-invalid={Boolean(error)} onChange={(event) => onChange(Number(event.target.value))}>
      {!positions.includes(value) ? <option value="" disabled>Elegir</option> : null}{positions.map((position) => <option key={position} value={position}>{position === 1 ? "1 · Cabeza" : `${position}.ª posición`}</option>)}
    </select>{shortcuts.length ? <div className={styles.positionShortcuts}>{shortcuts.map((position) => <button type="button" key={position} aria-label={`Hasta la posición ${position}`} aria-pressed={value === position} onClick={() => onChange(position)}>{position}</button>)}</div> : null}</div>
    {error ? <span className={styles.fieldError}>{error}</span> : null}
  </div>;
}

function SelectionPreview({ gameId, draft }: { gameId: TraditionalGameId; draft: TraditionalDraft }) {
  const first = normalizeTraditionalNumber(gameId === "redoblona" ? draft.head : draft.number, 3);
  const second = normalizeTraditionalNumber(draft.redoblona, 2);
  return <div className={styles.selectionPreview} aria-label="Números seleccionados"><div><span>{gameId === "redoblona" ? "Cabeza" : "Tu número"}</span><strong>{first || "— — —"}</strong></div>
    {gameId === "redoblona" ? <><span className={styles.previewPlus} aria-hidden="true">+</span><div><span>Redoblona</span><strong>{second || "— —"}</strong></div></> : null}
  </div>;
}

function ShuffleIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m17 3 4 4-4 4M17 13l4 4-4 4M3 7h3c4 0 8 10 12 10h3M3 17h3c1.5 0 3-1.5 4.5-3.5M14 10c1.5-2 2.5-3 4-3h3" /></svg>;
}
