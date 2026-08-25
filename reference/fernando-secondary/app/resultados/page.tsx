"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resultDays } from "@/lib/data";

const SORTEO_TIMES: Record<string, string> = {
  tempranero: "10:00 HS",
  matutino: "12:30 HS",
  vespertino: "16:00 HS",
  nocturno: "20:00 HS",
};

/* minutes since midnight when each draw happens */
const SORTEO_MINUTES: Record<string, number> = {
  tempranero: 10 * 60,
  matutino: 12 * 60 + 30,
  vespertino: 16 * 60,
  nocturno: 20 * 60,
};

export default function ResultadosPage() {
  const [dayIdx, setDayIdx] = useState(0); // 0 = most recent (today)
  const [tab, setTab] = useState(resultDays[0].sorteos[0].id);
  const [now, setNow] = useState<Date | null>(null);
  const day = resultDays[dayIdx];

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  /* ?sorteo=nocturno abre directo la pestaña de ese sorteo */
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("sorteo");
    if (wanted && resultDays[0].sorteos.some((s) => s.id === wanted)) {
      setTab(wanted);
    }
  }, []);

  const isPending = (sorteoId: string) => {
    if (dayIdx !== 0 || !now) return false; // past days always have results
    const mins = now.getHours() * 60 + now.getMinutes();
    return mins < (SORTEO_MINUTES[sorteoId] ?? 0);
  };

  return (
    <main className="relative z-10 mx-auto max-w-4xl px-3 pt-5 pb-10 sm:px-4 sm:pt-6">
      <p className="flex items-center gap-2 font-display text-[10px] font-semibold uppercase tracking-label text-brand-soft">
        <span className="slash !w-5" />
        Resultados oficiales
      </p>

      {/* date navigator */}
      <div className="glass mt-4 flex items-center justify-between rounded-full px-2 py-2 sm:mt-5 sm:px-3 sm:py-2.5">
        <button
          type="button"
          aria-label="Día anterior"
          disabled={dayIdx >= resultDays.length - 1}
          onClick={() => setDayIdx((i) => Math.min(i + 1, resultDays.length - 1))}
          className="grid size-9 place-items-center rounded-full bg-brand/10 text-brand-soft transition enabled:hover:bg-brand/25 enabled:hover:text-white disabled:opacity-30"
        >
          <Icon name="chevLeft" size={16} strokeWidth={2.4} />
        </button>
        <div className="text-center">
          <p className="font-display text-[9px] font-semibold uppercase tracking-label text-brand-soft">
            Fecha del sorteo
          </p>
          <p className="font-display text-lg font-bold text-white">{day.date}</p>
        </div>
        <button
          type="button"
          aria-label="Día siguiente"
          disabled={dayIdx === 0}
          onClick={() => setDayIdx((i) => Math.max(i - 1, 0))}
          className="grid size-9 place-items-center rounded-full bg-brand/10 text-brand-soft transition enabled:hover:bg-brand/25 enabled:hover:text-white disabled:opacity-30"
        >
          <Icon name="chevRight" size={16} strokeWidth={2.4} />
        </button>
      </div>

      {/* sorteo tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mt-4 gap-3 sm:mt-5">
        <TabsList className="!h-auto w-full rounded-2xl border border-line bg-black/40 p-1.5 backdrop-blur-sm sm:p-2">
          {day.sorteos.map((s) => (
            <TabsTrigger
              key={s.id}
              value={s.id}
              className="!h-auto flex-col gap-1 rounded-xl px-1 py-2.5 font-display text-[8px] font-semibold uppercase tracking-[0.06em] data-active:bg-brand data-active:text-white data-active:shadow-[0_8px_24px_-8px_rgba(238,28,44,0.9)] sm:flex-row sm:gap-2 sm:py-3 sm:text-[11px] sm:tracking-[0.1em]"
            >
              <Icon name={s.icon} size={16} strokeWidth={2.2} className="sm:hidden" />
              <Icon name={s.icon} size={18} strokeWidth={2.2} className="hidden sm:block" />
              {s.name.replace("Sorteo ", "")}
            </TabsTrigger>
          ))}
        </TabsList>

        {day.sorteos.map((s) => (
          <TabsContent key={s.id} value={s.id}>
            {isPending(s.id) ? (
              <section className="panel rise flex flex-col items-center px-6 py-9 text-center sm:py-12">
                <span className="ball ball-ghost grid size-16 place-items-center text-smoke">
                  <Icon name="clock" size={30} strokeWidth={2} />
                </span>
                <h2 className="mt-4 font-display text-[15px] font-bold uppercase tracking-[0.08em] text-white sm:text-lg">
                  Aún no hay resultados
                </h2>
                <p className="mt-1.5 max-w-xs text-[12.5px] font-medium leading-relaxed text-smoke">
                  El {s.name.replace("Sorteo ", "sorteo ")} es hoy a las{" "}
                  <span className="font-display font-bold text-brand-soft">
                    {SORTEO_TIMES[s.id]}
                  </span>
                  . Los números van a aparecer acá apenas termine.
                </p>
                <Link href={`/jugar/${s.id}`} className="btn-cta mt-5 px-7 py-2.5 text-[11.5px]">
                  <Icon name="dice" size={15} />
                  Jugar a este sorteo
                </Link>
                <p className="mt-2 font-display text-[9px] font-semibold uppercase tracking-[0.14em] text-brand-soft/80">
                  Todavía estás a tiempo
                </p>
              </section>
            ) : (
            <section className="panel-glow rise px-3 py-3 sm:px-8 sm:py-6">
              {/* sorteo context */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-display text-[9px] font-semibold uppercase tracking-[0.14em] text-smoke">
                  <Icon name={s.icon} size={13} strokeWidth={2.3} className="text-brand-soft" />
                  {SORTEO_TIMES[s.id] ?? ""}
                </span>
                <span className="font-display text-[9px] font-semibold uppercase tracking-[0.14em] text-smoke/70">
                  {day.date}
                </span>
              </div>

              {/* a la cabeza — the number that matters */}
              <div className="mt-2.5 flex flex-col items-center sm:mt-3">
                <span className="rounded-full bg-brand px-3.5 py-1 font-display text-[8.5px] font-bold uppercase tracking-label text-white shadow-[0_0_18px_rgba(238,28,44,0.6)] sm:text-[9.5px]">
                  A la cabeza
                </span>
                <div className="corners pop mt-2 rounded-3xl border border-brand/35 bg-black/40 px-7 py-3 sm:mt-3 sm:px-14 sm:py-6">
                  <span className="font-display text-[36px] font-black leading-none tabular-nums text-white [text-shadow:0_0_34px_rgba(238,28,44,0.85)] sm:text-6xl">
                    {s.numbers[0]}
                  </span>
                </div>
                <p className="mt-1.5 font-display text-[8.5px] font-semibold uppercase tracking-[0.16em] text-smoke sm:mt-2 sm:text-[9.5px]">
                  Posición 01 · paga hasta x500
                </p>
              </div>

              {/* a los premios */}
              <div className="mt-3.5 flex items-center gap-3 sm:mt-6">
                <span className="rule-line" />
                <p className="font-display text-[8.5px] font-semibold uppercase tracking-[0.16em] text-brand-soft sm:text-[9.5px]">
                  A los premios · 02–14
                </p>
                <span className="rule-line rule-line-r" />
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-x-0.5 gap-y-2 sm:mt-4 sm:gap-x-1 sm:gap-y-5">
                {s.numbers.slice(1).map((n, i) => (
                  <span
                    key={i}
                    className="rise flex w-[55px] flex-col items-center sm:w-[84px]"
                    style={{ animationDelay: `${0.05 + i * 0.03}s` }}
                  >
                    <span className="font-display text-[7.5px] font-bold tracking-[0.22em] text-brand-soft/70 sm:text-[8.5px]">
                      {String(i + 2).padStart(2, "0")}
                    </span>
                    <span className="mt-0.5 font-display text-[16px] font-bold leading-none tabular-nums text-white sm:text-[22px]">
                      {n}
                    </span>
                    <span className="mt-1 h-0.5 w-5 rounded-full bg-gradient-to-r from-transparent via-brand/50 to-transparent sm:mt-1.5 sm:w-6" />
                  </span>
                ))}
              </div>
            </section>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}
