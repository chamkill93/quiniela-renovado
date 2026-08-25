"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { balances } from "@/lib/data";
import { gs, gsPlain } from "@/lib/format";

const MIN = 20000;

export default function RetirarPage() {
  const [monto, setMonto] = useState("");
  const [done, setDone] = useState(false);
  const value = parseInt(monto || "0", 10);
  const valid = value >= MIN && value <= balances.ganado;

  if (done) {
    return (
      <main className="relative z-10 mx-auto max-w-md px-3 pt-8 pb-10 sm:px-4 sm:pt-10">
        <div className="pop panel-glow px-5 py-7 text-center sm:px-8 sm:py-10">
          <span className="ball mx-auto grid size-16 place-items-center text-2xl">✓</span>
          <h1 className="mt-5 font-display text-2xl font-extrabold text-white">¡Retiro solicitado!</h1>
          <p className="mt-2 text-sm font-semibold text-cream/75">
            Tu retiro de <span className="font-display font-extrabold text-brand-bright">₲ {gsPlain(value)}</span> está en
            proceso. Te avisamos cuando esté acreditado.
          </p>
          <Link href="/saldos" className="btn-cta mt-6 w-full px-6 py-3 text-sm">
            Entendido
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto max-w-xl px-3 pt-5 pb-10 sm:px-4 sm:pt-6 sm:pt-7">
      <div
        className="corners mt-1 rounded-2xl border border-brand/45 px-5 py-3.5 text-center sm:mt-4 sm:px-6 sm:py-5"
        style={{
          background:
            "radial-gradient(240px 100px at 90% -20%, rgba(255,139,147,0.35), transparent 70%), linear-gradient(135deg, #8f1019 0%, #5e0a12 55%, #35060b 100%)",
        }}
      >
        <p className="font-display text-[9px] font-bold uppercase tracking-label text-brand-soft sm:text-[10.5px]">
          Disponible para retirar
        </p>
        <p className="font-display text-2xl font-extrabold text-white sm:text-3xl">{gs(balances.ganado)}</p>
        <p className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-brand-soft/70 sm:text-[11px]">
          Saldo ganado
        </p>
      </div>

      <label htmlFor="monto" className="mt-4 block font-display text-[9.5px] font-bold uppercase tracking-label text-brand-soft sm:mt-7 sm:text-[11px]">
        Monto a retirar
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
      <p className="mt-1.5 text-right text-[10px] font-bold text-smoke/70 sm:text-[11px]">Mínimo: ₲ {gsPlain(MIN)}</p>

      <div className="panel mt-3.5 flex items-center gap-3 px-4 py-2.5 sm:mt-5 sm:px-5 sm:py-3.5">
        <span className="text-brand-soft">
          <Icon name="info" size={16} />
        </span>
        <p className="text-[11.5px] font-semibold text-cream/80 sm:text-[12.5px]">
          Los retiros se acreditan en tu billetera o cuenta bancaria dentro de las 24 hs hábiles.
        </p>
      </div>

      <div className="mt-4 text-center sm:mt-6">
        <button
          type="button"
          disabled={!valid}
          onClick={() => setDone(true)}
          className="btn-cta w-full max-w-sm px-10 py-3 text-[13px] sm:py-3.5 sm:text-sm"
        >
          <Icon name="logout" size={17} />
          Retirar
        </button>
      </div>
    </main>
  );
}
