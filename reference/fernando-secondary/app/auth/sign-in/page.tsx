"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { Orbs } from "@/components/Orbs";

export default function SignInPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pass) {
      setError("Completá tu cédula o teléfono y tu contraseña.");
      return;
    }
    router.push("/");
  };

  return (
    <main className="relative min-h-[80vh]">
      <Orbs />
      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center px-4 pt-7 sm:pt-14">
        <div className="rise">
          <Logo height={58} />
        </div>
        <p className="rise rise-1 mt-2 font-display text-[9.5px] font-bold uppercase tracking-label text-brand-soft sm:text-[11px]">
          La quiniela en tu celular
        </p>

        <form onSubmit={submit} className="rise rise-2 mt-6 w-full sm:mt-9">
          <label htmlFor="user" className="font-display text-[11px] font-bold uppercase tracking-label text-brand-soft">
            Cédula o teléfono
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-smoke">
              <Icon name="user" size={18} />
            </span>
            <input
              id="user"
              type="text"
              inputMode="numeric"
              placeholder="Ingresá tu cédula o teléfono"
              value={user}
              onChange={(e) => {
                setUser(e.target.value);
                setError(null);
              }}
              className="field py-3.5 pl-12 pr-4 text-sm"
            />
          </div>

          <label htmlFor="pass" className="mt-5 block font-display text-[11px] font-bold uppercase tracking-label text-brand-soft">
            Contraseña
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-smoke">
              <Icon name="lock" size={18} />
            </span>
            <input
              id="pass"
              type={show ? "text" : "password"}
              placeholder="••••••••"
              value={pass}
              onChange={(e) => {
                setPass(e.target.value);
                setError(null);
              }}
              className="field py-3.5 pl-12 pr-12 text-sm"
            />
            <button
              type="button"
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShow((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-smoke transition hover:text-cream"
            >
              <Icon name={show ? "eye" : "eyeOff"} size={18} />
            </button>
          </div>

          <div className="mt-3 text-right">
            <Link
              href="/auth/reset-password"
              className="font-display text-[10.5px] font-bold uppercase tracking-[0.14em] text-smoke transition hover:text-brand-soft"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {error && (
            <p className="pop mt-4 rounded-xl border border-brand/50 bg-brand/15 px-4 py-2.5 text-center text-[12.5px] font-bold text-blush">
              {error}
            </p>
          )}

          <button type="submit" className="btn-cta cta-pulse mt-6 w-full px-6 py-3.5 text-sm">
            Iniciar sesión
          </button>
          <Link href="/auth/sign-up" className="btn-ghost mt-3 w-full px-6 py-3 text-[13px]">
            Registrarse
          </Link>
        </form>
      </div>
    </main>
  );
}
