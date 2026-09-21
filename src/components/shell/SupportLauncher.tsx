"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon, Logo } from "@/components/ui";
import { zendeskWidgetKey } from "@/lib/zendesk-config";
import styles from "./SupportLauncher.module.css";

type Zendesk = {
  (channel: "messenger:set", command: "locale", value: string): void;
  (channel: "messenger:set", command: "customization", value: object): void;
  (channel: "messenger", command: "render", value: object, callback: (error: Error | null) => void): void;
};

declare global {
  interface Window { zE?: Zendesk; zEMessenger?: { autorender: boolean } }
}
const subscribe = () => () => undefined;

export function SupportLauncher() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [load, setLoad] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    if (!load || status !== "loading") return;
    const timer = window.setTimeout(() => setStatus("error"), 20000);
    return () => window.clearTimeout(timer);
  }, [load, status]);

  function initialize() {
    const zendesk = window.zE;
    if (!zendesk || initialized.current) return;
    initialized.current = true;
    zendesk("messenger:set", "locale", "es");
    zendesk("messenger:set", "customization", {
      theme: {
        primary: "#e30613", onPrimary: "#ffffff", action: "#d80622", onAction: "#ffffff",
        background: "#ffffff", onBackground: "#20232b", message: "#e30613", onMessage: "#ffffff",
        businessMessage: "#f3f4f6", onBusinessMessage: "#20232b", onSecondaryAction: "#5b606c",
      },
      common: { hideHeader: true, contentScale: 100 },
      messageLog: { hideHeader: true, avatar: { hidden: true }, businessMessage: { bubbleMaxWidth: 88 } },
    });
    zendesk("messenger", "render", {
      mode: "embedded", widget: { targetElement: "#quinie-support-messenger" },
    }, (error) => {
      setStatus(error ? "error" : "ready");
      if (error) initialized.current = false;
    });
  }

  function close() { dialog.current?.close(); }

  return (
    <>
      <button
        ref={launcher}
        type="button"
        className={`q-icon-button q-support-button ${styles.trigger}`}
        data-testid="support-button"
        aria-label="Abrir soporte"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="quinie-support-dialog"
        title="Call center · quinie.LA"
        onClick={() => {
          // Set before loading the vendor script: no second floating launcher.
          window.zEMessenger = { autorender: false };
          setLoad(true);
          if (!zendeskWidgetKey) setStatus("error");
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        <Icon name="support" size={19} />
      </button>
      {load && zendeskWidgetKey ? <Script
        id="ze-snippet"
        src={`https://static.zdassets.com/ekr/snippet.js?key=${encodeURIComponent(zendeskWidgetKey)}`}
        strategy="afterInteractive"
        onReady={initialize}
        onError={() => setStatus("error")}
      /> : null}
      {mounted ? createPortal(
        <dialog
          ref={dialog}
          id="quinie-support-dialog"
          className={styles.panel}
          aria-labelledby="quinie-support-title"
          onClick={(event) => { if (event.target === dialog.current) close(); }}
          onClose={() => { setOpen(false); launcher.current?.focus(); }}
        >
          <div className={styles.content}>
            <header className={styles.header}>
              <div className={styles.brand}><Logo size="sm" surface="dark" /></div>
              <div className={styles.heading}>
                <span className={styles.eyebrow}>ESTAMOS PARA AYUDARTE</span>
                <h2 id="quinie-support-title">Atención al jugador</h2>
                <span className={styles.subtitle}>Call center · quinie.LA</span>
              </div>
              <button type="button" className={styles.close} onClick={close} aria-label="Cerrar chat">
                <Icon name="close" size={19} />
              </button>
            </header>
            <div className={styles.intro}><Icon name="support" size={18} /><span>Contanos cómo podemos ayudarte.</span></div>
            <div className={styles.body}>
              <div id="quinie-support-messenger" className={styles.messenger} />
              {status !== "ready" ? <div className={styles.feedback} role="status">
                {status === "loading" ? <><span className={styles.spinner} /><strong>Conectando con atención…</strong><span>En un momento vas a poder escribirnos.</span></> : <>
                  <Icon name="support" size={28} /><strong>No pudimos cargar el chat</strong><span>Podés volver a intentar o visitar el centro de ayuda.</span>
                  <button type="button" onClick={() => { setStatus("loading"); initialized.current = false; if (window.zE) initialize(); else window.location.reload(); }}>Volver a intentar</button>
                  <Link href="/ayuda" onClick={close}>Ir al centro de ayuda</Link>
                </>}
              </div> : null}
            </div>
          </div>
        </dialog>, document.body,
      ) : null}
    </>
  );
}
