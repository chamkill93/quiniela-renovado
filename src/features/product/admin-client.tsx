"use client";

import Link from "next/link";
import styles from "./product.module.css";

export function AdminClient() {
  return (
    <main className={styles.page}>
      <div className={styles.emptyState}>
        <div>
          <h1>Gestión en el backoffice</h1>
          <p>
            La disponibilidad de juegos, sorteos y operaciones se administra en
            el backoffice externo. Este frontend no modifica esa configuración.
          </p>
          <Link className={styles.primaryButton} href="/">Volver al inicio</Link>
        </div>
      </div>
    </main>
  );
}
