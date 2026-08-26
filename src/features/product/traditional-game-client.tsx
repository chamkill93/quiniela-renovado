"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PlayResponse } from "@/lib/product/api-types";
import type { TraditionalPlayRequest } from "@/lib/gaming/schemas";
import type { TraditionalGameDefinition } from "@/lib/gaming/types";
import {
  type ProductGame,
  type TraditionalGameId,
  formatGs,
  padNumber,
} from "@/lib/product/catalog";
import { useProduct } from "@/providers/product-provider";
import { AmountChip } from "./amount-chip";
import { TicketDialog } from "./ticket-dialog";
import { useSoundEffects } from "./use-sound-effects";
import styles from "./product.module.css";

function secureRandom(min: number, max: number) {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return min + (buffer[0] % (max - min + 1));
}

function formatDrawAt(value: string) {
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Asuncion",
  }).format(new Date(value));
}

function initialSelection(gameId: TraditionalGameId): Record<string, unknown> {
  if (gameId === "redoblona") return { head: "001", redoblona: "01", position: 2 };
  if (gameId === "megaloto") return { numbers: [1, 2, 3, 4, 5, 6] };
  if (gameId === "prizes" || gameId === "invert") return { number: "001", position: 2 };
  return { number: "001", position: 1 };
}

function buildTraditionalPlayInput(
  gameId: TraditionalGameId,
  amount: number,
  drawId: string,
  selection: Record<string, unknown>,
): TraditionalPlayRequest {
  if (gameId === "redoblona") {
    return {
      gameId,
      amount,
      drawId,
      selection: {
        head: String(selection.head ?? ""),
        redoblona: String(selection.redoblona ?? ""),
        position: Number(selection.position ?? 2),
      },
    };
  }
  if (gameId === "megaloto") {
    const numbers = Array.isArray(selection.numbers)
      ? selection.numbers.map(Number)
      : [];
    return {
      gameId,
      amount,
      drawId,
      selection: { numbers, modality: "MEGA_FULL" },
    };
  }
  if (gameId === "prizes" || gameId === "invert") {
    return {
      gameId,
      amount,
      drawId,
      selection: {
        number: String(selection.number ?? ""),
        position: Number(selection.position ?? 2),
      },
    };
  }
  return {
    gameId,
    amount,
    drawId,
    selection: { number: String(selection.number ?? "") },
  };
}

export function TraditionalGameClient({ game }: { game: ProductGame<TraditionalGameId> }) {
  const {
    requestPlay,
    catalog,
    session,
    loading,
    unauthorized,
    error: gatewayError,
    refresh,
  } = useProduct();
  const [selection, setSelection] = useState<Record<string, unknown>>(() => initialSelection(game.id));
  const [drawId, setDrawId] = useState<string>("");
  const [amount, setAmount] = useState<number>(10_000);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PlayResponse | null>(null);
  const playSound = useSoundEffects();
  const availableAmounts = catalog?.amounts ?? [];
  const remoteGame = catalog?.traditional.find(
    (definition) => definition.id === game.id,
  );
  const enabledGame = Boolean(remoteGame);
  const displayName = remoteGame?.name ?? (loading ? "Cargando juego…" : "Juego no disponible");
  const displayDescription = remoteGame?.description ?? "Esperando la definición habilitada por el backoffice.";
  const availableDraws = useMemo(() => {
    if (!catalog) return [];
    const definition = catalog.traditional.find((item) => item.id === game.id);
    if (!definition) return [];
    const allowed = new Set(definition.drawIds);
    return catalog.draws.filter((draw) => allowed.has(draw.id));
  }, [catalog, game.id]);
  const effectiveAmount = availableAmounts.includes(amount)
    ? amount
    : (availableAmounts[0] ?? 0);
  const effectiveDrawId = availableDraws.some((draw) => draw.id === drawId)
    ? drawId
    : (availableDraws[0]?.id ?? "");

  const update = (key: string, value: unknown) => setSelection((current) => ({ ...current, [key]: value }));

  const randomize = () => {
    if (game.id === "megaloto") {
      const numbers = new Set<number>();
      while (numbers.size < 6) numbers.add(secureRandom(1, 45));
      setSelection({ numbers: [...numbers].sort((a, b) => a - b) });
      return;
    }
    if (game.id === "redoblona") {
      setSelection({ head: padNumber(secureRandom(1, 999)), redoblona: padNumber(secureRandom(0, 99), 2), position: selection.position ?? 2 });
      return;
    }
    update("number", padNumber(secureRandom(1, 999)));
  };

  const submit = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    playSound("confirm");
    try {
      const data = await requestPlay({
        kind: "traditional",
        input: buildTraditionalPlayInput(
          game.id,
          effectiveAmount,
          effectiveDrawId,
          selection,
        ),
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
      <div><Link className={styles.textLink} href="/quinielas">← Volver a Quinielas</Link></div>
      <section className={styles.splitLayout}>
        <div className={styles.contentCard}>
          <p className={styles.eyebrow}>{game.eyebrow}</p>
          <h1 className={styles.title}>{displayName}</h1>
          <p className={styles.lede}>{displayDescription}</p>
          <div className={styles.formStack} style={{ marginTop: 28 }}>
            {remoteGame ? <TraditionalSelection definition={remoteGame} gameId={game.id} selection={selection} update={update} /> : null}
            <button className={styles.quietButton} onClick={randomize} type="button">Selección al azar</button>

            <div className={styles.fieldGroup}>
              <label htmlFor="draw">Sorteo</label>
              <select className={styles.select} id="draw" onChange={(event) => setDrawId(event.target.value)} value={effectiveDrawId}>
                {availableDraws.map((draw) => <option key={draw.id} value={draw.id}>{draw.label} · {formatDrawAt(draw.drawsAt)}</option>)}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Importe</span>
              <div className={styles.chipGrid}>
                {availableAmounts.map((value) => (
                  <AmountChip key={value} onSelect={setAmount} selected={effectiveAmount === value} value={value} />
                ))}
              </div>
            </div>
            {loading ? <div className={styles.loadingBar} aria-label="Cargando catálogo" /> : null}
            {catalog && !enabledGame ? <div className={styles.errorBox} role="alert">Este juego no está habilitado por el backoffice.</div> : null}
            {gatewayError ? <div className={styles.errorBox} role="alert"><p>{gatewayError}</p><button className={styles.quietButton} onClick={() => void refresh()} type="button">Reintentar conexión</button></div> : null}
            {!gatewayError && (unauthorized || (!loading && !session)) ? <div className={styles.errorBox} role="alert">Iniciá sesión para registrar una jugada. <Link className={styles.textLink} href="/cuenta">Ir a Cuenta</Link></div> : null}
            {error ? <div className={styles.errorBox} role="alert">{error}</div> : null}
            <button className={styles.primaryButton} disabled={pending || loading || Boolean(gatewayError) || !session || !enabledGame || !effectiveDrawId || availableAmounts.length === 0} onClick={submit} type="button">
              {pending ? "Confirmando…" : "Confirmar jugada"}
            </button>
          </div>
        </div>

        <aside className={styles.contentCard} aria-label="Resumen de jugada">
          <p className={styles.eyebrow}>Resumen</p>
          <dl className={styles.summaryList}>
            <div className={styles.summaryRow}><dt>Juego</dt><dd>{remoteGame?.name ?? "—"}</dd></div>
            <div className={styles.summaryRow}><dt>Sorteo</dt><dd>{availableDraws.find((draw) => draw.id === effectiveDrawId)?.label ?? "—"}</dd></div>
            <div className={styles.summaryRow}><dt>Selección</dt><dd>{summarizeSelection(selection)}</dd></div>
            <div className={styles.summaryRow}><dt>Importe</dt><dd>{formatGs(effectiveAmount)}</dd></div>
          </dl>
          <p className={styles.fieldHint} style={{ marginTop: 16 }}>Revisá los datos antes de confirmar. La aceptación final siempre ocurre en el servidor.</p>
        </aside>
      </section>
      {response ? <TicketDialog ticket={response.ticket} play={response.play} onClose={() => setResponse(null)} /> : null}
    </main>
  );
}

function TraditionalSelection({
  definition,
  gameId,
  selection,
  update,
}: {
  definition: TraditionalGameDefinition;
  gameId: TraditionalGameId;
  selection: Record<string, unknown>;
  update: (key: string, value: unknown) => void;
}) {
  const contract = definition.selection;
  if (gameId === "megaloto") {
    const numbers = selection.numbers as number[];
    const maxCount = contract.kind === "MEGALOTO" ? contract.count : 6;
    const toggle = (number: number) => {
      if (numbers.includes(number)) update("numbers", numbers.filter((value) => value !== number));
      else if (numbers.length < maxCount) update("numbers", [...numbers, number].sort((a, b) => a - b));
    };
    return (
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Elegí {contract.kind === "MEGALOTO" ? contract.count : 6} números del {contract.kind === "MEGALOTO" ? contract.min : 1} al {contract.kind === "MEGALOTO" ? contract.max : 45}</span>
        <div className={styles.chipGrid}>
          {Array.from({ length: contract.kind === "MEGALOTO" ? contract.max : 45 }, (_, index) => index + 1).map((number) => (
            <button
              aria-pressed={numbers.includes(number)}
              className={styles.chip}
              data-selected={numbers.includes(number)}
              key={number}
              onClick={() => toggle(number)}
              style={{ minWidth: 48, padding: 0 }}
              type="button"
            >
              {number}
            </button>
          ))}
        </div>
        <p className={styles.fieldHint}>{numbers.length}/{contract.kind === "MEGALOTO" ? contract.count : 6} seleccionados.</p>
      </div>
    );
  }

  if (gameId === "redoblona") {
    return (
      <>
        <NumberField id="head-number" label="Número de cabeza" digits={3} value={String(selection.head)} onChange={(value) => update("head", value)} />
        <NumberField id="double-number" label="Número redoblona" digits={2} value={String(selection.redoblona)} onChange={(value) => update("redoblona", value)} />
        <PositionField min={contract.kind === "REDOBLONA" ? contract.position.min : 2} max={contract.kind === "REDOBLONA" ? contract.position.max : 14} value={Number(selection.position)} onChange={(value) => update("position", value)} />
      </>
    );
  }

  return (
    <>
      <NumberField id="traditional-number" label="Número de tres cifras" digits={3} value={String(selection.number)} onChange={(value) => update("number", value)} />
      {gameId === "prizes" || gameId === "invert" ? (
        <PositionField min={contract.kind === "THREE_DIGIT" && contract.position ? contract.position.min : gameId === "invert" ? 1 : 2} max={contract.kind === "THREE_DIGIT" && contract.position ? contract.position.max : 14} value={Number(selection.position)} onChange={(value) => update("position", value)} />
      ) : null}
      {gameId === "invert" ? <p className={styles.fieldHint}>Vista por cifras: {String(selection.number).padStart(3, "0").split("").join(" · ")}</p> : null}
    </>
  );
}

function NumberField({ id, label, digits, value, onChange }: { id: string; label: string; digits: number; value: string; onChange: (value: string) => void }) {
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor={id}>{label}</label>
      <input
        className={`${styles.input} ${styles.numberInput}`}
        id={id}
        inputMode="numeric"
        maxLength={digits}
        onBlur={(event) => onChange(padNumber(event.target.value, digits))}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, digits))}
        type="text"
        value={value}
      />
    </div>
  );
}

function PositionField({ value, onChange, min = 2, max = 14 }: { value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor="position">Hasta la posición</label>
      <select className={styles.select} id="position" onChange={(event) => onChange(Number(event.target.value))} value={value}>
        {Array.from({ length: max - min + 1 }, (_, index) => index + min).map((position) => <option key={position} value={position}>{position}</option>)}
      </select>
    </div>
  );
}

function summarizeSelection(selection: Record<string, unknown>) {
  if (Array.isArray(selection.numbers)) return selection.numbers.join(" · ");
  if (selection.head) return `${selection.head} / ${selection.redoblona}`;
  return String(selection.number ?? "");
}
