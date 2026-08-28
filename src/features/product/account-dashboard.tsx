"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import type { MockSession } from "@/lib/product/api-types";
import { formatGs } from "@/lib/product/catalog";
import type { AccountGateway, AccountSettings } from "@/lib/account/contracts";
import { publicProductErrorMessage } from "@/lib/product/public-error";
import { accountWhatsAppUrl } from "./account-options";
import { AccountLimitsForm, AccountPauseForm, AccountProfileForm } from "./account-control-forms";
import shared from "./product.module.css";
import styles from "./account.module.css";

type AccountPanel = "profile" | "security" | "whatsapp" | "limits" | "pause";

interface AccountDashboardProps {
  session: MockSession;
  account?: AccountGateway;
  status: string | null;
  gatewayError: string | null;
  refresh: () => Promise<void>;
  logoutPending: boolean;
  logoutError: string | null;
  logoutErrorRef: RefObject<HTMLDivElement | null>;
  onLogout: () => Promise<void>;
}

function AccountMenuItem({
  title, description, icon, href, onClick, badge, whatsapp = false,
}: {
  title: string;
  description: string;
  icon: IconName;
  href?: string;
  onClick?: () => void;
  badge?: string;
  whatsapp?: boolean;
}) {
  const descriptionId = useId();
  const external = href?.startsWith("https://");
  const attributes = {
    className: `${styles.menuItem}${whatsapp ? ` ${styles.whatsappItem}` : ""}`,
    "aria-label": external ? `${title} (se abre en una pestaña nueva)` : title,
    "aria-describedby": descriptionId,
  };
  const content = <>
    <span className={styles.menuIcon}><Icon name={icon} size={21} /></span>
    <span className={styles.menuCopy}>
      <span className={styles.menuTitle}>{title}{badge ? <span className={styles.rowBadge}>{badge}</span> : null}</span>
      <span className={styles.menuDescription} id={descriptionId}>{description}</span>
    </span>
    <Icon className={styles.chevron} name="chevronRight" size={16} />
  </>;

  if (href && external) {
    return <a {...attributes} href={href} rel="noopener noreferrer" target="_blank">{content}</a>;
  }
  if (href) return <Link {...attributes} href={href}>{content}</Link>;
  return <button {...attributes} onClick={onClick} type="button">{content}</button>;
}

export function AccountDashboard({
  session, account, status, gatewayError, refresh, logoutPending, logoutError, logoutErrorRef, onLogout,
}: AccountDashboardProps) {
  const [panel, setPanel] = useState<AccountPanel | null>(null);
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [controlsLoading, setControlsLoading] = useState(Boolean(account));
  const [controlsError, setControlsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const readVersion = useRef(0);
  const loadSettings = useCallback(async (signal?: AbortSignal) => {
    if (!account || signal?.aborted) return;
    const version = ++readVersion.current;
    setControlsLoading(true);
    setControlsError(null);
    try {
      const result = await account.getSettings({ signal });
      if (signal?.aborted || version !== readVersion.current) return;
      if (result.sessionId !== session.id) throw new Error("No pudimos validar tus preferencias.");
      setSettings(result);
    } catch (reason) {
      if (!signal?.aborted && version === readVersion.current) setControlsError(publicProductErrorMessage(reason, "No pudimos cargar tus preferencias."));
    } finally { if (!signal?.aborted && version === readVersion.current) setControlsLoading(false); }
  }, [account, session.id]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadSettings(controller.signal));
    return () => { controller.abort(); readVersion.current += 1; };
  }, [loadSettings]);
  useEffect(() => {
    if (!settings?.pausedUntil) return;
    const controller = new AbortController();
    const delay = Math.max(0, Date.parse(settings.pausedUntil) - Date.now());
    const timer = window.setTimeout(() => { void loadSettings(controller.signal); }, Math.min(delay + 100, 2_147_483_647));
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loadSettings, settings?.pausedUntil]);
  const savedSettings = (next: AccountSettings, message: string) => {
    readVersion.current += 1;
    setSettings(next);
    setControlsLoading(false);
    setControlsError(null);
    setNotice(message);
    setPanel(null);
  };
  const openControls = (next: "limits" | "pause") => { setPanel(next); void loadSettings(); };
  const whatsappUrl = accountWhatsAppUrl(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER);
  const initials = session.displayName.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "Q";
  const panelTitles: Record<AccountPanel, string> = {
    profile: "Mis datos", security: "Seguridad y acceso", whatsapp: "Contactar por WhatsApp",
    limits: "Autolímites", pause: "Pausa de juego",
  };
  const unavailable = <div className={styles.dialogStack}><p className={styles.dialogNote}>Esta opción no está disponible en este momento. Podés consultar con atención al cliente desde el Centro de ayuda.</p><Link className={shared.secondaryButton} href="/ayuda">Ir al centro de ayuda</Link></div>;
  const controlState = !account ? unavailable : controlsLoading ? <p className={styles.dialogNote} role="status">Cargando tus preferencias…</p> : controlsError || !settings ? <div className={styles.dialogStack}><div className={shared.errorBox} role="alert">{controlsError ?? "No pudimos cargar tus preferencias."}</div><button className={shared.secondaryButton} onClick={() => void loadSettings()} type="button">Reintentar</button></div> : null;
  const pauseLabel = settings?.pausedUntil ? `Pausa hasta ${new Intl.DateTimeFormat("es-PY", { timeStyle: "short", timeZone: "America/Asuncion" }).format(new Date(settings.pausedUntil))}` : "Pausá las jugadas de esta sesión";

  return <main className={styles.page}>
    <header className={styles.pageHeader}>
      <div><p className={styles.eyebrow}>TU ESPACIO</p><h1>Cuenta</h1><p className={styles.intro}>Tu perfil y las opciones de tu cuenta, en un solo lugar.</p></div>
      <span className={styles.sessionBadge}><span />Sesión iniciada</span>
    </header>

    <div className={styles.summaryGrid}>
      <section aria-labelledby="account-profile-name" className={styles.profileCard}>
        <div className={styles.profileHead}>
          <span aria-hidden="true" className={styles.avatar}>{initials}</span>
          <div className={styles.profileCopy}>
            <p className={styles.profileLabel}>{session.role === "ADMIN" ? "Sesión de operador" : "Mi perfil"}</p>
            <h2 id="account-profile-name">{session.displayName}</h2>
            <span className={styles.accountBadge}>{session.role === "ADMIN" ? "Cuenta de operador" : "Cuenta personal"}</span>
          </div>
        </div>
        <div className={styles.profileFooter}>
          <div><span className={styles.metaLabel}>ID de cuenta</span><span className={styles.accountId}>{session.id}</span></div>
          <button className={styles.profileLink} onClick={() => setPanel("profile")} type="button">Ver mis datos<Icon name="chevronRight" size={15} /></button>
        </div>
      </section>

      <section aria-labelledby="account-balance-title" className={styles.balanceCard}>
        <div className={styles.balanceHeader}><span id="account-balance-title"><Icon name="wallet" size={18} />Saldo disponible</span><span className={styles.currency}>{session.currency}</span></div>
        <p className={styles.balance}>{formatGs(session.balance)}</p>
        <p className={styles.balanceHint}>Disponible en tu cuenta</p>
        <Link className={styles.balanceLink} href="/saldos">Ver saldo y movimientos<Icon name="chevronRight" size={16} /></Link>
      </section>
    </div>

    {status ? <div className={shared.statusBox} role="status">{status}</div> : null}
    {gatewayError ? <div className={`${shared.errorBox} ${styles.gatewayError}`} role="alert">
      <p>{gatewayError}</p><button className={shared.quietButton} onClick={() => void refresh()} type="button">Reintentar actualización</button>
    </div> : null}

    <section aria-labelledby="account-options-title" className={styles.optionsCard}>
      <header className={styles.optionsHeader}><h2 id="account-options-title">Opciones de tu cuenta</h2><p>Todo lo que necesitás gestionar, acá.</p></header>
      <div className={styles.settingsGrid}>
        <div className={styles.optionGroup}>
          <h3 className={styles.groupTitle}>MI CUENTA</h3>
          <AccountMenuItem title="Mis datos" description="Consultá y actualizá tu nombre" icon="user" onClick={() => setPanel("profile")} />
          <AccountMenuItem title="Seguridad y acceso" description="Consultá cómo cuidar tu sesión" icon="settings" onClick={() => setPanel("security")} />
          <AccountMenuItem title="Mis jugadas" description="Tu historial y comprobantes" icon="ticket" href="/mis-jugadas" />
          <AccountMenuItem title="Saldo y movimientos" description="Revisá la actividad de tu saldo" icon="wallet" href="/saldos" />
        </div>
        <div className={styles.optionGroup}>
          <h3 className={styles.groupTitle}>AYUDA Y JUEGO RESPONSABLE</h3>
          <AccountMenuItem title="Contactar por WhatsApp" description={whatsappUrl ? "Escribinos para recibir ayuda" : "Canal de atención por habilitar"} icon="whatsapp" href={whatsappUrl ?? undefined} onClick={whatsappUrl ? undefined : () => setPanel("whatsapp")} whatsapp />
          <AccountMenuItem title="Autolímites" description={settings?.limits ? `${formatGs(settings.limits.daily)} al día · ${settings.limits.minutes} min por sesión` : "Definí tus límites de importe y tiempo"} icon="settings" onClick={() => openControls("limits")} />
          <AccountMenuItem title="Tomarme un descanso" description={pauseLabel} icon="moon" onClick={() => openControls("pause")} />
          <AccountMenuItem title="Centro de ayuda" description="Preguntas frecuentes sobre la quiniela" icon="info" href="/ayuda" />
        </div>
      </div>
      {notice ? <div className={styles.limitsNotice} role="status"><Icon name="check" size={18} /><p>{notice}</p></div> : null}
      <footer className={styles.sessionFooter}>
        <div className={styles.sessionCopy}><span className={styles.logoutIcon}><Icon name="arrowLeft" size={21} /></span><div><h3>Sesión</h3><p>Salí de tu cuenta en este navegador.</p></div></div>
        <button aria-busy={logoutPending} className={styles.logoutButton} disabled={logoutPending} onClick={() => void onLogout()} type="button"><Icon name="arrowLeft" size={18} />{logoutPending ? "Cerrando sesión…" : "Cerrar sesión"}</button>
        {logoutError ? <div className={`${shared.errorBox} ${styles.logoutError}`} ref={logoutErrorRef} role="alert" tabIndex={-1}>{logoutError}</div> : null}
      </footer>
    </section>

    <Modal open={panel !== null} onOpenChange={(open) => { if (!open) setPanel(null); }} title={panel ? panelTitles[panel] : "Cuenta"} size="md">
      {panel === "profile" ? <div className={styles.dialogStack}>
        <dl className={styles.profileDetails}>
          <div><dt>ID de cuenta</dt><dd>{session.id}</dd></div>
          <div><dt>Tipo de cuenta</dt><dd>{session.role === "ADMIN" ? "Cuenta de operador" : "Cuenta personal"}</dd></div>
          <div><dt>Perfil</dt><dd>{session.role === "ADMIN" ? "Operador" : "Personal"}</dd></div><div><dt>Moneda</dt><dd>{session.currency}</dd></div>
        </dl>
        {account ? <AccountProfileForm session={session} account={account} onSave={() => { setNotice("Tu nombre se actualizó correctamente."); setPanel(null); }} /> : <p className={styles.dialogNote}>Nombre: {session.displayName}. Para modificar tus datos, contactá con atención al cliente.</p>}
      </div> : null}
      {panel === "security" ? <div className={styles.dialogStack}>
        <div className={styles.infoPanel}><Icon name="user" size={22} /><div><h3>Sesión iniciada</h3><p>Estás usando tu cuenta en este navegador. Podés cerrar la sesión desde el final del bloque de Cuenta.</p></div></div>
        <p className={styles.dialogNote}>Nunca compartas tu contraseña ni códigos de acceso. Si usás un dispositivo compartido, cerrá la sesión al finalizar. Ante un problema de acceso, consultá al Centro de ayuda.</p>
        <Link className={shared.secondaryButton} href="/legal/privacidad">Consultar privacidad</Link>
      </div> : null}
      {panel === "whatsapp" ? <div className={styles.dialogStack}>
        <div className={`${styles.infoPanel} ${styles.whatsappPanel}`}><Icon name="whatsapp" size={30} /><div><h3>Estamos preparando este canal</h3><p>Todavía no hay un número de atención configurado. Mientras tanto, podés consultar nuestro centro de ayuda.</p></div></div>
        <p className={styles.dialogNote}>Por tu seguridad, nunca envíes contraseñas ni códigos de acceso por WhatsApp.</p>
        <Link className={shared.secondaryButton} href="/ayuda">Ir al centro de ayuda</Link>
      </div> : null}
      {panel === "limits" ? controlState ?? (account && settings ? <AccountLimitsForm saved={settings} account={account} onCancel={() => setPanel(null)} onSave={(next) => savedSettings(next, "Tus autolímites se guardaron y se aplican a las jugadas de esta sesión.")} /> : null) : null}
      {panel === "pause" ? controlState ?? (account ? <div className={styles.dialogStack}>{settings?.pausedUntil ? <p className={styles.dialogNote}>{pauseLabel}. Podés ampliar esta pausa, pero no acortarla.</p> : null}<AccountPauseForm account={account} onSave={(next) => savedSettings(next, "Pausa activada. Las nuevas jugadas y recargas de esta sesión están bloqueadas durante el período elegido.")} /></div> : null) : null}
    </Modal>
  </main>;
}
