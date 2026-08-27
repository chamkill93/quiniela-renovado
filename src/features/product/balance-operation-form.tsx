"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import type { TopupMethod, WalletMovement } from "@/lib/gaming/types";
import { formatGs } from "@/lib/product/catalog";
import { createProductIdempotencyKey } from "@/lib/product/gateway/http";
import { useProduct } from "@/providers/product-provider";
import {
  PHONE_OPERATORS, WALLET_CHANNELS, WALLET_MAX_AMOUNT, WALLET_QUICK_AMOUNTS,
  parseWalletAmount, walletAmountError, walletDate, walletMethodLabel, walletReference,
  type WalletChannel, type WalletOperation,
} from "./balance-data";
import styles from "./balance.module.css";

function operationError(reason: unknown, operation: WalletOperation) {
  const code = reason && typeof reason === "object" && "code" in reason ? reason.code : null;
  if (code === "INSUFFICIENT_BALANCE") return "Tu saldo cambió y ya no alcanza para este retiro. Actualizá el saldo o elegí un importe menor.";
  if (code === "ACCOUNT_PAUSED") return "Tu cuenta tiene una pausa activa. Podés consultar tu saldo y realizar retiros.";
  if (code === "ACCOUNT_TIME_LIMIT") return "Alcanzaste tu límite de tiempo de esta sesión. Consultá tus autolímites en Mi cuenta; los retiros siguen disponibles.";
  if (code === "ACCOUNT_AMOUNT_LIMIT" || code === "ACCOUNT_LIMIT_EXCEEDED" || code === "DEPOSIT_LIMIT_EXCEEDED") return "Este depósito supera el límite de tu cuenta. Revisá tus autolímites antes de continuar.";
  if (code === "SESSION_EXPIRED" || code === "UNAUTHORIZED" || code === "SESSION_REQUIRED" || code === "SESSION_NOT_FOUND" || code === "ACCOUNT_SESSION_CHANGED") return "Tu sesión terminó. Volvé a ingresar a tu cuenta.";
  if (code === "RATE_LIMITED") return "Esperá un momento antes de volver a intentar.";
  return `No pudimos confirmar ${operation === "deposit" ? "el depósito" : "el retiro"}. Podés reintentar sin duplicar esta operación.`;
}

export function BalanceOperationForm({
  operation, initialChannel = "card", onBusyChange, onComplete, onDone,
}: {
  operation: WalletOperation;
  initialChannel?: WalletChannel;
  onBusyChange: (busy: boolean) => void;
  onComplete: (movement: WalletMovement) => void;
  onDone: () => void;
}) {
  const { session, loading, unauthorized, error: balanceError, requestTopUp, requestWithdrawal, getPendingWalletOperationKey, walletAvailable, withdrawalAvailable, gatewayMode } = useProduct();
  const fieldId = useId();
  const [step, setStep] = useState<"details" | "review" | "success">("details");
  const [channel, setChannel] = useState<WalletChannel>(initialChannel);
  const [operator, setOperator] = useState<TopupMethod>("TIGO");
  const [amountText, setAmountText] = useState("50.000");
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<WalletMovement | null>(null);
  const pendingRef = useRef(false);
  const idempotencyRef = useRef(new Map<string, string>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const isDeposit = operation === "deposit";
  const action = isDeposit ? "depósito" : "retiro";
  const selectedChannel = WALLET_CHANNELS.find((item) => item.id === channel)!;
  const method: TopupMethod = channel === "phone" ? operator : selectedChannel.method;
  const amount = parseWalletAmount(amountText) ?? 0;
  const validationError = walletAmountError(amountText, operation, session?.balance ?? 0);
  const available = !!session && !loading && !unauthorized && !balanceError && walletAvailable && (isDeposit || withdrawalAvailable);

  useEffect(() => {
    if (step !== "details") headingRef.current?.focus();
  }, [step]);

  function updateAmount(value: string) {
    setAmountText(value);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current || !available) return;
    setAttempted(true);
    const fingerprint = `${operation}:${method}:${amount}`;
    const pendingKey = getPendingWalletOperationKey(isDeposit ? "topup" : "withdrawal", { amount, method });
    // Replaying a previous attempt must work even if it already reduced the balance.
    if (validationError && !idempotencyRef.current.has(fingerprint) && !pendingKey) {
      setStep("details");
      amountRef.current?.focus();
      return;
    }
    if (step === "details") {
      setError(null);
      setStep("review");
      return;
    }
    if (step !== "review") return;
    pendingRef.current = true;
    setPending(true);
    onBusyChange(true);
    setError(null);
    try {
      const idempotencyKey = pendingKey ?? idempotencyRef.current.get(fingerprint) ?? createProductIdempotencyKey();
      idempotencyRef.current.set(fingerprint, idempotencyKey);
      const request = isDeposit ? requestTopUp : requestWithdrawal;
      const result = await request({ amount, method }, idempotencyKey);
      setReceipt(result.balanceEntry);
      setStep("success");
      onComplete(result.balanceEntry);
    } catch (reason) {
      setError(operationError(reason, operation));
    } finally {
      pendingRef.current = false;
      setPending(false);
      onBusyChange(false);
    }
  }

  if (step === "success" && receipt) return <div className={styles.receipt}>
    <div aria-hidden="true" className={styles.receiptCheck}><Icon name="check" size={30} /></div>
    <div role="status"><h3 ref={headingRef} tabIndex={-1}>{isDeposit ? "Depósito realizado" : "Retiro realizado"}</h3><p>{balanceError ? "Tu operación quedó registrada. Actualizá el saldo al cerrar este comprobante." : "Tu saldo y tus movimientos ya están actualizados."}</p></div>
    <p className={styles.receiptAmount} data-direction={operation}>{isDeposit ? "+" : "−"}{formatGs(Math.abs(receipt.amount))}</p>
    <dl className={styles.receiptDetails}>
      <div><dt>Canal</dt><dd>{walletMethodLabel(receipt.method)}</dd></div>
      <div><dt>Estado</dt><dd className={styles.completedBadge}><Icon name="check" size={13} />Completado</dd></div>
      <div><dt>Fecha y hora</dt><dd>{walletDate(receipt.createdAt)} · {walletDate(receipt.createdAt, "time")}</dd></div>
      <div><dt>Referencia</dt><dd className={styles.reference}>{walletReference(receipt)}</dd></div>
      <div className={styles.receiptBalance}><dt>Saldo después de la operación</dt><dd>{formatGs(receipt.balanceAfter)}</dd></div>
    </dl>
    <button className={styles.primaryButton} onClick={onDone} type="button">Ver movimientos<Icon name="chevronRight" size={16} /></button>
    {gatewayMode === "preview" ? <p className={styles.localNotice}>Esta operación no genera cobros ni transferencias de dinero real.</p> : null}
  </div>;

  return <form aria-busy={pending} className={styles.operationForm} noValidate onSubmit={(event) => void submit(event)}>
    <ol aria-label="Pasos de la operación" className={styles.steps}>
      <li aria-current={step === "details" ? "step" : undefined} data-complete={step === "review"}><span>{step === "review" ? <Icon name="check" size={12} /> : "1"}</span>Importe y canal</li>
      <li aria-current={step === "review" ? "step" : undefined}><span>2</span>Confirmación</li>
    </ol>
    {step === "details" ? <>
      <fieldset className={styles.channelFieldset}>
        <legend>{isDeposit ? "¿Cómo querés cargar saldo?" : "¿Cómo querés retirar?"}</legend>
        <div className={styles.channelChoices}>
          {WALLET_CHANNELS.map((item) => <label className={styles.channelChoice} data-channel={item.id} key={item.id}>
            <input checked={channel === item.id} name={`${fieldId}-channel`} onChange={() => { setChannel(item.id); setError(null); }} type="radio" value={item.id} />
            <span className={styles.channelChoiceFace}><Icon name={item.icon} size={23} /><span>{item.label}</span><span aria-hidden="true" className={styles.radioMark} /></span>
          </label>)}
        </div>
      </fieldset>
      {channel === "phone" ? <fieldset className={styles.operatorFieldset}>
        <legend>Elegí tu operadora</legend>
        <div className={styles.operatorChoices}>{PHONE_OPERATORS.map((item) => <label className={styles.operatorChoice} data-operator={item.method} key={item.method}>
          <input checked={operator === item.method} name={`${fieldId}-operator`} onChange={() => { setOperator(item.method); setError(null); }} type="radio" value={item.method} />
          <span>{item.label}<span aria-hidden="true" className={styles.radioMark} /></span>
        </label>)}</div>
      </fieldset> : null}
      <div className={styles.amountField}>
        <label htmlFor={`${fieldId}-amount`}>Importe a {isDeposit ? "cargar" : "retirar"}</label>
        <div className={styles.amountInput} data-invalid={attempted && !!validationError}>
          <span aria-hidden="true">Gs.</span><input aria-describedby={`${fieldId}-amount-hint${attempted && validationError ? ` ${fieldId}-amount-error` : ""}`} aria-invalid={attempted && !!validationError} autoComplete="off" id={`${fieldId}-amount`} inputMode="numeric" maxLength={12} onBlur={() => { const value = parseWalletAmount(amountText); if (value !== null) setAmountText(new Intl.NumberFormat("es-PY").format(value)); }} onChange={(event) => updateAmount(event.target.value)} placeholder="0" ref={amountRef} type="text" value={amountText} /><span>PYG</span>
        </div>
        <div aria-label="Importes sugeridos" className={styles.quickAmounts} role="group">{WALLET_QUICK_AMOUNTS.map((value) => <button aria-pressed={amount === value} disabled={!isDeposit && value > (session?.balance ?? 0)} key={value} onClick={() => updateAmount(new Intl.NumberFormat("es-PY").format(value))} type="button">{formatGs(value)}</button>)}</div>
        <p className={styles.fieldHint} id={`${fieldId}-amount-hint`}>Desde Gs. 10.000 hasta Gs. 5.000.000 por operación.</p>
        {attempted && validationError ? <p className={styles.fieldError} id={`${fieldId}-amount-error`} role="alert">{validationError}</p> : null}
      </div>
      <div className={styles.availableRow}><span>Saldo disponible <strong>{formatGs(session?.balance ?? 0)}</strong></span>{!isDeposit && (session?.balance ?? 0) >= 10_000 ? <button onClick={() => updateAmount(new Intl.NumberFormat("es-PY").format(Math.min(session!.balance, WALLET_MAX_AMOUNT)))} type="button">Usar máximo</button> : null}</div>
    </> : <div className={styles.review}>
      <h3 ref={headingRef} tabIndex={-1}>Revisá tu {action}</h3>
      <p>Confirmá el importe y el canal antes de continuar.</p>
      <div className={styles.reviewAmount} data-direction={operation}><span className={styles.directionIcon}><Icon name={isDeposit ? "arrowDownLeft" : "arrowUpRight"} size={24} /></span><strong>{formatGs(amount)}</strong></div>
      <dl className={styles.receiptDetails}>
        <div><dt>Operación</dt><dd>{isDeposit ? "Carga de saldo" : "Retiro de saldo"}</dd></div>
        <div><dt>Canal</dt><dd className={styles.reviewChannel}><Icon name={selectedChannel.icon} size={18} />{walletMethodLabel(method)}</dd></div>
        <div><dt>Moneda</dt><dd>Guaraníes · PYG</dd></div>
        <div><dt>Saldo disponible</dt><dd>{formatGs(session?.balance ?? 0)}</dd></div>
      </dl>
      <p className={styles.reviewHint}><Icon name="info" size={16} />{isDeposit ? "El depósito se sumará a tu saldo al confirmar." : "El importe del retiro se descontará de tu saldo al confirmar."}</p>
    </div>}
    {!available ? <p className={styles.fieldError} role="alert">Esta operación no está disponible. Revisá tu sesión e intentá nuevamente.</p> : null}
    {error ? <div className={styles.formError} role="alert"><Icon name="warning" size={18} /><p>{error}</p></div> : null}
    <div className={styles.formActions}>
      {step === "review" ? <button className={styles.secondaryButton} disabled={pending} onClick={() => { setStep("details"); setError(null); }} type="button"><Icon name="arrowLeft" size={16} />Volver</button> : null}
      <button className={isDeposit ? styles.primaryButton : styles.withdrawButton} disabled={pending || !available} type="submit">{pending ? <><span aria-hidden="true" className={styles.spinner} />Procesando…</> : step === "details" ? <>Continuar<Icon name="chevronRight" size={16} /></> : `Confirmar ${action}`}</button>
    </div>
    {gatewayMode === "preview" ? <p className={styles.localNotice}><Icon name="info" size={13} />No se realizan cobros ni transferencias de dinero real. No necesitás ingresar datos bancarios.</p> : null}
  </form>;
}
