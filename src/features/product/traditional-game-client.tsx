"use client";

import { useState } from "react";
import Link from "next/link";
import type { PlayResponse } from "@/lib/product/api-types";
import {
  BET_AMOUNTS,
  MOCK_DRAWS,
  type ProductGame,
  type TraditionalGameId,
  formatGs,
  padNumber,
} from "@/lib/product/catalog";
import { useProduct } from "@/providers/product-provider";
import { TicketDialog } from "./ticket-dialog";
import { useSoundEffects } from "./use-sound-effects";
import styles from "./product.module.css";

function secureRandom(min: number, max: number) {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return min + (buffer[0] % (max - min + 1));
}

function initialSelection(gameId: TraditionalGameId): Record<string, unknown> {
  if (gameId === "redoblona") return { head: "001", redoblona: "01", position: 2 };
  if (gameId === "megaloto") return { numbers: [1, 2, 3, 4, 5, 6] };
  if (gameId === "prizes" || gameId === "invert") return { number: "001", position: 2 };
  return { number: "001", position: 1 };
}

export function TraditionalGameClient({ game }: { game: ProductGame<TraditionalGameId> }) {
  const { requestPlay } = useProduct();
  const [selection, setSelection] = useState<Record<string, unknown>>(() => initialSelection(game.id));
  const [drawId, setDrawId] = useState<string>(MOCK_DRAWS[0].id);
  const [amount, setAmount] = useState<number>(10_000);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PlayResponse | null>(null);
  const playSound = useSoundEffects();

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
      const data = await requestPlay("/api/mock/traditional", { gameId: game.id, amount, drawId, selection });
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
          <h1 className={styles.title}>{game.name}</h1>
          <p className={styles.lede}>{game.description}</p>
          <div className={styles.formStack} style={{ marginTop: 28 }}>
            <TraditionalSelection gameId={game.id} selection={selection} update={update} />
            <button className={styles.quietButton} onClick={randomize} type="button">Selección al azar</button>

            <div className={styles.fieldGroup}>
              <label htmlFor="draw">Sorteo</label>
              <select className={styles.select} id="draw" onChange={(event) => setDrawId(event.target.value)} value={drawId}>
                {MOCK_DRAWS.map((draw) => <option key={draw.id} value={draw.id}>{draw.label} · {draw.time}</option>)}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Importe</span>
              <div className={styles.chipGrid}>
                {BET_AMOUNTS.map((value) => (
                  <button className={styles.chip} data-selected={amount === value} key={value} onClick={() => setAmount(value)} type="button">
                    {formatGs(value).replace("Gs. ", "")}
                  </button>
                ))}
              </div>
            </div>
            {error ? <div className={styles.errorBox} role="alert">{error}</div> : null}
            <button className={styles.primaryButton} disabled={pending} onClick={submit} type="button">
              {pending ? "Confirmando…" : "Confirmar jugada"}
            </button>
          </div>
        </div>

        <aside className={styles.contentCard} aria-label="Resumen de jugada">
          <p className={styles.eyebrow}>Resumen</p>
          <dl className={styles.summaryList}>
            <div className={styles.summaryRow}><dt>Juego</dt><dd>{game.name}</dd></div>
            <div className={styles.summaryRow}><dt>Sorteo</dt><dd>{MOCK_DRAWS.find((draw) => draw.id === drawId)?.label}</dd></div>
            <div className={styles.summaryRow}><dt>Selección</dt><dd>{summarizeSelection(selection)}</dd></div>
            <div className={styles.summaryRow}><dt>Importe</dt><dd>{formatGs(amount)}</dd></div>
          </dl>
          <p className={styles.fieldHint} style={{ marginTop: 16 }}>Revisá los datos antes de confirmar. La aceptación final siempre ocurre en el servidor.</p>
        </aside>
      </section>
      {response ? <TicketDialog ticket={response.ticket} play={response.play} onClose={() => setResponse(null)} /> : null}
    </main>
  );
}

function TraditionalSelection({
  gameId,
  selection,
  update,
}: {
  gameId: TraditionalGameId;
  selection: Record<string, unknown>;
  update: (key: string, value: unknown) => void;
}) {
  if (gameId === "megaloto") {
    const numbers = selection.numbers as number[];
    const toggle = (number: number) => {
      if (numbers.includes(number)) update("numbers", numbers.filter((value) => value !== number));
      else if (numbers.length < 6) update("numbers", [...numbers, number].sort((a, b) => a - b));
    };
    return (
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Elegí 6 números del 1 al 45</span>
        <div className={styles.chipGrid}>
          {Array.from({ length: 45 }, (_, index) => index + 1).map((number) => (
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
        <p className={styles.fieldHint}>{numbers.length}/6 seleccionados.</p>
      </div>
    );
  }

  if (gameId === "redoblona") {
    return (
      <>
        <NumberField id="head-number" label="Número de cabeza" digits={3} value={String(selection.head)} onChange={(value) => update("head", value)} />
        <NumberField id="double-number" label="Número redoblona" digits={2} value={String(selection.redoblona)} onChange={(value) => update("redoblona", value)} />
        <PositionField value={Number(selection.position)} onChange={(value) => update("position", value)} />
      </>
    );
  }

  return (
    <>
      <NumberField id="traditional-number" label="Número de tres cifras" digits={3} value={String(selection.number)} onChange={(value) => update("number", value)} />
      {gameId === "prizes" || gameId === "invert" ? (
        <PositionField min={gameId === "invert" ? 1 : 2} value={Number(selection.position)} onChange={(value) => update("position", value)} />
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

function PositionField({ value, onChange, min = 2 }: { value: number; onChange: (value: number) => void; min?: 1 | 2 }) {
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor="position">Hasta la posición</label>
      <select className={styles.select} id="position" onChange={(event) => onChange(Number(event.target.value))} value={value}>
        {Array.from({ length: 15 - min }, (_, index) => index + min).map((position) => <option key={position} value={position}>{position}</option>)}
      </select>
    </div>
  );
}

function summarizeSelection(selection: Record<string, unknown>) {
  if (Array.isArray(selection.numbers)) return selection.numbers.join(" · ");
  if (selection.head) return `${selection.head} / ${selection.redoblona}`;
  return String(selection.number ?? "");
}
