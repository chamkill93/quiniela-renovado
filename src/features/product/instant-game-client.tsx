"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PlayResponse } from "@/lib/product/api-types";
import { BET_AMOUNTS, type InstantGameId, formatGs, padNumber, type ProductGame } from "@/lib/product/catalog";
import { useProduct } from "@/providers/product-provider";
import { AmountChip } from "./amount-chip";
import { NumericReels } from "./numeric-reels";
import { TicketDialog } from "./ticket-dialog";
import { useSoundEffects } from "./use-sound-effects";
import styles from "./product.module.css";

const ENUM_OPTIONS: Partial<Record<InstantGameId, string[]>> = {
  sapyaite: ["PAR", "IMPAR"],
  pyae: ["MENOR", "MAYOR"],
  racha5: ["PAR", "IMPAR"],
};

function buildInitialSelection(gameId: InstantGameId) {
  if (gameId === "poa5" || gameId === "poa10") return ["001", "002", "003"];
  if (gameId === "sapyaite" || gameId === "racha5") return "PAR";
  if (gameId === "pyae") return "MENOR";
  if (gameId === "poa") return "001-099";
  if (gameId === "petei") return "0";
  if (gameId === "mokoi") return "00";
  return "001";
}

function normalizeSelection(gameId: InstantGameId, selection: string | string[]) {
  if (gameId === "poa5" || gameId === "poa10") {
    return { numbers: (selection as string[]).map((number) => padNumber(number)) };
  }
  if (gameId === "petei") return padNumber(selection as string, 1);
  if (gameId === "mokoi") return padNumber(selection as string, 2);
  if (gameId === "mbohapy") return padNumber(selection as string, 3);
  return selection;
}

function selectedForMatches(gameId: InstantGameId, selection: string | string[]) {
  if (gameId === "poa5" || gameId === "poa10") return (selection as string[]).map((number) => padNumber(number));
  if (gameId === "mbohapy") return [padNumber(selection as string)];
  return [];
}

export function InstantGameClient({ game }: { game: ProductGame<InstantGameId> }) {
  const { requestPlay } = useProduct();
  const [selection, setSelection] = useState<string | string[]>(() => buildInitialSelection(game.id));
  const [amount, setAmount] = useState<number>(10_000);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PlayResponse | null>(null);
  const [animationDone, setAnimationDone] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const countdownTimer = useRef<number | null>(null);
  const playSound = useSoundEffects();

  useEffect(() => () => {
    if (countdownTimer.current !== null) window.clearInterval(countdownTimer.current);
  }, []);

  const selectedNumbers = useMemo(() => selectedForMatches(game.id, selection), [game.id, selection]);
  const resultNumbers = useMemo(() => {
    if (!response) return [];
    if (response.play.resultNumbers?.length) return response.play.resultNumbers;
    if (response.play.result) return [response.play.result];
    return [];
  }, [response]);

  const startCountdown = useCallback(() => {
    setAnimationDone(true);
    const won = (response?.play.prize ?? 0) > 0;
    playSound(won ? "win" : "lose");
    setCountdown(5);
    let remaining = 5;
    if (countdownTimer.current !== null) window.clearInterval(countdownTimer.current);
    countdownTimer.current = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (countdownTimer.current !== null) window.clearInterval(countdownTimer.current);
        countdownTimer.current = null;
        setShowTicket(true);
      }
    }, 1000);
  }, [playSound, response?.play.prize]);

  const play = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    setResponse(null);
    setAnimationDone(false);
    setCountdown(null);
    setShowTicket(false);
    playSound("confirm");
    try {
      const data = await requestPlay("/api/mock/instant", {
        gameId: game.id,
        amount,
        selection: normalizeSelection(game.id, selection),
      });
      setResponse(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos registrar la jugada.");
    } finally {
      setPending(false);
    }
  };

  const closeTicket = useCallback(() => {
    if (countdownTimer.current !== null) window.clearInterval(countdownTimer.current);
    countdownTimer.current = null;
    setShowTicket(false);
    setResponse(null);
    setAnimationDone(false);
    setCountdown(null);
  }, []);

  return (
    <main className={`${styles.page} ${styles.pageStack}`}>
      <div>
        <Link className={styles.textLink} href="/instantaneas">← Volver a Instantáneas</Link>
      </div>
      <section className={styles.splitLayout}>
        <div className={styles.contentCard}>
          <p className={styles.eyebrow}>{game.eyebrow}</p>
          <h1 className={styles.title}>{game.name}</h1>
          <p className={styles.lede}>{game.description}</p>

          <div className={styles.formStack} style={{ marginTop: 28 }}>
            <SelectionControl gameId={game.id} selection={selection} onChange={setSelection} />
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Importe de la jugada</span>
              <div className={styles.chipGrid}>
                {BET_AMOUNTS.map((value) => (
                  <AmountChip
                    key={value}
                    onSelect={setAmount}
                    selected={amount === value}
                    value={value}
                  />
                ))}
              </div>
            </div>
            {error ? <div className={styles.errorBox} role="alert">{error}</div> : null}
            <button className={styles.primaryButton} disabled={pending || response !== null} onClick={play} type="button">
              {pending ? "Registrando…" : response ? "Jugada registrada" : "Jugar ahora"}
            </button>
            <p className={styles.fieldHint}>La jugada se registra una sola vez y el resultado se define antes de animar.</p>
          </div>
        </div>

        <aside className={styles.contentCard} aria-label="Resumen de la jugada">
          <p className={styles.eyebrow}>Tu selección</p>
          <dl className={styles.summaryList}>
            <div className={styles.summaryRow}><dt>Juego</dt><dd>{game.name}</dd></div>
            <div className={styles.summaryRow}><dt>Selección</dt><dd>{Array.isArray(selection) ? selection.join(" · ") : selection}</dd></div>
            <div className={styles.summaryRow}><dt>Importe</dt><dd>{formatGs(amount)}</dd></div>
            <div className={styles.summaryRow}><dt>Rodillos</dt><dd>{game.id === "poa10" ? 10 : game.id === "poa5" || game.id === "racha5" ? 5 : 1}</dd></div>
          </dl>
        </aside>
      </section>

      {response && resultNumbers.length ? (
        <section aria-labelledby="reel-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Resultado registrado</p>
              <h2 className={styles.sectionTitle} id="reel-title">Los rodillos están llegando a tu resultado</h2>
            </div>
          </div>
          <NumericReels
            results={resultNumbers}
            selectedNumbers={selectedNumbers}
            selectedParity={game.id === "racha5" || game.id === "sapyaite" ? selection as "PAR" | "IMPAR" : undefined}
            onComplete={startCountdown}
          />
          {animationDone ? (
            <div className={styles.resultPanel} aria-live="polite">
              <strong>{(response.play.prize ?? 0) > 0 ? `Premio ${formatGs(response.play.prize ?? 0)}` : "Resultado confirmado"}</strong>
              <span>{typeof response.play.matches === "number" ? `${response.play.matches} coincidencia${response.play.matches === 1 ? "" : "s"}` : resultNumbers.join(" · ")}</span>
              {countdown !== null && countdown > 0 ? (
                <span className={styles.countdown}>Comprobante en {countdown} s</span>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {showTicket && response ? (
        <TicketDialog ticket={response.ticket} play={response.play} onClose={closeTicket} />
      ) : null}
    </main>
  );
}

function SelectionControl({
  gameId,
  selection,
  onChange,
}: {
  gameId: InstantGameId;
  selection: string | string[];
  onChange: (value: string | string[]) => void;
}) {
  const options = ENUM_OPTIONS[gameId];
  if (options) {
    return (
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Tu elección</span>
        <div className={styles.chipGrid}>
          {options.map((option) => (
            <button className={styles.chip} data-selected={selection === option} key={option} onClick={() => onChange(option)} type="button">
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (gameId === "poa") {
    const hundreds = ["001-099", "100-199", "200-299", "300-399", "400-499", "500-599", "600-699", "700-799", "800-899", "900-999"];
    return (
      <div className={styles.fieldGroup}>
        <label htmlFor="hundred">Centena</label>
        <select className={styles.select} id="hundred" onChange={(event) => onChange(event.target.value)} value={selection as string}>
          {hundreds.map((hundred) => <option key={hundred} value={hundred}>{hundred}</option>)}
        </select>
      </div>
    );
  }

  if (gameId === "poa5" || gameId === "poa10") {
    const numbers = selection as string[];
    return (
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Tres números distintos</span>
        <div className={styles.chipGrid}>
          {numbers.map((number, index) => (
            <input
              aria-label={`Número ${index + 1}`}
              className={`${styles.input} ${styles.numberInput} ${styles.compactNumberInput}`}
              inputMode="numeric"
              key={index}
              maxLength={3}
              min={1}
              max={999}
              onBlur={(event) => {
                const next = [...numbers];
                next[index] = padNumber(event.target.value);
                onChange(next);
              }}
              onChange={(event) => {
                const next = [...numbers];
                next[index] = event.target.value.replace(/\D/g, "").slice(0, 3);
                onChange(next);
              }}
              type="text"
              value={number}
            />
          ))}
        </div>
        <p className={styles.fieldHint}>Cada valor debe estar entre 001 y 999 y no puede repetirse.</p>
      </div>
    );
  }

  const digits = gameId === "petei" ? 1 : gameId === "mokoi" ? 2 : 3;
  const label = gameId === "petei" ? "Última cifra" : gameId === "mokoi" ? "Últimas dos cifras" : "Número exacto";
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor="instant-number">{label}</label>
      <input
        className={`${styles.input} ${styles.numberInput}`}
        id="instant-number"
        inputMode="numeric"
        maxLength={digits}
        onBlur={(event) => onChange(padNumber(event.target.value, digits))}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, digits))}
        type="text"
        value={selection as string}
      />
    </div>
  );
}
