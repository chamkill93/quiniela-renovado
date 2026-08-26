"use client";

import Link from "next/link";
import styles from "./product.module.css";

export function AdminClient() {
  return (
    <main className={styles.page}>
      <div className={styles.emptyState}>
        <div>
          <h1>Sección no disponible</h1>
          <p>
            Esta sección no forma parte de la experiencia de juego. Volvé al
            inicio para continuar.
          </p>
          <Link className={styles.primaryButton} href="/">Volver al inicio</Link>
        </div>
      </div>
    </main>
  );
}
