"use client";

import { FormEvent, useState } from "react";
import { useProduct } from "@/providers/product-provider";
import { formatGs } from "@/lib/product/catalog";
import { SectionHeader } from "./section-header";
import styles from "./product.module.css";

export function AccountClient() {
  const { session, loading, login, logout } = useProduct();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(identifier || displayName, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos ingresar a tu cuenta.");
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return <main className={styles.page}><div className={styles.loadingBar} aria-label="Cargando cuenta" /></main>;
  }

  if (session) {
    const initials = session.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    return (
      <main className={styles.page}>
        <SectionHeader eyebrow="Tu espacio" title="Cuenta" description="Gestioná tu sesión y consultá la información principal de tu perfil." />
        <div className={styles.accountGrid}>
          <section className={styles.contentCard}>
            <div className={styles.profileHero}>
              <span className={styles.avatarLarge} aria-hidden="true">{initials}</span>
              <div><p className={styles.eyebrow}>{session.role === "ADMIN" ? "Gestión habilitada" : "Cuenta personal"}</p><h2 className={styles.sectionTitle}>{session.displayName}</h2></div>
            </div>
            <dl className={styles.summaryList} style={{ marginTop: 24 }}>
              <div className={styles.summaryRow}><dt>Saldo disponible</dt><dd>{formatGs(session.balance)}</dd></div>
              <div className={styles.summaryRow}><dt>Moneda</dt><dd>{session.currency}</dd></div>
              <div className={styles.summaryRow}><dt>Sesión</dt><dd>Protegida</dd></div>
            </dl>
          </section>
          <aside className={styles.contentCard}>
            <p className={styles.eyebrow}>Seguridad</p>
            <h2 className={styles.sectionTitle}>Control de sesión</h2>
            <p className={styles.lede}>Cerrá tu sesión cuando uses un dispositivo compartido.</p>
            <button className={styles.secondaryButton} onClick={() => void logout()} style={{ marginTop: 22 }} type="button">Cerrar sesión</button>
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <SectionHeader eyebrow="Acceso seguro" title={mode === "login" ? "Ingresá a tu cuenta" : "Creá tu cuenta"} description="Usá datos propios únicamente cuando el entorno de producción esté habilitado." />
      <div className={styles.accountGrid}>
        <form className={`${styles.contentCard} ${styles.formStack}`} onSubmit={submit}>
          <div className={styles.chipGrid}>
            <button className={styles.chip} data-selected={mode === "login"} onClick={() => setMode("login")} type="button">Ingresar</button>
            <button className={styles.chip} data-selected={mode === "register"} onClick={() => setMode("register")} type="button">Registrarme</button>
          </div>
          {mode === "register" ? (
            <div className={styles.fieldGroup}><label htmlFor="display-name">Nombre visible</label><input className={styles.input} id="display-name" onChange={(event) => setDisplayName(event.target.value)} required value={displayName} /></div>
          ) : null}
          <div className={styles.fieldGroup}><label htmlFor="identifier">Documento o teléfono</label><input autoComplete="username" className={styles.input} id="identifier" onChange={(event) => setIdentifier(event.target.value)} required value={identifier} /></div>
          <div className={styles.fieldGroup}><label htmlFor="password">Contraseña</label><input autoComplete={mode === "login" ? "current-password" : "new-password"} className={styles.input} id="password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></div>
          {error ? <div className={styles.errorBox} role="alert">{error}</div> : null}
          <button className={styles.primaryButton} disabled={pending} type="submit">{pending ? "Procesando…" : mode === "login" ? "Ingresar" : "Continuar"}</button>
        </form>
        <aside className={styles.contentCard}>
          <p className={styles.eyebrow}>Tu información</p>
          <h2 className={styles.sectionTitle}>Privacidad desde el inicio</h2>
          <p className={styles.lede}>La interfaz no expone credenciales, documentos ni datos personales en el navegador.</p>
        </aside>
      </div>
    </main>
  );
}
