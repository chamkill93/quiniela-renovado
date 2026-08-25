import Link from "next/link";
import { SaldoTiles } from "@/components/SaldoTiles";
import { Icon } from "@/components/Icon";
import { Orbs } from "@/components/Orbs";
import { saldoMenu } from "@/lib/data";

export default function SaldosPage() {
  return (
    <main className="relative">
      <Orbs />
      <div className="relative z-10 mx-auto max-w-4xl px-3 pt-3 pb-10 sm:px-4 sm:pt-4 sm:pt-5">
        <div className="rise">
          <SaldoTiles />
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:gap-2.5 sm:mt-6 sm:gap-3.5">
          {saldoMenu.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className={`panel rise rise-${i + 1} group flex items-center gap-3 px-4 py-3 transition hover:border-brand/40 hover:shadow-[0_18px_44px_-18px_rgba(238,28,44,0.4)] sm:gap-4 sm:px-5 sm:py-4`}
            >
              <span
                className={`grid size-9 flex-none place-items-center rounded-full sm:size-11 ${
                  item.tone === "red"
                    ? "text-white"
                    : "bg-white/6 text-cream/80"
                }`}
                style={
                  item.tone === "red"
                    ? { background: "linear-gradient(160deg,#ff5a64,#a3121e)", boxShadow: "0 10px 20px -8px rgba(238,28,44,0.6)" }
                    : undefined
                }
              >
                <Icon name={item.icon} size={21} />
              </span>
              <span className="flex-1">
                <span className="block font-display text-[12.5px] font-extrabold uppercase tracking-[0.1em] text-white sm:text-[14.5px] sm:tracking-[0.12em]">
                  {item.title}
                </span>
                <span className="block font-display text-[9px] font-bold uppercase tracking-[0.14em] text-brand-soft/85 sm:text-[10.5px] sm:tracking-[0.16em]">
                  {item.subtitle}
                </span>
              </span>
              <span className="text-smoke transition group-hover:translate-x-1 group-hover:text-brand-bright">
                <Icon name="chevRight" size={17} strokeWidth={2.4} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
