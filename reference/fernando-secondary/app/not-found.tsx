import Link from "next/link";
import { Orbs } from "@/components/Orbs";

export default function NotFound() {
  return (
    <main className="relative min-h-[60vh]">
      <Orbs />
      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center px-4 pt-16 text-center sm:pt-20">
        <div className="flex gap-3">
          <span className="ball size-14 text-lg">4</span>
          <span className="ball ball-ghost size-14 text-lg">0</span>
          <span className="ball size-14 text-lg">4</span>
        </div>
        <h1 className="mt-6 font-display text-2xl font-extrabold text-white">Página no encontrada</h1>
        <p className="mt-2 text-sm font-semibold text-cream/70">
          El número que buscás no salió sorteado. Probá volver al inicio.
        </p>
        <Link href="/" className="btn-cta mt-6 px-8 py-3 text-sm">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
