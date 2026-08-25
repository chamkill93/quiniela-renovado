import { Icon } from "@/components/Icon";
import { premios } from "@/lib/data";
import { gs, gsPlain } from "@/lib/format";

export default function PremiosPage() {
  const total = premios.reduce((acc, p) => acc + p.monto, 0);

  return (
    <main className="relative z-10 mx-auto max-w-2xl px-4 pt-6 pb-10 sm:pt-7">
      <h1 className="font-display text-lg font-extrabold text-white sm:text-2xl">Mis Premios</h1>
      <p className="font-display text-[9.5px] font-bold uppercase tracking-label text-brand-soft sm:text-[11px]">
        Ganancias obtenidas
      </p>

      <div
        className="corners mt-3.5 rounded-2xl border border-brand/45 px-5 py-3.5 text-center sm:mt-5 sm:px-6 sm:py-5"
        style={{
          background:
            "radial-gradient(240px 100px at 90% -20%, rgba(255,139,147,0.35), transparent 70%), linear-gradient(135deg, #8f1019 0%, #5e0a12 55%, #35060b 100%)",
        }}
      >
        <p className="font-display text-[9px] font-bold uppercase tracking-label text-brand-soft sm:text-[10.5px]">
          Total ganado
        </p>
        <p className="font-display text-2xl font-extrabold text-white sm:text-3xl">{gs(total)}</p>
      </div>

      <div className="mt-3.5 flex flex-col gap-2 sm:mt-5 sm:gap-2.5">
        {premios.map((p, i) => (
          <div key={i} className={`panel rise rise-${Math.min(i + 1, 6)} flex items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-5 sm:py-3.5`}>
            <span
              className="grid size-10 flex-none place-items-center rounded-full text-white"
              style={{ background: "linear-gradient(160deg,#ff5a64,#a3121e)", boxShadow: "0 10px 20px -8px rgba(238,28,44,0.6)" }}
            >
              <Icon name="trophy" size={19} />
            </span>
            <div className="flex-1">
              <p className="text-[13.5px] font-extrabold text-white">{p.detalle}</p>
              <p className="text-[11px] font-bold text-smoke">{p.fecha}</p>
            </div>
            <p className="font-display text-[15px] font-extrabold text-win">+ ₲ {gsPlain(p.monto)}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
