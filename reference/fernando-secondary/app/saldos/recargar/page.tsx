"use client";

import Link from "next/link";
import { useState } from "react";
import { SaldoTiles } from "@/components/SaldoTiles";
import { Icon } from "@/components/Icon";
import { paymentMethods } from "@/lib/data";
import { gsPlain } from "@/lib/format";

const MIN = 10000;
const MAX = 500000;

export default function RecargarPage() {
  const [monto, setMonto] = useState("");
  const [method, setMethod] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const value = parseInt(monto || "0", 10);
  const valid = value >= MIN && value <= MAX && method !== null;

  if (done) {
    const m = paymentMethods.find((p) => p.id === method);
    return (
      <main className="relative z-10 mx-auto max-w-md px-3 pt-8 pb-10 sm:px-4 sm:pt-10">
        <div className="pop panel-glow px-5 py-7 text-center sm:px-8 sm:py-10">
          <span className="ball mx-auto grid size-16 place-items-center text-2xl">✓</span>
          <h1 className="mt-5 font-display text-xl font-bold uppercase text-white">
            ¡Recarga iniciada!
          </h1>
          <p className="mt-2.5 text-sm font-medium text-cream/75">
            Vas a recargar{" "}
            <span className="font-display font-bold text-brand-bright">₲ {gsPlain(value)}</span> vía{" "}
            {m?.name}. Seguí las instrucciones para completar el pago.
          </p>
          <Link href="/saldos" className="btn-cta mt-6 w-full px-6 py-3 text-sm">
            Entendido
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto max-w-4xl px-3 pt-5 pb-10 sm:px-4 sm:pt-6">
      <div className="rise">
        <SaldoTiles />
      </div>

      <label htmlFor="monto" className="mt-4 block font-display text-[9.5px] font-semibold uppercase tracking-label text-brand-soft sm:mt-7 sm:text-[10px]">
        Monto a recargar
      </label>
      <div className="relative mt-1.5 sm:mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-lg font-extrabold text-brand-soft sm:left-5 sm:text-xl">
          ₲s.
        </span>
        <input
          id="monto"
          type="tel"
          inputMode="numeric"
          placeholder="0"
          value={monto ? gsPlain(value) : ""}
          onChange={(e) => setMonto(e.target.value.replace(/\D/g, "").slice(0, 7))}
          className="field-amount px-14 py-3 text-right text-2xl sm:px-16 sm:py-4 sm:text-3xl"
        />
      </div>
      <p className="mt-1.5 text-right text-[11px] font-bold text-smoke/70">
        Mínimo: ₲ {gsPlain(MIN)} · Máximo: ₲ {gsPlain(MAX)}
      </p>

      <div className="mt-3.5 flex flex-col gap-2 sm:mt-5 sm:gap-3">
        {paymentMethods.map((pm, i) => {
          const selected = method === pm.id;
          return (
            <button
              key={pm.id}
              type="button"
              onClick={() => setMethod(pm.id)}
              className={`panel rise rise-${i + 1} flex w-full items-center gap-3 px-4 py-2.5 text-left transition sm:gap-4 sm:px-5 sm:py-4 ${
                selected
                  ? "border-brand/60 shadow-[0_18px_44px_-18px_rgba(238,28,44,0.5)]"
                  : "hover:border-white/20"
              }`}
            >
              <span
                className={`grid size-9 flex-none place-items-center rounded-xl sm:size-10 ${
                  selected ? "text-white" : "bg-white/6 text-cream/75"
                }`}
                style={selected ? { background: "linear-gradient(160deg,#ff5a64,#a3121e)" } : undefined}
              >
                <Icon name={pm.icon} size={18} />
              </span>
              <span className="flex-1">
                <span className={`block text-[13px] font-extrabold sm:text-[14.5px] ${selected ? "text-brand-bright" : "text-white"}`}>
                  {pm.name}
                </span>
                {pm.note && <span className="block text-[10.5px] font-semibold text-smoke sm:text-[11.5px]">{pm.note}</span>}
                {pm.badges && (
                  <span className="mt-1 flex gap-1.5">
                    {pm.badges.map((b) => (
                      <span key={b} className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-cream/80">
                        {b}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span
                className={`grid size-6 flex-none place-items-center rounded-full border-2 transition ${
                  selected ? "border-brand-bright bg-brand text-white" : "border-white/25 text-transparent"
                }`}
              >
                <Icon name="check" size={13} strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="panel mt-3.5 flex items-center gap-3 px-4 py-2.5 sm:mt-5 sm:px-5 sm:py-3.5">
        <span className="text-brand-soft">
          <Icon name="info" size={16} />
        </span>
        <p className="text-[11.5px] font-semibold text-cream/80 sm:text-[12.5px]">
          También podés acercarte a recargar con tu{" "}
          <Link href="/puntos-recarga" className="font-bold text-brand-bright underline-offset-2 hover:underline">
            punto de recarga más cercano
          </Link>
          .
        </p>
      </div>

      <div className="mt-4 text-center sm:mt-6">
        <button
          type="button"
          disabled={!valid}
          onClick={() => setDone(true)}
          className="btn-cta w-full max-w-sm px-10 py-3 text-[13px] sm:py-3.5 sm:text-sm"
        >
          Continuar
        </button>
      </div>
    </main>
  );
}
