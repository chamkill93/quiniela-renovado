import { Icon } from "@/components/Icon";
import { Orbs } from "@/components/Orbs";

export default function SoportePage() {
  return (
    <main className="relative min-h-[60vh]">
      <Orbs />
      <div className="relative z-10 mx-auto max-w-lg px-3 pt-4 pb-10 sm:px-4 sm:pt-5 sm:pt-10">
        <div className="panel-glow rise px-5 py-5 sm:px-7 sm:py-8">
          <h1 className="font-display text-lg font-extrabold uppercase tracking-label text-white sm:text-xl">
            Soporte
          </h1>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-cream/80 sm:mt-2.5 sm:text-sm">
            ¿Necesitás ayuda? Contactanos por WhatsApp o revisá los términos y condiciones.
          </p>

          <a
            href="https://wa.me/595981000000"
            target="_blank"
            rel="noreferrer"
            className="btn-cta mt-4 w-full px-6 py-2.5 text-[12px] sm:mt-6 sm:py-3 sm:text-[13px]"
          >
            <Icon name="whatsapp" size={17} />
            Contactar por WhatsApp
          </a>
          <button type="button" className="btn-ghost mt-2.5 w-full px-6 py-2.5 text-[11px] sm:mt-3 sm:text-[12px]">
            <Icon name="doc" size={15} />
            Términos y condiciones
          </button>
        </div>

        <div className="panel rise rise-2 mt-3 px-5 py-4 sm:mt-4 sm:px-6 sm:py-5">
          <h2 className="font-display text-[11px] font-extrabold uppercase tracking-label text-brand-soft sm:text-[12px]">
            Preguntas frecuentes
          </h2>
          <ul className="mt-2.5 flex flex-col gap-2.5 text-[12px] font-semibold text-cream/80 sm:mt-3 sm:gap-3 sm:text-[13px]">
            <li className="flex gap-2.5">
              <Icon name="chevRight" size={14} className="mt-0.5 flex-none text-brand-bright" />
              ¿Cómo cargo saldo? — Desde “Recargar saldo”, con tarjeta, billetera o en un punto físico.
            </li>
            <li className="flex gap-2.5">
              <Icon name="chevRight" size={14} className="mt-0.5 flex-none text-brand-bright" />
              ¿Cuándo cobro mis premios? — Se acreditan a tu saldo ganado apenas termina el sorteo.
            </li>
            <li className="flex gap-2.5">
              <Icon name="chevRight" size={14} className="mt-0.5 flex-none text-brand-bright" />
              ¿Hasta qué hora puedo jugar? — Hasta 5 minutos antes de cada sorteo.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
