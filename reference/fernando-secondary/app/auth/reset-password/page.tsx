"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { Orbs } from "@/components/Orbs";

export default function ResetPasswordPage() {
  const [user, setUser] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <main className="relative min-h-[80vh]">
      <Orbs />
      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center px-4 pt-10 sm:pt-14">
        <Link href="/auth/sign-in" className="rise">
          <Logo height={56} />
        </Link>

        {sent ? (
          <div className="pop panel-glow mt-9 w-full px-8 py-10 text-center">
            <span className="ball mx-auto grid size-16 place-items-center">
              <Icon name="whatsapp" size={26} />
            </span>
            <h1 className="mt-5 font-display text-xl font-extrabold text-white">Revisá tu celular</h1>
            <p className="mt-2 text-sm font-semibold text-cream/75">
              Te enviamos un enlace por SMS para restablecer tu contraseña.
            </p>
            <Link href="/auth/sign-in" className="btn-cta mt-6 w-full px-6 py-3 text-sm">
              Volver al inicio
            </Link>
          </div>
        ) : (
          <div className="rise rise-2 mt-9 w-full">
            <h1 className="text-center font-display text-xl font-extrabold text-white">
              Recuperá tu contraseña
            </h1>
            <p className="mt-2 text-center text-sm font-semibold text-cream/70">
              Ingresá tu cédula o teléfono y te enviamos un enlace por SMS.
            </p>
            <div className="relative mt-6">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-smoke">
                <Icon name="user" size={18} />
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Cédula o teléfono"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="field py-3.5 pl-12 pr-4 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={!user}
              onClick={() => setSent(true)}
              className="btn-cta mt-5 w-full px-6 py-3.5 text-sm"
            >
              Enviar enlace
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
