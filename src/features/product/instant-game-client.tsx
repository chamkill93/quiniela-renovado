"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { InstantPlayRequest } from "@/lib/gaming/schemas";
import type { InstantGameDefinition } from "@/lib/gaming/types";
import type { PlayResponse } from "@/lib/product/api-types";
import { type InstantGameId, formatGs, padNumber, type ProductGame } from "@/lib/product/catalog";
import { publicProductErrorMessage } from "@/lib/product/public-error";
import { useProduct } from "@/providers/product-provider";
import { AmountChip } from "./amount-chip";
import { NumericReels } from "./numeric-reels";
import { ResultStateCard, resultVisualState } from "./result-state";
import {
  RemoteEmptyState,
  RemoteErrorState,
  RemoteLoadingState,
  RemoteUnauthorizedState,
} from "./remote-view-state";
import { useSoundEffects } from "./use-sound-effects";
import styles from "./product.module.css";

const INSTANT_AMOUNTS = new Set([500, 1_000, 2_000, 5_000, 10_000]);

function buildInitialSelection(gameId: InstantGameId) {
  if (gameId === "poa5" || gameId === "poa10") return ["001", "002", "003"];
  if (gameId === "sapyaite") return "000";
  if (gameId === "racha5") return "PAR";
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
  if (gameId === "racha5") {
    return { gameId, amount, selection: paritySelection(selection) };
  }
  if (gameId === "sapyaite") {
    return { gameId, amount, selection: padNumber(String(selection), 3) };
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
  if (gameId === "sapyaite" || gameId === "mbohapy") return [padNumber(selection as string)];
  return [];
}

function hasValidSelection(
  definition: InstantGameDefinition | undefined,
  selection: string | string[],
) {
  if (!definition) return false;
  const contract = definition.selection;
  if (contract.kind === "ENUM") {
    return typeof selection === "string" && contract.values.includes(selection);
  }
  if (contract.kind === "HUNDRED_RANGE") {
    return typeof selection === "string" && contract.values.some((option) => option.value === selection);
  }
  if (contract.kind === "UNIQUE_THREE_DIGIT_NUMBERS") {
    return Array.isArray(selection) &&
      selection.length === contract.count &&
      new Set(selection).size === selection.length &&
      selection.every((value) => {
        const numericValue = Number(value);
        return /^\d{3}$/.test(value) && numericValue >= contract.min && numericValue <= contract.max;
      });
  }
  if (Array.isArray(selection) || !new RegExp(`^\\d{${contract.width}}$`).test(selection)) {
    return false;
  }
  const numericValue = Number(selection);
  return numericValue >= contract.min && numericValue <= contract.max;
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
  const [resultPopoutOpen, setResultPopoutOpen] = useState(false);
  const resultPopoutTimer = useRef<number | null>(null);
  const playSound = useSoundEffects();
  const availableAmounts = useMemo(
    () => [...new Set((catalog?.amounts ?? []).filter((value) => INSTANT_AMOUNTS.has(value)))]
      .sort((left, right) => left - right),
    [catalog?.amounts],
  );
  const remoteGame = catalog?.instant.find(
    (definition) => definition.id === game.id,
  );
  const displayName = remoteGame?.name ?? (loading ? "Cargando juego…" : "Juego no disponible");
  const displayDescription = remoteGame?.description ?? "Esperando la información vigente del juego.";
  const effectiveAmount = availableAmounts.includes(amount)
    ? amount
    : (availableAmounts[0] ?? 0);
  const selectionIsValid = hasValidSelection(remoteGame, selection);

  const selectedNumbers = useMemo(() => selectedForMatches(game.id, selection), [game.id, selection]);
  const resultNumbers = useMemo(() => {
    if (!response) return [];
    if (response.play.resultNumbers?.length) return response.play.resultNumbers;
    if (response.play.result) return [response.play.result];
    return [];
  }, [response]);
  // La espera siempre se presenta como una sola máquina. Los juegos de cinco
  // y diez resultados se despliegan en grilla recién cuando llega la jugada.
  const previewResults = useMemo(() => [padNumber("137")], []);
  const visibleResults = response && resultNumbers.length ? resultNumbers : previewResults;
  const selectionLabel = Array.isArray(selection) ? selection.join(" · ") : selection;

  const clearResultPopoutTimer = useCallback(() => {
    if (resultPopoutTimer.current === null) return;
    window.clearTimeout(resultPopoutTimer.current);
    resultPopoutTimer.current = null;
  }, []);

  const dismissResultPopout = useCallback(() => {
    clearResultPopoutTimer();
    setResultPopoutOpen(false);
  }, [clearResultPopoutTimer]);

  const scheduleResultPopoutDismiss = useCallback(() => {
    clearResultPopoutTimer();
    resultPopoutTimer.current = window.setTimeout(() => {
      setResultPopoutOpen(false);
      resultPopoutTimer.current = null;
    }, 6_000);
  }, [clearResultPopoutTimer]);

  const resumeResultPopoutDismiss = useCallback((popout: HTMLElement) => {
    if (popout.matches(":hover") || popout.contains(document.activeElement)) return;
    scheduleResultPopoutDismiss();
  }, [scheduleResultPopoutDismiss]);

  useEffect(() => () => {
    clearResultPopoutTimer();
  }, [clearResultPopoutTimer]);

  const finishResult = useCallback(() => {
    setAnimationDone(true);
    setResultPopoutOpen(true);
    scheduleResultPopoutDismiss();
    const won = resultVisualState(response?.play.status ?? "PENDING") === "won";
    playSound(won ? "win" : "lose");
  }, [playSound, response?.play.status, scheduleResultPopoutDismiss]);

  const play = async () => {
    if (pending || !selectionIsValid) return;
    dismissResultPopout();
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
      setError(publicProductErrorMessage(reason, "No pudimos registrar la jugada."));
    } finally {
      setPending(false);
    }
  };

  if (!catalog) {
    let state = <RemoteEmptyState message="No pudimos verificar si este juego está habilitado." />;
    if (loading) state = <RemoteLoadingState label="Verificando los juegos disponibles…" />;
    else if (unauthorized) {
      state = <RemoteUnauthorizedState message="Iniciá sesión para consultar los juegos habilitados." />;
    } else if (gatewayError) {
      state = <RemoteErrorState message={gatewayError} onRetry={() => void refresh()} />;
    }

    return (
      <main className={`${styles.page} ${styles.pageStack} ${styles.instantPage}`}>
        <div className={styles.instantBackRow}>
          <Link className={styles.textLink} href="/quinielas">← Volver a Quiniela</Link>
        </div>
        {state}
      </main>
    );
  }

  if (!remoteGame) {
    return (
      <main className={`${styles.page} ${styles.pageStack} ${styles.instantPage}`}>
        <div className={styles.instantBackRow}>
          <Link className={styles.textLink} href="/quinielas">← Volver a Quiniela</Link>
        </div>
        <div className={styles.emptyState} data-testid="disabled-instant-game">
          <div>
            <h1>Juego no disponible</h1>
            <p>Este juego no está disponible en este momento.</p>
            <Link className={styles.primaryButton} href="/quinielas">
              Ver juegos disponibles
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${styles.page} ${styles.pageStack} ${styles.instantPage}`}>
      <div className={styles.instantBackRow}>
        <Link className={styles.textLink} href="/quinielas">← Volver a Quiniela</Link>
      </div>
      <section
        className={styles.instantGameShell}
        data-has-result={Boolean(response)}
        data-tone={game.tone}
      >
        <header className={styles.instantGameHeader}>
          <p className={styles.eyebrow}>{game.eyebrow}</p>
          <h1 className={styles.title}>{displayName}</h1>
          <p className={styles.lede}>{displayDescription}</p>
        </header>

        <div className={styles.instantReelArea} data-has-result={Boolean(response)}>
          <NumericReels
            continuous={!response}
            key={response?.play.id ?? "active-preview"}
            results={visibleResults}
            selectedNumbers={selectedNumbers}
            selectedParity={game.id === "racha5" ? selection as "PAR" | "IMPAR" : undefined}
            onComplete={response ? finishResult : undefined}
          />
        </div>

        <div
          aria-label="Panel de jugada"
          className={`${styles.contentCard} ${styles.instantFormCard}`}
          data-testid="instant-bet-panel"
          role="region"
        >
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
            {gatewayError ? <div className={styles.errorBox} role="alert"><p>{gatewayError}</p><button className={styles.quietButton} onClick={() => void refresh()} type="button">Reintentar conexión</button></div> : null}
            {!gatewayError && (unauthorized || (!loading && !session)) ? <div className={styles.errorBox} role="alert">Iniciá sesión para registrar una jugada. <Link className={styles.textLink} href="/cuenta">Ir a Cuenta</Link></div> : null}
            {error ? <div className={styles.errorBox} role="alert">{error}</div> : null}
            <button
              className={`${styles.primaryButton} ${styles.instantPlayButton}`}
              disabled={pending || Boolean(response && !animationDone) || loading || Boolean(gatewayError) || !session || availableAmounts.length === 0 || !selectionIsValid}
              onClick={play}
              type="button"
            >
              {pending ? "Registrando…" : "Jugar"}
            </button>
          </div>
        </div>
      </section>
      {response && animationDone && resultPopoutOpen ? (
        <div
          className={styles.instantResultPopout}
          data-result-popout="true"
          data-testid="instant-result-popout"
          onBlurCapture={(event) => resumeResultPopoutDismiss(event.currentTarget)}
          onFocusCapture={clearResultPopoutTimer}
          onMouseEnter={clearResultPopoutTimer}
          onMouseLeave={(event) => resumeResultPopoutDismiss(event.currentTarget)}
        >
          <ResultStateCard
            className={styles.instantResultCard}
            live
            status={response.play.status}
            description={
              resultVisualState(response.play.status) === "won"
                ? `Premio ${formatGs(response.play.prize ?? 0)}`
                : resultVisualState(response.play.status) === "lost"
                  ? "Intentá de nuevo"
                  : "Resultado confirmado"
            }
            meta={(
              <span>
                {typeof response.play.matches === "number"
                  ? `${response.play.matches} coincidencia${response.play.matches === 1 ? "" : "s"}`
                  : resultNumbers.join(" · ")}
              </span>
            )}
          />
          <button
            aria-label="Cerrar resultado"
            className={styles.instantResultClose}
            onClick={dismissResultPopout}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : null}
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
  const hint = `Ingresá ${digits === 1 ? "una cifra" : `${digits} cifras`} entre ${String(contract.min).padStart(digits, "0")} y ${String(contract.max).padStart(digits, "0")}.`;
  const value = selection as string;
  const valid = new RegExp(`^\\d{${digits}}$`).test(value) && Number(value) >= contract.min && Number(value) <= contract.max;
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor="instant-number">{label}</label>
      <input
        aria-describedby="instant-number-hint"
        aria-invalid={!valid}
        className={`${styles.input} ${styles.numberInput}`}
        id="instant-number"
        inputMode="numeric"
        maxLength={digits}
        onBlur={(event) => onChange(padNumber(event.target.value, digits))}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, digits))}
        type="text"
        value={value}
      />
      <p className={styles.fieldHint} id="instant-number-hint">{hint}</p>
    </div>
  );
}
