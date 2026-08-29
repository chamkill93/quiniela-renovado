"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button, Icon, Logo } from "@/components/ui";

import styles from "./dev-access-gate.module.css";

interface AccessResponse {
  message?: string;
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7.5 10V7.7a4.5 4.5 0 0 1 9 0V10" />
      <rect x="5" y="10" width="14" height="10" rx="3" />
      <path d="M12 14.2v2.6" />
    </svg>
  );
}

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z" />
      <circle cx="12" cy="12" r="2.4" />
      {visible ? <path d="m4 4 16 16" /> : null}
    </svg>
  );
}

export function DevAccessGate() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!code) {
      setError("Ingresá el código para continuar.");
      inputRef.current?.focus();
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/dev-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = (await response.json().catch(() => ({}))) as AccessResponse;

      if (!response.ok) {
        setError(payload.message || "No pudimos validar el código.");
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      router.refresh();
    } catch {
      setError("No pudimos conectar con la página. Intentá nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page} data-testid="dev-access-gate">
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={`${styles.lotteryBall} ${styles.ballOne}`} aria-hidden="true">3</div>
      <div className={`${styles.lotteryBall} ${styles.ballTwo}`} aria-hidden="true">7</div>
      <div className={`${styles.lotteryBall} ${styles.ballThree}`} aria-hidden="true">21</div>

      <section className={styles.layout} aria-labelledby="dev-access-title">
        <div className={styles.welcome}>
          <div className={styles.brandRow}>
            <Logo className={styles.logo} size="lg" surface="dark" />
            <span className={styles.devBadge}>DEV</span>
          </div>
          <p className={styles.eyebrow}>Quiniela online · Paraguay</p>
          <h1 id="dev-access-title" className={styles.title}>
            Bienvenido a la página <span>DEV</span> de Quiniela
          </h1>
          <p className={styles.intro}>
            Un espacio privado para probar la nueva experiencia de quinie.LA antes de su publicación.
          </p>
          <div className={styles.environmentStatus}>
            <span aria-hidden="true" />
            Entorno de desarrollo activo
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.lock} aria-hidden="true">
            <LockIcon />
          </div>
          <div className={styles.cardCopy}>
            <p className={styles.cardEyebrow}>Acceso restringido</p>
            <h2>Ingresá tu código</h2>
            <p>Validaremos tu acceso antes de mostrar el contenido de la página.</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <label htmlFor="dev-access-code">Código de acceso</label>
            <div className={`${styles.inputFrame} ${error ? styles.inputFrameError : ""}`}>
              <input
                ref={inputRef}
                id="dev-access-code"
                name="code"
                type={showCode ? "text" : "password"}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  if (error) setError(null);
                }}
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                disabled={submitting}
                aria-describedby={error ? "dev-access-error" : "dev-access-help"}
                aria-invalid={Boolean(error)}
                autoFocus
              />
              <button
                className={styles.visibilityButton}
                type="button"
                onClick={() => setShowCode((current) => !current)}
                aria-label={showCode ? "Ocultar código" : "Mostrar código"}
                aria-pressed={showCode}
                disabled={submitting}
              >
                <EyeIcon visible={showCode} />
              </button>
            </div>
            <div className={styles.messageSlot}>
              {error ? (
                <p id="dev-access-error" className={styles.error} role="alert">
                  <span aria-hidden="true">!</span>
                  {error}
                </p>
              ) : (
                <p id="dev-access-help" className={styles.help}>
                  El acceso queda activo durante esta sesión del navegador.
                </p>
              )}
            </div>
            <Button
              className={styles.submit}
              type="submit"
              size="lg"
              fullWidth
              loading={submitting}
            >
              {submitting ? "Validando acceso" : "Entrar a la página"}
            </Button>
          </form>

          <div className={styles.contactBlock}>
            <p>¿Necesitás un código de acceso?</p>
            <a
              className={styles.whatsappLink}
              href="https://wa.me/595994792277"
              target="_blank"
              rel="noreferrer"
              aria-label="Solicitar acceso por WhatsApp al +595 994 792277"
            >
              <span className={styles.whatsappIcon} aria-hidden="true">
                <Icon name="whatsapp" size={22} />
              </span>
              <span className={styles.whatsappCopy}>
                <small>Solicitá tu acceso por WhatsApp</small>
                <strong>+595 994 792277</strong>
              </span>
            </a>
          </div>

          <p className={styles.safetyNote}>
            <span aria-hidden="true">18+</span>
            Acceso exclusivo para revisión y pruebas.
          </p>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>quinie.LA · Ambiente de pruebas</span>
        <span className={styles.footerDivider} aria-hidden="true">·</span>
        <span>Desarrollado por: <strong>Área de Desarrollo / Proyectos</strong></span>
      </footer>
    </main>
  );
}
