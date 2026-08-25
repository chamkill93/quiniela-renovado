import Link from "next/link";
import CountUp from "@/components/CountUp";
import ShinyText from "@/components/ShinyText";
import { GameInfoButton } from "@/components/GameInfo";
import { NextDraw } from "@/components/NextDraw";
import { SorteosDelDia } from "@/components/SorteosDelDia";
import { LiveStream } from "@/components/LiveStream";
import { Icon } from "@/components/Icon";
import { balances, instants, megaloto } from "@/lib/data";

export default function Home() {
  return (
    <main className="relative">
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:pt-6">
        {/* ————— saldo first ————— */}
        <div className="rise flex items-center gap-2.5 rounded-2xl border border-line bg-black/30 px-3 py-2 sm:gap-6 sm:px-5 sm:py-2.5">
          <span className="flex flex-none flex-col">
            <span className="flex items-center gap-1 font-display text-[7px] font-semibold uppercase tracking-[0.14em] text-smoke sm:text-[9px]">
              <Icon name="bank" size={10} className="sm:hidden" />
              <Icon name="bank" size={11} className="hidden sm:block" />
              Cargado
            </span>
            <span className="font-display text-[12px] font-bold leading-tight text-white sm:text-[15px]">
              ₲ <CountUp to={balances.cargado} separator="." duration={0.45} />
            </span>
          </span>

          <span aria-hidden className="h-6 w-px flex-none bg-white/10 sm:h-7" />

          <span className="flex flex-none flex-col">
            <span className="flex items-center gap-1 font-display text-[7px] font-semibold uppercase tracking-[0.14em] text-brand-soft sm:text-[9px]">
              <Icon name="trophy" size={10} className="sm:hidden" />
              <Icon name="trophy" size={11} className="hidden sm:block" />
              Ganado
            </span>
            <span className="font-display text-[12px] font-bold leading-tight text-white sm:text-[15px]">
              ₲ <CountUp to={balances.ganado} separator="." duration={0.55} />
            </span>
          </span>

          <span className="ml-auto flex flex-none gap-1.5 sm:gap-2">
            <Link href="/saldos/recargar" className="btn-cta px-3 py-1.5 text-[9px] sm:px-4 sm:text-[10px]">
              <Icon name="payments" size={12} className="sm:hidden" />
              <Icon name="payments" size={13} className="hidden sm:block" />
              <span className="max-[379px]:hidden">Recargar</span>
              <span className="min-[380px]:hidden">+</span>
            </Link>
            <Link href="/saldos" className="btn-ghost px-3 py-1.5 text-[9px] max-sm:hidden sm:px-4 sm:text-[10px]">
              Mi saldo
            </Link>
          </span>
        </div>

        {/* ————— sorteos del día ————— */}
        <section id="sorteos" className="mt-5 scroll-mt-24 sm:mt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-[15px] font-bold uppercase text-white sm:text-2xl">
              Sorteos del día
            </h2>
            <Link
              href="/resultados"
              className="inline-flex flex-none items-center gap-1 pb-0.5 font-display text-[9.5px] font-semibold uppercase tracking-[0.12em] text-smoke transition hover:text-white sm:text-[10px] sm:tracking-[0.14em]"
            >
              Resultados
              <Icon name="chevRight" size={11} strokeWidth={2.6} />
            </Link>
          </div>

          {/* next draw countdown — lives with its section */}
          <div className="rise rise-2 mt-3.5 sm:mt-4">
            <NextDraw />
          </div>

          <div className="mt-3 md:mt-7">
            <SorteosDelDia />
          </div>

          <LiveStream />
        </section>

        {/* ————— instantáneos: swipe row on mobile, grid from sm up ————— */}
        <section className="mt-6 sm:mt-12">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-[15px] font-bold uppercase text-white sm:text-2xl">
              Juegos instantáneos
            </h2>
            <span className="font-display text-[9px] font-semibold uppercase tracking-[0.14em] text-brand-soft sm:text-[10px]">
              {instants.length} juegos
            </span>
          </div>

          <div className="no-scrollbar -mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 scroll-pl-6 sm:mx-0 sm:mt-5 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
            {instants.map((g, i) => (
              <div
                key={g.id}
                className={`instant-card rise rise-${i + 1} w-[160px] flex-none snap-start sm:w-auto`}
                style={{ "--card-accent": g.gradient } as React.CSSProperties}
              >
                {/* whole card opens the game */}
                <Link
                  href={`/jugar/${g.id}`}
                  aria-label={`Jugar a ${g.name}`}
                  className="absolute inset-0 z-[1] rounded-[1.25rem]"
                />
                {/* info button */}
                <GameInfoButton game={g} className="absolute right-2 top-2 z-20" />

                {/* icon + name */}
                <div className="pointer-events-none relative z-[2]">
                  <div className="flex items-start gap-3">
                    <span
                      className="grid size-10 flex-none place-items-center rounded-xl text-white transition-transform group-hover:scale-105 sm:size-12 sm:rounded-2xl"
                      style={{ background: g.gradient, boxShadow: g.shadow }}
                    >
                      <Icon name={g.icon} size={20} strokeWidth={2.1} />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <h3 className="font-display text-[12px] font-bold uppercase leading-tight text-white sm:text-[14px]">
                        {g.name}
                      </h3>
                      <p className="mt-1 hidden text-[11px] font-medium leading-snug text-cream/50 sm:block">
                        {g.rules}
                      </p>
                    </div>
                  </div>

                  {/* payout badge */}
                  <div className="mt-3 flex items-center gap-1.5">
                    <span className="rounded-full bg-white/5 px-2 py-0.5 font-display text-[8px] font-bold uppercase tracking-wider text-smoke/60">
                      x{g.info.pays.ganado[0].mult}
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 font-display text-[8px] font-bold uppercase tracking-wider text-smoke/60">
                      {g.info.pays.ganado.length > 1 ? `hasta x${g.info.pays.ganado[g.info.pays.ganado.length - 1].mult}` : "instantáneo"}
                    </span>
                  </div>
                </div>

                {/* play button */}
                <Link
                  href={`/jugar/${g.id}`}
                  className="btn-cta pointer-events-auto relative z-[2] mt-3.5 w-full py-2 text-[10px] sm:mt-4 sm:py-2.5 sm:text-[11px]"
                >
                  <Icon name="dice" size={14} />
                  Jugar
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ————— mega loto banner ————— */}
        <section className="mt-6 sm:mt-12">
          <Link
            href="/megaloto"
            className="stripes group relative block overflow-hidden rounded-2xl border border-brand/40 transition hover:border-brand/70 sm:rounded-3xl"
          >
            <div
              className="flex items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-8 sm:py-6"
              style={{
                background:
                  "radial-gradient(420px 180px at 10% 0%, rgba(238,28,44,0.4), transparent 65%), linear-gradient(120deg, rgba(26,10,13,0.94) 0%, rgba(10,6,8,0.96) 70%)",
              }}
            >
              <div className="min-w-0">
                <p className="font-display text-[7.5px] font-semibold uppercase tracking-label text-brand-soft sm:text-[10px]">
                  Pozo acumulado
                </p>
                <p className="font-display text-[20px] font-black uppercase leading-tight sm:text-4xl">
                  <span className="bg-gradient-to-b from-white via-blush to-brand-soft bg-clip-text text-transparent [filter:drop-shadow(0_0_18px_rgba(238,28,44,0.45))]">
                    Mega
                  </span>{" "}
                  <span className="text-brand-bright [text-shadow:0_0_22px_rgba(238,28,44,0.8)]">
                    Loto
                  </span>
                </p>
                <ShinyText
                  text={megaloto.jackpotLabel.toUpperCase()}
                  speed={2.5}
                  color="#ff8b93"
                  shineColor="#ffffff"
                  className="font-display text-[11px] font-bold sm:text-lg"
                />
                <p className="mt-0.5 hidden font-display text-[9.5px] font-semibold uppercase tracking-[0.16em] text-smoke sm:block">
                  {megaloto.drawLabel}
                </p>
              </div>
              <span className="btn-cta cta-pulse flex-none px-4 py-2 text-[10px] transition group-hover:brightness-110 sm:px-8 sm:py-3 sm:text-[12.5px]">
                <Icon name="dice" size={16} className="hidden sm:block" />
                Jugar
              </span>
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}
