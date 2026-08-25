"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { puntos } from "@/lib/data";

export default function PuntosRecargaPage() {
  const [query, setQuery] = useState("");
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const visible = useMemo(
    () =>
      puntos
        .map((p, i) => ({ ...p, idx: i }))
        .filter((p) => (soloDisponibles ? p.open : true))
        .filter((p) =>
          query
            ? (p.name + " " + p.address + " " + p.zone).toLowerCase().includes(query.toLowerCase())
            : true
        ),
    [query, soloDisponibles]
  );

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-3 pt-5 pb-10 sm:px-4 sm:pt-6 sm:pt-7">
      {/* search + filter */}
      <div className="flex gap-2 sm:gap-3">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-smoke sm:left-4">
            <Icon name="search" size={16} />
          </span>
          <input
            type="text"
            placeholder="Buscar punto…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="field py-2.5 pl-10 pr-3 text-[12px] sm:py-3 sm:pl-11 sm:pr-4 sm:text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setSoloDisponibles((v) => !v)}
          className={`flex-none rounded-xl px-4 font-display text-[11px] font-extrabold uppercase tracking-[0.12em] transition ${
            soloDisponibles
              ? "bg-brand text-white shadow-[0_10px_24px_-10px_rgba(238,28,44,0.8)]"
              : "border border-line bg-white/5 text-cream/70 hover:text-white"
          }`}
        >
          Solo disponibles
        </button>
      </div>

      {/* stylised map */}
      <div
        className="relative mt-2 h-[180px] overflow-hidden rounded-2xl border border-line sm:mt-3 sm:h-[340px]"
        style={{
          background:
            "radial-gradient(500px 260px at 30% 20%, rgba(238,28,44,0.1), transparent 60%), linear-gradient(160deg, #171013 0%, #0c080a 100%)",
        }}
      >
        {/* grid streets */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "52px 52px",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              "linear-gradient(35deg, transparent 48%, rgba(255,255,255,0.7) 49%, rgba(255,255,255,0.7) 51%, transparent 52%)",
            backgroundSize: "220px 220px",
          }}
        />

        {puntos.map((p, i) => {
          const hidden = (soloDisponibles && !p.open) || (query && !visible.some((v) => v.idx === i));
          if (hidden) return null;
          const isSel = selected === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(isSel ? null : i)}
              className="absolute -translate-x-1/2 -translate-y-full transition-transform hover:scale-110"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              aria-label={p.name}
            >
              <span
                className={`grid size-8 place-items-center rounded-full text-white shadow-[0_8px_20px_-6px_rgba(0,0,0,0.8)] ${isSel ? "scale-125" : ""}`}
                style={{
                  background:
                    p.type === "cajero"
                      ? "linear-gradient(160deg,#ff5a64,#a3121e)"
                      : "linear-gradient(160deg,#fdfdfd,#c9c2c4)",
                  color: p.type === "cajero" ? "#fff" : "#a3121e",
                }}
              >
                <Icon name="pin" size={16} strokeWidth={2.3} />
              </span>
              {isSel && (
                <span className="pop absolute left-1/2 top-full z-20 mt-1.5 w-44 -translate-x-1/2 rounded-xl border border-brand/40 bg-[#160e11] px-3 py-2.5 text-left shadow-[0_20px_50px_-14px_rgba(0,0,0,0.9)]">
                  <span className="block text-[12px] font-extrabold text-white">{p.name}</span>
                  <span className="block text-[10.5px] font-semibold text-smoke">{p.address}</span>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                      p.open ? "bg-win/15 text-win" : "bg-white/8 text-smoke"
                    }`}
                  >
                    {p.open ? "Abierto" : "Cerrado"}
                  </span>
                </span>
              )}
            </button>
          );
        })}

        {/* legend */}
        <div className="absolute bottom-3 left-3 flex gap-4 rounded-full bg-black/55 px-4 py-2 backdrop-blur-sm">
          <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-cream/85">
            <span className="size-2.5 rounded-full" style={{ background: "linear-gradient(160deg,#ff5a64,#a3121e)" }} />
            Punto de carga
          </span>
          <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-cream/85">
            <span className="size-2.5 rounded-full bg-white" />
            Quinielero
          </span>
        </div>
      </div>

      {/* list */}
      <div className="mt-3.5 grid gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3">
        {visible.map((p) => (
          <button
            key={p.idx}
            type="button"
            onClick={() => setSelected(p.idx)}
            className={`panel flex items-center gap-3 px-4 py-2.5 text-left transition hover:border-brand/40 sm:gap-4 sm:px-5 sm:py-3.5 ${
              selected === p.idx ? "border-brand/60" : ""
            }`}
          >
            <span
              className="grid size-9 flex-none place-items-center rounded-full sm:size-10"
              style={{
                background:
                  p.type === "cajero"
                    ? "linear-gradient(160deg,#ff5a64,#a3121e)"
                    : "linear-gradient(160deg,#fdfdfd,#c9c2c4)",
                color: p.type === "cajero" ? "#fff" : "#a3121e",
              }}
            >
              <Icon name="pin" size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-[13.5px] font-extrabold text-white">{p.name}</span>
              <span className="block text-[11px] font-semibold text-smoke">
                {p.address} · {p.zone}
              </span>
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                p.open ? "bg-win/15 text-win" : "bg-white/8 text-smoke"
              }`}
            >
              {p.open ? "Abierto" : "Cerrado"}
            </span>
          </button>
        ))}
        {visible.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm font-semibold text-smoke">
            No encontramos puntos con esa búsqueda.
          </p>
        )}
      </div>
    </main>
  );
}
