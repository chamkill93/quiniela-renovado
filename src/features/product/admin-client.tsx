"use client";

import Link from "next/link";
import { useState } from "react";
import { INSTANT_GAMES } from "@/lib/product/catalog";
import { useProduct } from "@/providers/product-provider";
import { SectionHeader } from "./section-header";
import styles from "./product.module.css";

export function AdminClient() {
  const { session, loading } = useProduct();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(INSTANT_GAMES.map((game) => [game.id, true])));
  if (loading) return <main className={styles.page}><div className={styles.loadingBar} aria-label="Validando permisos" /></main>;
  if (session?.role !== "ADMIN") {
    return (
      <main className={styles.page}>
        <div className={styles.emptyState}>
          <div><h1>Acceso restringido</h1><p>Esta sección requiere un rol de gestión activo.</p><Link className={styles.primaryButton} href="/cuenta">Ir a Cuenta</Link></div>
        </div>
      </main>
    );
  }
  return (
    <main className={styles.page}>
      <SectionHeader eyebrow="Administración" title="Gestión de juegos" description="Vista operativa protegida por rol para revisar la disponibilidad de cada modalidad." />
      <div className={styles.list}>
        {INSTANT_GAMES.map((game) => (
          <article className={styles.listItem} key={game.id}>
            <div><h3>{game.name}</h3><p>{game.eyebrow} · ID {game.id}</p></div>
            <button
              aria-pressed={enabled[game.id]}
              className={enabled[game.id] ? styles.primaryButton : styles.secondaryButton}
              onClick={() => setEnabled((state) => ({ ...state, [game.id]: !state[game.id] }))}
              type="button"
            >
              {enabled[game.id] ? "Habilitado" : "Pausado"}
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}
