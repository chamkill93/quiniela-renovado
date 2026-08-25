"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Orbs } from "@/components/Orbs";
import { Switch } from "@/components/ui/switch";
import { mockUser } from "@/lib/data";

export default function ProfilePage() {
  const [notif, setNotif] = useState(true);
  const [sound, setSound] = useState(true);

  return (
    <main className="relative">
      <Orbs />
      <div className="relative z-10 mx-auto max-w-xl px-3 pt-4 pb-10 sm:px-4 sm:pt-5 sm:pt-8">
        {/* avatar */}
        <div className="rise flex flex-col items-center">
          <div className="relative">
            <div
              className="profile-avatar grid size-16 place-items-center rounded-full text-brand-soft sm:size-28"
            >
              <Icon name="user" size={38} strokeWidth={1.6} />
            </div>
            {mockUser.verified && (
              <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full bg-win text-white shadow-[0_6px_16px_-4px_rgba(47,215,124,0.7)] sm:bottom-0.5 sm:right-0.5 sm:size-8">
                <Icon name="check" size={12} strokeWidth={3} className="sm:hidden" />
                <Icon name="check" size={14} strokeWidth={3} className="hidden sm:block" />
              </span>
            )}
          </div>
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-win/40 bg-win/10 px-3 py-0.5 font-display text-[8.5px] font-extrabold uppercase tracking-label text-win sm:mt-4 sm:px-3.5 sm:py-1 sm:text-[10px]">
            <span className="size-1.5 rounded-full bg-win" />
            Verificado
          </span>
          <h1 className="profile-name mt-2 text-center font-display text-base font-extrabold uppercase tracking-wide text-white sm:mt-3 sm:text-2xl">
            {mockUser.name}
          </h1>
        </div>

        {/* data cards */}
        <div className="mt-4 flex flex-col gap-2.5 sm:mt-7 sm:gap-3">
          <div className="panel rise rise-1 flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
            <span
              className="grid size-9 flex-none place-items-center rounded-xl text-white sm:size-10"
              style={{ background: "linear-gradient(160deg,#ff5a64,#a3121e)" }}
            >
              <Icon name="id" size={18} />
            </span>
            <div className="flex-1">
              <p className="profile-label font-display text-[8.5px] font-bold uppercase tracking-[0.14em] text-brand-soft sm:text-[10px] sm:tracking-label">
                Cédula de Identidad
              </p>
              <p className="profile-value font-display text-[15px] font-extrabold text-white sm:text-lg">{mockUser.cedula}</p>
            </div>
            <span className="profile-muted text-smoke/60">
              <Icon name="lock" size={16} />
            </span>
          </div>

          <div className="panel rise rise-2 flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
            <span
              className="grid size-9 flex-none place-items-center rounded-xl text-white sm:size-10"
              style={{ background: "linear-gradient(160deg,#ff5a64,#a3121e)" }}
            >
              <Icon name="phone" size={18} />
            </span>
            <div className="flex-1">
              <p className="profile-label font-display text-[8.5px] font-bold uppercase tracking-[0.14em] text-brand-soft sm:text-[10px] sm:tracking-label">
                Nro. de Celular
              </p>
              <p className="profile-value font-display text-[15px] font-extrabold text-white sm:text-lg">{mockUser.phone}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="profile-cta rise rise-3 mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-white to-[#e9e2e4] px-6 py-2.5 font-display text-[11px] font-extrabold uppercase tracking-label text-[#1c1114] shadow-[0_10px_24px_-10px_rgba(255,255,255,0.35)] transition hover:brightness-105 active:scale-[0.99] sm:mt-4 sm:py-3 sm:text-[12px]"
        >
          Cambiar número
          <Icon name="chevRight" size={14} strokeWidth={2.6} />
        </button>

        {/* preferences */}
        <div className="rise rise-4 mt-5 flex flex-col gap-3 sm:mt-7 sm:gap-4">
          <div className="flex items-center justify-between">
            <span className="profile-pref inline-flex items-center gap-2.5 font-display text-[12px] font-extrabold uppercase tracking-label text-cream/90">
              <Icon name="bell" size={18} className="profile-label" />
              Recibir notificaciones
            </span>
            <Switch
              checked={notif}
              onCheckedChange={(v) => setNotif(Boolean(v))}
              aria-label="Recibir notificaciones"
              className="scale-125 data-checked:bg-brand"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="profile-pref inline-flex items-center gap-2.5 font-display text-[12px] font-extrabold uppercase tracking-label text-cream/90">
              <Icon name="sound" size={18} className="profile-label" />
              Sonidos
            </span>
            <Switch
              checked={sound}
              onCheckedChange={(v) => setSound(Boolean(v))}
              aria-label="Sonidos"
              className="scale-125 data-checked:bg-brand"
            />
          </div>
        </div>

        <Link
          href="/auth/sign-in"
          className="rise rise-5 mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-brand/50 bg-brand/5 px-6 py-3 font-display text-[11px] font-extrabold uppercase tracking-label text-brand-bright transition hover:bg-brand/15 sm:mt-8 sm:py-3.5 sm:text-[12px]"
        >
          <Icon name="logout" size={17} />
          Cerrar sesión
        </Link>
      </div>
    </main>
  );
}
