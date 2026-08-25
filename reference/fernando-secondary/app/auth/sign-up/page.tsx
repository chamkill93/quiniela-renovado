"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { Orbs } from "@/components/Orbs";
import { Checkbox } from "@/components/ui/checkbox";

export default function SignUpPage() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [cedula, setCedula] = useState("");
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [code, setCode] = useState(["", "", "", ""]);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next1 = () => {
    if (!phone || !cedula) return setError("Completá tu celular y tu cédula.");
    if (!adult) return setError("Tenés que ser mayor de 18 años para jugar.");
    if (!terms) return setError("Aceptá los términos y condiciones para continuar.");
    setError(null);
    setStep(2);
  };

  const next2 = () => {
    if (code.some((c) => c === "")) return setError("Ingresá el código de 4 dígitos que te enviamos por SMS.");
    setError(null);
    setStep(3);
  };

  const next3 = () => {
    if (pass.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (pass !== pass2) return setError("Las contraseñas no coinciden.");
    setError(null);
    setStep(4);
  };

  return (
    <main className="relative min-h-[80vh]">
      <Orbs />
      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center px-3 pt-5 sm:px-4 sm:pt-12">
        <Link href="/auth/sign-in" className="rise">
          <Logo height={48} />
        </Link>

        {step < 4 && (
          <>
            <h1 className="rise rise-1 mt-4 font-display text-xl font-extrabold text-white sm:mt-6 sm:text-2xl">
              Creá tu cuenta
            </h1>
            <div className="rise rise-1 mt-2 flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    s === step ? "w-8 bg-brand shadow-[0_0_10px_rgba(238,28,44,0.8)]" : s < step ? "w-4 bg-brand/60" : "w-4 bg-white/15"
                  }`}
                />
              ))}
              <span className="ml-1 font-display text-[10.5px] font-bold uppercase tracking-label text-smoke">
                Paso {step} de 3
              </span>
            </div>
          </>
        )}

        {/* ————— step 1: datos ————— */}
        {step === 1 && (
          <div className="rise rise-2 mt-4 w-full sm:mt-7">
            <label htmlFor="phone" className="font-display text-[11px] font-bold uppercase tracking-label text-brand-soft">
              Número de celular
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-smoke">
                <Icon name="phone" size={18} />
              </span>
              <input
                id="phone"
                type="tel"
                placeholder="Ej. 09XX XXX XXX"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/[^\d\s]/g, ""));
                  setError(null);
                }}
                className="field py-3.5 pl-12 pr-4 text-sm"
              />
            </div>

            <label htmlFor="cedula" className="mt-5 block font-display text-[11px] font-bold uppercase tracking-label text-brand-soft">
              Cédula de identidad
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-smoke">
                <Icon name="id" size={18} />
              </span>
              <input
                id="cedula"
                type="text"
                inputMode="numeric"
                placeholder="Número de cédula"
                value={cedula}
                onChange={(e) => {
                  setCedula(e.target.value.replace(/\D/g, ""));
                  setError(null);
                }}
                className="field py-3.5 pl-12 pr-4 text-sm"
              />
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-3 sm:mt-6">
              <Checkbox
                checked={adult}
                onCheckedChange={(v) => {
                  setAdult(Boolean(v));
                  setError(null);
                }}
                className="size-6 rounded-md border-white/25 data-checked:border-brand data-checked:bg-brand data-checked:text-white"
              />
              <span className="text-[13px] font-bold text-cream/90">Soy mayor de 18 años.</span>
            </label>
            <label className="mt-3 flex cursor-pointer items-center gap-3">
              <Checkbox
                checked={terms}
                onCheckedChange={(v) => {
                  setTerms(Boolean(v));
                  setError(null);
                }}
                className="size-6 rounded-md border-white/25 data-checked:border-brand data-checked:bg-brand data-checked:text-white"
              />
              <span className="text-[13px] font-bold text-cream/90">
                Acepto los{" "}
                <span className="text-brand-bright underline decoration-brand/50 underline-offset-2">
                  términos y condiciones
                </span>
                .
              </span>
            </label>

            {error && (
              <p className="pop mt-4 rounded-xl border border-brand/50 bg-brand/15 px-4 py-2.5 text-center text-[12.5px] font-bold text-blush">
                {error}
              </p>
            )}

            <button type="button" onClick={next1} className="btn-cta mt-6 w-full px-6 py-3.5 text-sm">
              Continuar
            </button>
            <Link href="/auth/sign-in" className="btn-ghost mt-3 w-full px-6 py-3 text-[12px]">
              Ya tengo cuenta
            </Link>
          </div>
        )}

        {/* ————— step 2: código SMS ————— */}
        {step === 2 && (
          <div className="rise rise-2 mt-7 w-full text-center">
            <p className="text-sm font-semibold text-cream/80">
              Te enviamos un código por SMS al{" "}
              <span className="font-display font-extrabold text-white">{phone || "tu celular"}</span>.
            </p>
            <div className="mt-5 flex justify-center gap-2 sm:mt-6 sm:gap-3">
              {code.map((c, i) => (
                <input
                  key={i}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={c}
                  aria-label={`Dígito ${i + 1}`}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 1);
                    setCode((arr) => arr.map((x, j) => (j === i ? v : x)));
                    setError(null);
                    if (v && i < 3) {
                      const next = e.target.parentElement?.children[i + 1] as HTMLInputElement;
                      next?.focus();
                    }
                  }}
                  className="field size-12 p-0 text-center text-xl sm:size-14 sm:text-2xl"
                />
              ))}
            </div>
            <button type="button" className="mt-4 font-display text-[10.5px] font-bold uppercase tracking-label text-smoke transition hover:text-brand-soft">
              Reenviar código
            </button>

            {error && (
              <p className="pop mt-4 rounded-xl border border-brand/50 bg-brand/15 px-4 py-2.5 text-center text-[12.5px] font-bold text-blush">
                {error}
              </p>
            )}

            <button type="button" onClick={next2} className="btn-cta mt-6 w-full px-6 py-3.5 text-sm">
              Verificar
            </button>
          </div>
        )}

        {/* ————— step 3: contraseña ————— */}
        {step === 3 && (
          <div className="rise rise-2 mt-7 w-full">
            <label htmlFor="pass" className="font-display text-[11px] font-bold uppercase tracking-label text-brand-soft">
              Creá tu contraseña
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-smoke">
                <Icon name="lock" size={18} />
              </span>
              <input
                id="pass"
                type={show ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={pass}
                onChange={(e) => { setPass(e.target.value); setError(null); }}
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

            <label htmlFor="pass2" className="mt-5 block font-display text-[11px] font-bold uppercase tracking-label text-brand-soft">
              Repetí tu contraseña
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-smoke">
                <Icon name="lock" size={18} />
              </span>
              <input
                id="pass2"
                type={show ? "text" : "password"}
                placeholder="••••••••"
                value={pass2}
                onChange={(e) => { setPass2(e.target.value); setError(null); }}
                className="field py-3.5 pl-12 pr-4 text-sm"
              />
            </div>

            {error && (
              <p className="pop mt-4 rounded-xl border border-brand/50 bg-brand/15 px-4 py-2.5 text-center text-[12.5px] font-bold text-blush">
                {error}
              </p>
            )}

            <button type="button" onClick={next3} className="btn-cta mt-6 w-full px-6 py-3.5 text-sm">
              Crear cuenta
            </button>
          </div>
        )}

        {/* ————— done ————— */}
        {step === 4 && (
          <div className="pop panel-glow mt-8 w-full px-8 py-10 text-center">
            <span className="ball mx-auto grid size-16 place-items-center text-2xl">✓</span>
            <h1 className="mt-5 font-display text-2xl font-extrabold text-white">¡Cuenta creada!</h1>
            <p className="mt-2 text-sm font-semibold text-cream/75">
              Ya podés iniciar sesión y hacer tu primera jugada. ¡Bienvenido a quinie.LA!
            </p>
            <Link href="/auth/sign-in" className="btn-cta mt-6 w-full px-6 py-3 text-sm">
              Iniciar sesión
            </Link>
          </div>
        )}

        <p className="mt-8 max-w-xs text-center text-[10px] font-semibold uppercase leading-relaxed tracking-[0.08em] text-smoke/60">
          Al registrarte aceptás nuestros términos y condiciones.
          <span className="mt-1 flex items-center justify-center gap-1.5 font-display text-brand-soft">
            <Icon name="check" size={12} strokeWidth={3} />
            Juego responsable · 18+
          </span>
        </p>
      </div>
    </main>
  );
}
