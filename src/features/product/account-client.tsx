"use client";

import { FormEvent, useRef, useState } from "react";
import { useProduct } from "@/providers/product-provider";
import { publicProductErrorMessage } from "@/lib/product/public-error";
import { AccountDashboard } from "./account-dashboard";
import { SectionHeader } from "./section-header";
import styles from "./product.module.css";

export type AccountMode = "login" | "register";

interface FieldErrors {
  displayName?: string;
  identifier?: string;
  password?: string;
  acceptedTerms?: string;
}

export function validateAccountFields({
  mode,
  displayName,
  identifier,
  password,
  acceptedTerms,
}: {
  mode: AccountMode;
  displayName: string;
  identifier: string;
  password: string;
  acceptedTerms: boolean;
}) {
  const errors: FieldErrors = {};

  if (mode === "register" && displayName.trim().length < 2) {
    errors.displayName = "Ingresá un nombre de al menos 2 caracteres.";
  }
  if (identifier.trim().length < 3) {
    errors.identifier = "Ingresá un documento o teléfono válido.";
  }
  if (mode === "login" && password.length === 0) {
    errors.password = "Ingresá tu contraseña.";
  }
  if (mode === "register" && password.length < 8) {
    errors.password = "La contraseña debe tener al menos 8 caracteres.";
  }
  if (mode === "register" && !acceptedTerms) {
    errors.acceptedTerms = "Debés aceptar los términos y la política de privacidad.";
  }

  return errors;
}

export function accountErrorMessage(
  reason: unknown,
  mode: AccountMode | "logout",
) {
  const failure = reason !== null && typeof reason === "object"
    ? reason as { status?: unknown; code?: unknown; message?: unknown }
    : null;
  const status = typeof failure?.status === "number" ? failure.status : undefined;
  const code = typeof failure?.code === "string" ? failure.code : undefined;

  if (code === "SESSION_EXPIRED" || status === 419 || status === 440) {
    return "Tu sesión venció. Ingresá nuevamente.";
  }
  if (status === 401 || code === "INVALID_CREDENTIALS") {
    return "El documento, teléfono o contraseña no coincide con una cuenta activa.";
  }
  if (status === 409 || code === "USER_EXISTS" || code === "ACCOUNT_EXISTS") {
    return "Ya existe una cuenta con ese documento o teléfono.";
  }
  if (status === 429 || code === "RATE_LIMITED") {
    return "Hay demasiados intentos. Esperá un momento antes de reintentar.";
  }
  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    code === "BACKOFFICE_NETWORK_ERROR" ||
    code === "BACKOFFICE_TIMEOUT"
  ) {
    return "El servicio no está disponible en este momento. Intentá nuevamente.";
  }
  if (typeof failure?.message === "string" && failure.message.trim()) {
    return publicProductErrorMessage(failure.message, "No pudimos completar la operación.");
  }
  if (mode === "register") {
    return "No pudimos crear tu cuenta. Intentá nuevamente.";
  }
  if (mode === "logout") {
    return "No pudimos cerrar la sesión. Intentá nuevamente.";
  }
  return "No pudimos ingresar a tu cuenta.";
}

export function AccountClient() {
  const {
    account,
    session,
    loading,
    login,
    register,
    logout,
    gatewayMode,
    error: gatewayError,
    unauthorized,
    refresh,
  } = useProduct();
  const [mode, setMode] = useState<AccountMode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const displayNameRef = useRef<HTMLInputElement>(null);
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const acceptedTermsRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const logoutErrorRef = useRef<HTMLDivElement>(null);
  const submissionLockRef = useRef(false);
  const logoutLockRef = useRef(false);

  const changeMode = (nextMode: AccountMode) => {
    if (pending || nextMode === mode) return;
    setMode(nextMode);
    setError(null);
    setStatus(null);
    setFieldErrors({});
    setPassword("");
  };

  const focusFirstError = (errors: FieldErrors) => {
    if (errors.displayName) displayNameRef.current?.focus();
    else if (errors.identifier) identifierRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
    else if (errors.acceptedTerms) acceptedTermsRef.current?.focus();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionLockRef.current) return;

    const validationErrors = validateAccountFields({
      mode,
      displayName,
      identifier,
      password,
      acceptedTerms,
    });
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setStatus(null);
      setError("Revisá los campos indicados para continuar.");
      focusFirstError(validationErrors);
      return;
    }

    submissionLockRef.current = true;
    setPending(true);
    setError(null);
    setStatus(null);
    setFieldErrors({});
    try {
      if (mode === "register") {
        await register({
          displayName: displayName.trim(),
          documentOrPhone: identifier.trim(),
          password,
          acceptedTerms,
        });
        setStatus("Registro completado. Ya podés gestionar tu cuenta.");
      } else {
        await login(identifier.trim(), password);
      }
      setIdentifier("");
      setDisplayName("");
      setAcceptedTerms(false);
    } catch (reason) {
      setError(accountErrorMessage(reason, mode));
      window.requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      submissionLockRef.current = false;
      setPassword("");
      setPending(false);
    }
  };

  const endSession = async () => {
    if (logoutLockRef.current) return;
    logoutLockRef.current = true;
    setLogoutPending(true);
    setLogoutError(null);
    try {
      await logout();
    } catch (reason) {
      setLogoutError(accountErrorMessage(reason, "logout"));
      window.requestAnimationFrame(() => logoutErrorRef.current?.focus());
    } finally {
      logoutLockRef.current = false;
      setLogoutPending(false);
    }
  };

  if (loading) {
    return <main className={styles.page}><div className={styles.loadingBar} aria-label="Cargando cuenta" /></main>;
  }

  if (session) {
    return (
      <AccountDashboard
        account={account}
        gatewayError={gatewayError}
        key={`${gatewayMode}:${session.id}`}
        logoutError={logoutError}
        logoutErrorRef={logoutErrorRef}
        logoutPending={logoutPending}
        onLogout={endSession}
        refresh={refresh}
        session={session}
        status={status}
      />
    );
  }

  const isRegister = mode === "register";
  const formTitle = isRegister ? "Creá tu cuenta" : "Ingresá a tu cuenta";

  return (
    <main className={styles.page}>
      <SectionHeader
        eyebrow="Acceso seguro"
        title={formTitle}
        description="Tus credenciales y tu sesión se validan de forma segura."
      />
      <div className={styles.accountGrid}>
        <form aria-busy={pending} className={`${styles.contentCard} ${styles.formStack}`} noValidate onSubmit={submit}>
          <div aria-label="Tipo de acceso" className={styles.chipGrid} role="group">
            <button aria-pressed={mode === "login"} className={styles.chip} data-selected={mode === "login"} disabled={pending} onClick={() => changeMode("login")} type="button">Ingresar</button>
            <button aria-pressed={isRegister} className={styles.chip} data-selected={isRegister} disabled={pending} onClick={() => changeMode("register")} type="button">Registrarme</button>
          </div>
          {isRegister ? (
            <div className={styles.fieldGroup}>
              <label htmlFor="display-name">Nombre visible</label>
              <input
                aria-describedby={fieldErrors.displayName ? "display-name-error" : undefined}
                aria-invalid={Boolean(fieldErrors.displayName)}
                autoComplete="name"
                className={styles.input}
                id="display-name"
                maxLength={80}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  if (fieldErrors.displayName) setFieldErrors((current) => ({ ...current, displayName: undefined }));
                }}
                ref={displayNameRef}
                required
                value={displayName}
              />
              {fieldErrors.displayName ? <p className={styles.fieldHint} id="display-name-error">{fieldErrors.displayName}</p> : null}
            </div>
          ) : null}
          <div className={styles.fieldGroup}>
            <label htmlFor="identifier">Documento o teléfono</label>
            <input
              aria-describedby={fieldErrors.identifier ? "identifier-error" : "identifier-hint"}
              aria-invalid={Boolean(fieldErrors.identifier)}
              autoCapitalize="none"
              autoComplete="username"
              className={styles.input}
              id="identifier"
              maxLength={40}
              onChange={(event) => {
                setIdentifier(event.target.value);
                if (fieldErrors.identifier) setFieldErrors((current) => ({ ...current, identifier: undefined }));
              }}
              ref={identifierRef}
              required
              spellCheck={false}
              value={identifier}
            />
            {fieldErrors.identifier
              ? <p className={styles.fieldHint} id="identifier-error">{fieldErrors.identifier}</p>
              : <p className={styles.fieldHint} id="identifier-hint">Ingresá el documento o teléfono asociado a tu cuenta.</p>}
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="password">Contraseña</label>
            <input
              aria-describedby={fieldErrors.password ? "password-error" : "password-hint"}
              aria-invalid={Boolean(fieldErrors.password)}
              autoComplete={isRegister ? "new-password" : "current-password"}
              className={styles.input}
              id="password"
              minLength={isRegister ? 8 : 1}
              onChange={(event) => {
                setPassword(event.target.value);
                if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
              }}
              ref={passwordRef}
              required
              type="password"
              value={password}
            />
            {fieldErrors.password
              ? <p className={styles.fieldHint} id="password-error">{fieldErrors.password}</p>
              : <p className={styles.fieldHint} id="password-hint">
                  {isRegister
                    ? "Usá al menos 8 caracteres."
                    : "La política de credenciales se valida al ingresar."}
                </p>}
          </div>
          {isRegister ? (
            <div className={styles.fieldGroup}>
              <label style={{ alignItems: "flex-start", display: "flex", gap: 10, lineHeight: 1.5 }}>
                <input
                  aria-describedby={fieldErrors.acceptedTerms ? "terms-error" : undefined}
                  aria-invalid={Boolean(fieldErrors.acceptedTerms)}
                  checked={acceptedTerms}
                  onChange={(event) => {
                    setAcceptedTerms(event.target.checked);
                    if (fieldErrors.acceptedTerms) setFieldErrors((current) => ({ ...current, acceptedTerms: undefined }));
                  }}
                  ref={acceptedTermsRef}
                  style={{ flex: "0 0 auto", height: 18, marginTop: 2, width: 18 }}
                  type="checkbox"
                />
                <span>Acepto los términos de uso y la política de privacidad.</span>
              </label>
              {fieldErrors.acceptedTerms ? <p className={styles.fieldHint} id="terms-error">{fieldErrors.acceptedTerms}</p> : null}
            </div>
          ) : null}
          {unauthorized ? (
            <div className={styles.statusBox} role="status">
              Tu sesión venció. Ingresá nuevamente.
            </div>
          ) : null}
          {gatewayError && !error ? (
            <div className={styles.errorBox} role="alert">
              <p>{gatewayError}</p>
              <button className={styles.quietButton} onClick={() => void refresh()} type="button">
                Reintentar conexión
              </button>
            </div>
          ) : null}
          {error ? <div className={styles.errorBox} ref={errorRef} role="alert" tabIndex={-1}>{error}</div> : null}
          {status ? <div aria-live="polite" className={styles.statusBox} role="status">{status}</div> : null}
          <button className={styles.primaryButton} disabled={pending} type="submit">
            {pending ? (isRegister ? "Creando cuenta…" : "Ingresando…") : isRegister ? "Crear cuenta" : "Ingresar"}
          </button>
        </form>
        <aside className={styles.contentCard}>
          <p className={styles.eyebrow}>Seguridad de tu cuenta</p>
          <h2 className={styles.sectionTitle}>Una sola fuente de verdad</h2>
          <p className={styles.lede}>Tus datos se envían mediante una conexión segura para validar el acceso, crear la cuenta y mantener tu sesión.</p>
          <p className={styles.lede}>Quinie.LA no replica reglas de identidad ni almacena contraseñas en este frontend.</p>
        </aside>
      </div>
    </main>
  );
}
