"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Logo } from "@/components/ui/Logo";
import { getCountdown, LAUNCH_AT } from "@/lib/countdown";
import styles from "./screen.module.css";

const labels = ["DÍAS", "HORAS", "MINUTOS", "SEGUNDOS"];
const stages = [["gear", "Últimos ajustes"], ["check", "Pruebas finales"], ["rocket", "A producción"]];

export function CountdownScreen({ initialNow, mascot, audio }: {
  initialNow: number; mascot?: string; audio?: string;
}) {
  const [now, setNow] = useState(initialNow);
  const [sound, setSound] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
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

  return (
    <main className={`${styles.page} ${launched ? styles.launched : ""}`} data-testid="countdown-page">
      <div className={styles.art} aria-hidden="true">
        {mascot && <Image src={mascot} width={700} height={900} className={styles.mascot} alt="" priority />}
      </div>
      <div className={`${styles.confetti} ${burst ? styles.burst : ""}`} aria-hidden="true">
        {Array.from({ length: 44 }, (_, i) => <i key={i} style={{
          "--x": `${(i * 37 + 7) % 100}%`, "--delay": `${-(i % 11)}s`,
          "--duration": `${8 + i % 7}s`, "--rotation": `${i * 31}deg`,
        } as CSSProperties} />)}
      </div>
      <div className={styles.brand}><Logo size="lg" surface="light" /></div>
      <section className={styles.content} aria-labelledby="launch-title">
        <div className={styles.intro}>
          <p className={styles.eyebrow}><span /> 01 OCTUBRE 2026 · 00:00 PARAGUAY</p>
          <h1 id="launch-title" className={styles.title} aria-live="polite">
            {launched ? "¡YA ESTAMOS EN PRODUCCIÓN!" : "¡MUY PRONTO!"}
          </h1>
          {!launched && <p className={styles.subtitle}>Estamos a punto de salir a producción</p>}
        </div>
        {launched ? (
          <div className={styles.celebration}>
            <div className={styles.launchedLogo}><Logo size="lg" surface="light" /></div>
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
      </section>
      {audio && <>
        <audio ref={audioRef} src={audio} loop preload="none" />
        <button className={styles.sound} type="button" onClick={toggleAudio} aria-pressed={sound}
          aria-label={sound ? "Desactivar ambiente de celebración" : "Activar ambiente de celebración"}>
          {sound ? "🔊" : "🔇"}
        </button>
      </>}
    </main>
  );
}
