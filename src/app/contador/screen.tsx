"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Logo } from "@/components/ui/Logo";
import { getCountdown, LAUNCH_AT } from "@/lib/countdown";
import styles from "./screen.module.css";

const labels = ["DÍAS", "HORAS", "MINUTOS", "SEGUNDOS"];
const stages = [["gear", "Últimos ajustes"], ["check", "Pruebas finales"], ["rocket", "A producción"]];
const HOUR_IN_MS = 60 * 60 * 1000;

export function CountdownScreen({ initialNow, deploymentVersion = "development", audio, siren }: {
  initialNow: number; deploymentVersion?: string; audio?: string; siren?: string;
}) {
  const [now, setNow] = useState(initialNow);
  const [sound, setSound] = useState(false);
  const [hourlySirenEnabled, setHourlySirenEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const sirenRef = useRef<HTMLAudioElement>(null);
  const hourlySirenEnabledRef = useRef(false);
  const previousRemainingMs = useRef(LAUNCH_AT - initialNow);
  useEffect(() => {
    let refreshing = false;
    const checkDeployment = async () => {
      if (refreshing || document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/contador-version", { cache: "no-store" });
        if (!response.ok) return;
        const latest = await response.json() as { version?: unknown };
        if (typeof latest.version === "string" && latest.version && latest.version !== deploymentVersion) {
          refreshing = true;
          window.location.reload();
        }
      } catch {
        // Retry on the next interval or when the visitor returns to the tab.
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkDeployment();
    };
    void checkDeployment();
    const timer = window.setInterval(checkDeployment, 30_000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [deploymentVersion]);

  useEffect(() => {
    const update = () => {
      const currentNow = Date.now();
      const remainingMs = LAUNCH_AT - currentNow;
      const previousMs = previousRemainingMs.current;
      previousRemainingMs.current = remainingMs;
      setNow(currentNow);

      if (!hourlySirenEnabledRef.current || remainingMs <= 0 || previousMs <= remainingMs || previousMs <= 0) return;
      if (Math.ceil(previousMs / HOUR_IN_MS) <= Math.ceil(remainingMs / HOUR_IN_MS)) return;

      const player = sirenRef.current;
      if (!player) return;
      player.currentTime = 0;
      void player.play().catch(() => {
        hourlySirenEnabledRef.current = false;
        setHourlySirenEnabled(false);
      });
    };
    const timer = window.setInterval(update, 250);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pageshow", update);
    };
  }, []);
  const { launched, values } = getCountdown(now);
  const burst = launched && now < Math.max(initialNow, LAUNCH_AT) + 10_000;

  async function toggleAudio() {
    const player = audioRef.current;
    if (!player) return;
    if (sound) { player.pause(); setSound(false); }
    else {
      try { await player.play(); setSound(true); }
      catch { setSound(false); }
    }
  }

  function toggleHourlySiren() {
    const nextEnabled = !hourlySirenEnabledRef.current;
    hourlySirenEnabledRef.current = nextEnabled;
    previousRemainingMs.current = LAUNCH_AT - Date.now();
    setHourlySirenEnabled(nextEnabled);
    if (!nextEnabled && sirenRef.current) {
      sirenRef.current.pause();
      sirenRef.current.currentTime = 0;
    }
  }

  return (
    <main className={`${styles.page} ${launched ? styles.launched : ""}`} data-testid="countdown-page">
      <div className={styles.art} aria-hidden="true" />
      <div className={`${styles.confetti} ${burst ? styles.burst : ""}`} aria-hidden="true">
        {Array.from({ length: 44 }, (_, i) => <i key={i} style={{
          "--x": `${(i * 37 + 7) % 100}%`, "--delay": `${-(i % 11)}s`,
          "--duration": `${8 + i % 7}s`, "--rotation": `${i * 31}deg`,
        } as CSSProperties} />)}
      </div>
      <div className={styles.brand}><Logo size="lg" surface="dark" /></div>
      <section className={styles.content} aria-labelledby="launch-title">
        <div className={styles.intro}>
          <p className={styles.eyebrow}><span /> 02 OCTUBRE 2026 · 01:00 PARAGUAY</p>
          <h1 id="launch-title" className={styles.title} aria-live="polite">
            {launched ? "¡YA ESTAMOS EN PRODUCCIÓN!" : "¡MUY PRONTO!"}
          </h1>
          {!launched && <p className={styles.subtitle}>Estamos a punto de salir a producción</p>}
        </div>
        {launched ? (
          <div className={styles.celebration}>
            <div className={styles.launchedLogo}><Logo size="lg" surface="dark" /></div>
            <p>¡Felicitaciones equipo!</p>
            <span>Lo hicimos juntos.</span>
          </div>
        ) : (
          <div className={styles.timer} role="timer" aria-label="Tiempo restante para el lanzamiento" aria-live="off">
            {values.map((value, index) => <div className={styles.card} key={labels[index]}>
              <span className={styles.digit} key={value}>{String(value).padStart(2, "0")}</span>
              <span className={styles.label}>{labels[index]}</span>
            </div>)}
          </div>
        )}
        <div className={styles.message}>
          {!launched && <><h2>¡Vamos equipo!</h2><p>Cada segundo nos acerca al lanzamiento de Quinie.LA.</p></>}
          {launched && <p>Un gran comienzo. Un gran equipo.</p>}
        </div>
        <div className={styles.stages} aria-label="Etapas del lanzamiento">
          {stages.map(([icon, label], index) => <span key={icon} className={index === 2 ? styles.active : undefined}>
            <Image src={`/assets/contador/icons/${icon}.svg`} width={18} height={18} alt="" />
            {index === 2 && launched ? "En producción" : label}
          </span>)}
        </div>
        <div className={styles.socials}>
          <p>Seguinos en redes</p>
          <div className={styles.socialLinks}>
            <a href="https://www.instagram.com/quinie.la_py/" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
              <span>Instagram</span><strong>@quinie.la_py</strong>
            </a>
            <a href="https://www.facebook.com/profile.php?id=61588186543333" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 22v-9h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.4A25 25 0 0 0 15 1c-3 0-5 1.8-5 5v3H7v4h3v9z"/></svg>
              <span>Facebook</span><strong>Quinie.LA</strong>
            </a>
            <a href="https://www.quinie.la/" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/></svg>
              <span>Nuestra página oficial</span><strong>quinie.la</strong>
            </a>
          </div>
        </div>
      </section>
      {audio && <>
        <audio ref={audioRef} src={audio} loop preload="none" />
        <button className={styles.sound} type="button" onClick={toggleAudio} aria-pressed={sound}
          aria-label={sound ? "Desactivar ambiente de celebración" : "Activar ambiente de celebración"}>
          {sound ? "🔊" : "🔇"}
        </button>
      </>}
      {siren && <>
        <audio ref={sirenRef} src={siren} preload="auto" />
        <button className={styles.hourlySiren} type="button" onClick={toggleHourlySiren} aria-pressed={hourlySirenEnabled}
          aria-label={hourlySirenEnabled ? "Desactivar sirena en cada hora restante" : "Activar sirena en cada hora restante"}
          title="Suena al llegar a cada hora exacta que falta para el lanzamiento">
          <span aria-hidden="true">{hourlySirenEnabled ? "🔔" : "🔕"}</span>
          {hourlySirenEnabled ? "Sirena por hora activada" : "Activar sirena por hora"}
        </button>
      </>}
    </main>
  );
}
