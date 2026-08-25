"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import ShinyText from "@/components/ShinyText";
import { Icon } from "@/components/Icon";
import { balances, megaloto } from "@/lib/data";
import { gsPlain } from "@/lib/format";

export default function MegalotoPage() {
  const [picked, setPicked] = useState<number[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  const toggle = (n: number) => {
    setPicked((p) => {
      if (p.includes(n)) return p.filter((x) => x !== n);
      if (p.length >= megaloto.pick) {
        toast.warning(`Ya elegiste ${megaloto.pick} números`, {
          description: "Sacá uno para cambiar tu jugada.",
        });
        return p;
      }
      return [...p, n];
    });
  };

  const quickPick = () => {
    const nums = new Set<number>();
    while (nums.size < megaloto.pick) {
      nums.add(1 + Math.floor(Math.random() * megaloto.max));
    }
    setPicked([...nums].sort((a, b) => a - b));
  };

  const ready = picked.length === megaloto.pick;

  if (confirmed) {
    return (
      <main className="relative z-10 mx-auto max-w-md px-3 pt-8 pb-10 sm:px-4 sm:pt-10">
        <div className="pop panel-glow px-5 py-7 text-center sm:px-8 sm:py-10">
          <div className="flex justify-center gap-1.5">
            {[...picked].sort((a, b) => a - b).map((n) => (
              <span key={n} className="ball size-10 text-[13px]">
                {String(n).padStart(2, "0")}
              </span>
            ))}
          </div>
          <h1 className="mt-5 font-display text-xl font-bold uppercase text-white">
            ¡Jugada confirmada!
          </h1>
          <p className="mt-2.5 text-sm font-medium text-cream/75">
            Estás participando del pozo de{" "}
            <span className="font-display font-bold text-brand-bright">{megaloto.jackpotLabel}</span>
            . Sorteo: {megaloto.drawLabel}. ¡Mucha suerte! 🍀
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              className="btn-cta w-full px-6 py-3 text-sm"
              onClick={() => {
                setPicked([]);
                setConfirmed(false);
              }}
            >
              Jugar de nuevo
            </button>
            <Link href="/" className="btn-ghost w-full px-6 py-2.5 text-[12px]">
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto max-w-xl px-3 pt-5 pb-10 sm:px-4 sm:pt-7 sm:pt-8">
      {/* header */}
      <div className="mt-1 text-center sm:mt-2">
        <h1 className="font-display text-[24px] font-black uppercase leading-none sm:text-5xl">
          <span className="bg-gradient-to-b from-white via-blush to-brand-soft bg-clip-text text-transparent [filter:drop-shadow(0_0_22px_rgba(238,28,44,0.5))]">
            Mega
          </span>{" "}
          <span className="text-brand-bright [text-shadow:0_0_26px_rgba(238,28,44,0.8)]">Loto</span>
        </h1>
        <p className="mt-1.5 font-display text-[8.5px] font-semibold uppercase tracking-label text-smoke sm:mt-2 sm:text-[10px]">
          Pozo acumulado
        </p>
        <ShinyText
          text={megaloto.jackpotLabel.toUpperCase()}
          speed={2.5}
          color="#ff8b93"
          shineColor="#ffffff"
          className="font-display text-xl font-bold sm:text-3xl"
        />
        <p className="mt-1 font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-soft">
          {megaloto.drawLabel} · ₲ {gsPlain(megaloto.price)} por jugada
        </p>
      </div>

      {/* picker */}
      <div className="panel-glow mt-3 px-3 py-3 sm:mt-5 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between">
          <p className="font-display text-[9px] font-semibold uppercase tracking-[0.14em] text-cream/70 sm:text-[10px]">
            Elegí {megaloto.pick} números
          </p>
          <span
            className={`rounded-full px-2.5 py-1 font-display text-[10px] font-bold tabular-nums ${
              ready ? "bg-win/15 text-win" : "bg-white/8 text-smoke"
            }`}
          >
            {picked.length}/{megaloto.pick}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-8 justify-items-center gap-1 sm:mt-4 sm:gap-2">
          {Array.from({ length: megaloto.max }, (_, i) => i + 1).map((n) => {
            const sel = picked.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggle(n)}
                aria-pressed={sel}
                className={`${
                  sel ? "ball" : "ball ball-ghost text-smoke/80 hover:text-white"
                } size-8 text-[10px] transition-transform active:scale-90 sm:size-11 sm:text-[13px]`}
              >
                {String(n).padStart(2, "0")}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2.5">
          <button type="button" onClick={quickPick} className="btn-ghost flex-1 py-2 text-[10.5px]">
            <Icon name="wand" size={14} />
            Al azar
          </button>
          <button
            type="button"
            onClick={() => setPicked([])}
            disabled={picked.length === 0}
            className="btn-ghost flex-1 py-2 text-[10.5px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="trash" size={14} />
            Limpiar
          </button>
        </div>
      </div>

      {/* selection + confirm */}
      <div className="mt-3 flex min-h-10 items-center justify-center gap-1 sm:mt-4 sm:min-h-12 sm:gap-1.5">
        {picked.length === 0 ? (
          <p className="text-[11px] font-semibold text-smoke/70 sm:text-[12px]">
            Tocá los números o jugá al azar ✨
          </p>
        ) : (
          [...picked]
            .sort((a, b) => a - b)
            .map((n) => (
              <span key={n} className="ball pop size-9 text-[11.5px] sm:size-11 sm:text-[13px]">
                {String(n).padStart(2, "0")}
              </span>
            ))
        )}
      </div>

      <div className="mt-3 text-center">
        <button
          type="button"
          disabled={!ready || balances.cargado + balances.ganado < megaloto.price}
          onClick={() => setConfirmed(true)}
          className={`btn-cta w-full max-w-sm px-10 py-3.5 text-sm ${ready ? "cta-pulse" : ""}`}
        >
          Confirmar · ₲ {gsPlain(megaloto.price)}
        </button>
        <p className="mt-2 text-[11px] font-semibold text-smoke/70">
          Se descuenta de tu saldo cargado.
        </p>
      </div>
    </main>
  );
}
