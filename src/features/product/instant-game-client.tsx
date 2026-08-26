"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { InstantPlayRequest } from "@/lib/gaming/schemas";
import type { InstantGameDefinition } from "@/lib/gaming/types";
import type { PlayResponse } from "@/lib/product/api-types";
import { type InstantGameId, formatGs, padNumber, type ProductGame } from "@/lib/product/catalog";
import { useProduct } from "@/providers/product-provider";
import { AmountChip } from "./amount-chip";
import { NumericReels, type ReelVariant } from "./numeric-reels";
import { ResultStateCard, resultVisualState } from "./result-state";
import { useSoundEffects } from "./use-sound-effects";
import styles from "./product.module.css";

const INSTANT_AMOUNTS = new Set([500, 1_000, 2_000, 5_000, 10_000]);

function buildInitialSelection(gameId: InstantGameId) {
  if (gameId === "poa5" || gameId === "poa10") return ["001", "002", "003"];
  if (gameId === "sapyaite" || gameId === "racha5") return "PAR";
  if (gameId === "pyae") return "MENOR";
  if (gameId === "poa") return "001-099";
  if (gameId === "petei") return "0";
  if (gameId === "mokoi") return "00";
  return "001";
}

function paritySelection(value: string | string[]) {
  if (value === "IMPAR") return "IMPAR" as const;
  return "PAR" as const;
}

function hundredRangeSelection(value: string | string[]) {
  switch (value) {
    case "100-199":
    case "200-299":
    case "300-399":
    case "400-499":
    case "500-599":
    case "600-699":
    case "700-799":
    case "800-899":
    case "900-999":
      return value;
    default:
      return "001-099" as const;
  }
}

function buildInstantPlayInput(
  gameId: InstantGameId,
  amount: number,
  selection: string | string[],
): InstantPlayRequest {
  if (gameId === "sapyaite" || gameId === "racha5") {
    return { gameId, amount, selection: paritySelection(selection) };
  }
  if (gameId === "poa") {
    return { gameId, amount, selection: hundredRangeSelection(selection) };
  }
  if (gameId === "pyae") {
    return {
      gameId,
      amount,
      selection: selection === "MAYOR" ? "MAYOR" : "MENOR",
    };
  }
  if (gameId === "petei") {
    return { gameId, amount, selection: padNumber(String(selection), 1) };
  }
  if (gameId === "mokoi") {
    return { gameId, amount, selection: padNumber(String(selection), 2) };
  }
  if (gameId === "mbohapy") {
    return { gameId, amount, selection: padNumber(String(selection), 3) };
  }
  const numbers = Array.isArray(selection)
    ? selection.map((number) => padNumber(number))
    : [];
  if (gameId === "poa5") {
    return { gameId, amount, selection: { numbers } };
  }
  return { gameId: "poa10", amount, selection: { numbers } };
}

function selectedForMatches(gameId: InstantGameId, selection: string | string[]) {
  if (gameId === "poa5" || gameId === "poa10") return (selection as string[]).map((number) => padNumber(number));
  if (gameId === "mbohapy") return [padNumber(selection as string)];
  return [];
}

function reelVariantFor(gameId: InstantGameId): ReelVariant {
  if (gameId === "poa" || gameId === "petei") return "light";
  if (gameId === "pyae" || gameId === "mokoi" || gameId === "poa10") {
    return "neon";
  }
  if (gameId === "mbohapy" || gameId === "poa5") return "gold";
  return "classic";
}

export function InstantGameClient({ game }: { game: ProductGame<InstantGameId> }) {
  const {
    requestPlay,
    catalog,
    session,
    loading,
    unauthorized,
    error: gatewayError,
    refresh,
  } = useProduct();
  const [selection, setSelection] = useState<string | string[]>(() => buildInitialSelection(game.id));
  const [amount, setAmount] = useState<number>(10_000);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PlayResponse | null>(null);
  const [animationDone, setAnimationDone] = useState(false);
  const playSound = useSoundEffects();
  const availableAmounts = useMemo(
    () => [...new Set((catalog?.amounts ?? []).filter((value) => INSTANT_AMOUNTS.has(value)))]
      .sort((left, right) => left - right),
    [catalog?.amounts],
  );
  const remoteGame = catalog?.instant.find(
    (definition) => definition.id === game.id,
  );
  const enabledGame = Boolean(remoteGame);
  const displayName = remoteGame?.name ?? (loading ? "Cargando juego…" : "Juego no disponible");
  const displayDescription = remoteGame?.description ?? "Esperando la definición habilitada por el backoffice.";
  const effectiveAmount = availableAmounts.includes(amount)
    ? amount
    : (availableAmounts[0] ?? 0);

  const selectedNumbers = useMemo(() => selectedForMatches(game.id, selection), [game.id, selection]);
  const resultNumbers = useMemo(() => {
    if (!response) return [];
    if (response.play.resultNumbers?.length) return response.play.resultNumbers;
    if (response.play.result) return [response.play.result];
    return [];
  }, [response]);
  const previewResults = useMemo(
    () => Array.from({ length: remoteGame?.reels ?? 1 }, (_, index) => padNumber(String((index + 1) * 137))),
    [remoteGame?.reels],
  );
  const visibleResults = response && resultNumbers.length ? resultNumbers : previewResults;
  const selectionLabel = Array.isArray(selection) ? selection.join(" · ") : selection;

  const finishResult = useCallback(() => {
    setAnimationDone(true);
    const won = resultVisualState(response?.play.status ?? "PENDING") === "won";
    playSound(won ? "win" : "lose");
  }, [playSound, response?.play.status]);

  const play = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    setResponse(null);
    setAnimationDone(false);
    playSound("confirm");
    try {
      const data = await requestPlay({
        kind: "instant",
        input: buildInstantPlayInput(game.id, effectiveAmount, selection),
      });
      setResponse(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos registrar la jugada.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className={`${styles.page} ${styles.pageStack}`}>
      <div>
        <Link className={styles.textLink} href="/instantaneas">← Volver a Instantáneas</Link>
      </div>
      <section className={styles.instantGameShell}>
        <header className={styles.instantGameHeader}>
          <p className={styles.eyebrow}>{game.eyebrow}</p>
          <h1 className={styles.title}>{displayName}</h1>
          <p className={styles.lede}>{displayDescription}</p>
        </header>

        <div className={styles.instantReelArea}>
          <NumericReels
            continuous={!response}
            key={response?.play.id ?? "active-preview"}
            results={visibleResults}
            selectedNumbers={selectedNumbers}
            selectedParity={game.id === "racha5" || game.id === "sapyaite" ? selection as "PAR" | "IMPAR" : undefined}
            variant={reelVariantFor(game.id)}
            onComplete={response ? finishResult : undefined}
          />
          {response ? (
            <ResultStateCard
              live
              status={animationDone ? response.play.status : "PENDING"}
              description={
                !animationDone
                  ? "Presentando el resultado confirmado…"
                  : resultVisualState(response.play.status) === "won"
                    ? `Premio ${formatGs(response.play.prize ?? 0)}`
                    : resultVisualState(response.play.status) === "lost"
                      ? "Intentá de nuevo"
                      : "Resultado confirmado"
              }
              meta={
                animationDone ? (
                  <span>
                    {typeof response.play.matches === "number"
                      ? `${response.play.matches} coincidencia${response.play.matches === 1 ? "" : "s"}`
                      : resultNumbers.join(" · ")}
                  </span>
                ) : null
              }
            />
          ) : null}
        </div>

        <div className={`${styles.contentCard} ${styles.instantFormCard}`}>
          <div className={`${styles.formStack} ${styles.instantFormStack}`}>
            <SelectionControl definition={remoteGame} gameId={game.id} selection={selection} onChange={setSelection} />
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Elegí el importe</span>
              <div className={`${styles.chipGrid} ${styles.instantAmountGrid}`}>
                {availableAmounts.map((value) => (
                  <AmountChip
                    key={value}
                    onSelect={setAmount}
                    selected={effectiveAmount === value}
                    value={value}
                  />
                ))}
              </div>
            </div>
            <div className={styles.instantSelectionSummary} aria-label="Resumen de la selección">
              <span>
                Selección
                <strong>{selectionLabel}</strong>
              </span>
              <span>
                Importe
                <strong>{formatGs(effectiveAmount)}</strong>
              </span>
            </div>
            {loading ? <div className={styles.loadingBar} aria-label="Cargando catálogo" /> : null}
            {catalog && !enabledGame ? <div className={styles.errorBox} role="alert">Este juego no está habilitado por el backoffice.</div> : null}
            {gatewayError ? <div className={styles.errorBox} role="alert"><p>{gatewayError}</p><button className={styles.quietButton} onClick={() => void refresh()} type="button">Reintentar conexión</button></div> : null}
            {!gatewayError && (unauthorized || (!loading && !session)) ? <div className={styles.errorBox} role="alert">Iniciá sesión para registrar una jugada. <Link className={styles.textLink} href="/cuenta">Ir a Cuenta</Link></div> : null}
            {error ? <div className={styles.errorBox} role="alert">{error}</div> : null}
            <button
              className={`${styles.primaryButton} ${styles.instantPlayButton}`}
              disabled={pending || Boolean(response && !animationDone) || loading || Boolean(gatewayError) || !session || !enabledGame || availableAmounts.length === 0}
              onClick={play}
              type="button"
            >
              {pending ? "Registrando…" : "Jugar"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function SelectionControl({
  definition,
  gameId,
  selection,
  onChange,
}: {
  definition: InstantGameDefinition | undefined;
  gameId: InstantGameId;
  selection: string | string[];
  onChange: (value: string | string[]) => void;
}) {
  if (!definition) return null;
  const contract = definition.selection;
  if (contract.kind === "ENUM") {
    return (
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Tu elección</span>
        <div className={styles.chipGrid}>
          {contract.values.map((option) => (
            <button className={styles.chip} data-selected={selection === option} key={option} onClick={() => onChange(option)} type="button">
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (contract.kind === "HUNDRED_RANGE") {
    return (
      <div className={styles.fieldGroup}>
        <label htmlFor="hundred">Centena</label>
        <select className={styles.select} id="hundred" onChange={(event) => onChange(event.target.value)} value={selection as string}>
          {contract.values.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
    );
  }

  if (contract.kind === "UNIQUE_THREE_DIGIT_NUMBERS") {
    const numbers = selection as string[];
    return (
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>{contract.count} números distintos</span>
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
        <p className={styles.fieldHint}>Cada valor debe estar entre {padNumber(contract.min)} y {padNumber(contract.max)} y no puede repetirse.</p>
      </div>
    );
  }

  const digits = contract.width;
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
