import { Icon } from "@/components/Icon";
import { movimientos } from "@/lib/data";
import { gsPlain } from "@/lib/format";

export default function MovimientosPage() {
  return (
    <main className="relative z-10 mx-auto max-w-2xl px-4 pt-6 pb-10 sm:pt-7">
      <h1 className="font-display text-lg font-extrabold text-white sm:text-2xl">Mis Movimientos</h1>
      <p className="font-display text-[9.5px] font-bold uppercase tracking-label text-brand-soft sm:text-[11px]">
        Historial detallado
      </p>

      <div className="mt-3.5 flex flex-col gap-2 sm:mt-5 sm:gap-2.5">
        {movimientos.map((m, i) => (
          <div key={i} className={`panel rise rise-${Math.min(i + 1, 6)} flex items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-5 sm:py-3.5`}>
            <span
              className={`grid size-9 flex-none place-items-center rounded-full ${
                m.tipo === "in" ? "bg-win/15 text-win" : "bg-brand/15 text-brand-bright"
              }`}
            >
              <Icon name={m.tipo === "in" ? "plus" : "logout"} size={16} strokeWidth={2.4} />
            </span>
            <div className="flex-1">
              <p className="text-[13.5px] font-extrabold text-white">{m.detalle}</p>
              <p className="text-[11px] font-bold text-smoke">{m.fecha}</p>
            </div>
            <p className={`font-display text-[15px] font-extrabold ${m.tipo === "in" ? "text-win" : "text-brand-bright"}`}>
              {m.tipo === "in" ? "+" : "−"} ₲ {gsPlain(Math.abs(m.monto))}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
