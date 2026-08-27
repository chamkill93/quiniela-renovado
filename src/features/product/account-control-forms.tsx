"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AccountGateway, AccountLimits, AccountRequestOptions, AccountSettings } from "@/lib/account/contracts";
import type { MockSession } from "@/lib/product/api-types";
import { publicProductErrorMessage } from "@/lib/product/public-error";
import { Icon } from "@/components/ui/Icon";
import { validateAccountLimits, type AccountLimitFields } from "./account-options";
import shared from "./product.module.css";
import styles from "./account.module.css";

function useAccountAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const lockRef = useRef(false);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = async <T,>(operation: (options: AccountRequestOptions) => Promise<T>, onSuccess: (result: T) => void) => {
    if (lockRef.current) return;
    lockRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    setPending(true);
    setError(null);
    try {
      const response = await operation({ signal: controller.signal });
      if (!controller.signal.aborted) onSuccess(response);
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(publicProductErrorMessage(reason, "No pudimos guardar el cambio. Intentá nuevamente."));
        window.requestAnimationFrame(() => errorRef.current?.focus());
      }
    } finally {
      lockRef.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  };
  return { pending, error, errorRef, run };
}

export function AccountLimitsForm({ saved, account, onSave, onCancel }: {
  saved: AccountSettings;
  account: AccountGateway;
  onSave: (settings: AccountSettings) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<AccountLimitFields>({
    daily: String(saved.limits?.daily ?? 50_000), weekly: String(saved.limits?.weekly ?? 200_000), minutes: String(saved.limits?.minutes ?? 60),
  });
  const [errors, setErrors] = useState<ReturnType<typeof validateAccountLimits>>({});
  const dailyRef = useRef<HTMLInputElement>(null);
  const weeklyRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLSelectElement>(null);
  const { pending, error, errorRef, run } = useAccountAction();
  const updateField = (field: keyof AccountLimitFields, value: string) => { setFields((current) => ({ ...current, [field]: value })); setErrors({}); };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateAccountLimits(fields);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (nextErrors.daily) dailyRef.current?.focus();
      else if (nextErrors.weekly) weeklyRef.current?.focus();
      else minutesRef.current?.focus();
      return;
    }
    const input: AccountLimits = { daily: Number(fields.daily), weekly: Number(fields.weekly), minutes: Number(fields.minutes) as AccountLimits["minutes"] };
    void run((options) => account.saveLimits(input, options), onSave);
  };

  return <form aria-busy={pending} className={styles.dialogStack} noValidate onSubmit={submit}>
    <div className={styles.controlNotice} id="account-limits-notice"><Icon name="info" size={20} /><p>Estos límites se aplican a las jugadas de <strong>esta sesión</strong>. Los importes se calculan sobre las últimas 24 horas y 7 días; el tiempo, desde que iniciaste la sesión. Una vez guardados, solo podés reducirlos.</p></div>
    <div className={styles.limitFields}>
      {(["daily", "weekly"] as const).map((field) => <div className={shared.fieldGroup} key={field}>
        <label htmlFor={`account-limit-${field}`}>{field === "daily" ? "Importe diario (Gs.)" : "Importe semanal (Gs.)"}</label>
        <input aria-describedby={errors[field] ? `account-limit-${field}-error` : "account-limits-notice"} aria-invalid={Boolean(errors[field])} className={shared.input} disabled={pending} id={`account-limit-${field}`} inputMode="numeric" maxLength={15} onChange={(event) => updateField(field, event.target.value)} ref={field === "daily" ? dailyRef : weeklyRef} required value={fields[field]} />
        {errors[field] ? <p className={styles.fieldError} id={`account-limit-${field}-error`} role="alert">{errors[field]}</p> : null}
      </div>)}
    </div>
    <div className={shared.fieldGroup}>
      <label htmlFor="account-limit-minutes">Tiempo máximo de sesión</label>
      <select aria-describedby={errors.minutes ? "account-limit-minutes-error" : "account-limits-notice"} aria-invalid={Boolean(errors.minutes)} className={shared.select} disabled={pending} id="account-limit-minutes" onChange={(event) => updateField("minutes", event.target.value)} ref={minutesRef} value={fields.minutes}>
        <option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">1 hora</option><option value="120">2 horas</option>
      </select>
      {errors.minutes ? <p className={styles.fieldError} id="account-limit-minutes-error" role="alert">{errors.minutes}</p> : null}
    </div>
    {error ? <div className={shared.errorBox} ref={errorRef} role="alert" tabIndex={-1}>{error}</div> : null}
    <div className={styles.dialogActions}><button className={shared.secondaryButton} onClick={onCancel} type="button">Cancelar</button><button className={shared.primaryButton} disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar autolímites"}</button></div>
  </form>;
}

export function AccountProfileForm({ session, account, onSave }: { session: MockSession; account: AccountGateway; onSave: () => void }) {
  const [name, setName] = useState(session.displayName);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const { pending, error, errorRef, run } = useAccountAction();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2 || name.trim().length > 80) { setFieldError("Ingresá un nombre de entre 2 y 80 caracteres."); nameRef.current?.focus(); return; }
    setFieldError(null);
    void run((options) => account.updateProfile({ displayName: name.trim() }, options), onSave);
  };
  return <form aria-busy={pending} className={styles.dialogStack} noValidate onSubmit={submit}>
    <div className={shared.fieldGroup}><label htmlFor="account-display-name">Nombre visible</label><input aria-describedby={fieldError ? "account-name-error" : "account-name-hint"} aria-invalid={Boolean(fieldError)} autoComplete="name" className={shared.input} disabled={pending} id="account-display-name" maxLength={80} onChange={(event) => { setName(event.target.value); setFieldError(null); }} ref={nameRef} value={name} /><p className={styles.dialogNote} id="account-name-hint">Así aparece tu nombre en la cuenta. Cambiarlo no modifica tu identificación.</p>{fieldError ? <p className={styles.fieldError} id="account-name-error" role="alert">{fieldError}</p> : null}</div>
    {error ? <div className={shared.errorBox} ref={errorRef} role="alert" tabIndex={-1}>{error}</div> : null}
    <button className={shared.primaryButton} disabled={pending || name.trim() === session.displayName} type="submit">{pending ? "Guardando…" : "Guardar cambios"}</button>
  </form>;
}

export function AccountPauseForm({ account, onSave }: { account: AccountGateway; onSave: (settings: AccountSettings) => void }) {
  const [duration, setDuration] = useState("15");
  const [confirmed, setConfirmed] = useState(false);
  const { pending, error, errorRef, run } = useAccountAction();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!confirmed) return;
    void run((options) => account.pause({ durationMinutes: Number(duration) as 15 | 30 | 60 }, options), onSave);
  };
  return <form aria-busy={pending} className={styles.dialogStack} onSubmit={submit}>
    <div className={styles.controlNotice}><Icon name="moon" size={22} /><p>Durante la pausa se bloquean las nuevas jugadas y recargas de <strong>esta sesión</strong>. Podés seguir consultando tu saldo y comprobantes. Una pausa vigente no se puede acortar.</p></div>
    <div className={shared.fieldGroup}><label htmlFor="account-pause-duration">Duración de la pausa</label><select className={shared.select} disabled={pending} id="account-pause-duration" onChange={(event) => { setDuration(event.target.value); setConfirmed(false); }} value={duration}><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">1 hora</option></select></div>
    <label className={styles.confirmation}><input checked={confirmed} disabled={pending} onChange={(event) => setConfirmed(event.target.checked)} required type="checkbox" /><span>Confirmo que quiero pausar las jugadas de esta sesión.</span></label>
    {error ? <div className={shared.errorBox} ref={errorRef} role="alert" tabIndex={-1}>{error}</div> : null}
    <button className={shared.primaryButton} disabled={pending || !confirmed} type="submit">{pending ? "Activando pausa…" : "Activar pausa"}</button>
  </form>;
}
