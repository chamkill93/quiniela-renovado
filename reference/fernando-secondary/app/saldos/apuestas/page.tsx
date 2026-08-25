import { apuestas } from "@/lib/data";
import { gsPlain } from "@/lib/format";

export default function ApuestasPage() {
  return (
    <main className="relative z-10 mx-auto max-w-2xl px-3 pt-5 pb-10 sm:px-4 sm:pt-6 sm:pt-7">
      <h1 className="font-display text-lg font-extrabold text-white sm:text-2xl">Mis Apuestas</h1>
      <p className="font-display text-[9.5px] font-bold uppercase tracking-label text-brand-soft sm:text-[11px]">
        Historial de juegos
      </p>

      <div className="mt-3.5 flex flex-col gap-2 sm:mt-5 sm:gap-2.5">
        {apuestas.map((a, i) => (
          <div key={i} className={`panel rise rise-${Math.min(i + 1, 6)} flex items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-5 sm:py-3.5`}>
            <span className="ball size-10 flex-none text-[12px] sm:size-11 sm:text-[13px]">{a.numero}</span>
            <div className="flex-1">
              <p className="text-[13.5px] font-extrabold text-white">
                {a.sorteo} · <span className="text-cream/70">{a.postura}</span>
              </p>
              <p className="text-[11px] font-bold text-smoke">
                {a.fecha} · ₲ {gsPlain(a.monto)}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 font-display text-[10px] font-extrabold uppercase tracking-[0.12em] ${
                a.estado === "Ganada"
                  ? "bg-win/15 text-win"
                  : "bg-white/6 text-smoke"
              }`}
            >
              {a.estado}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
