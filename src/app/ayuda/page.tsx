import Link from "next/link";
import { SectionHeader } from "@/features/product/section-header";
import styles from "@/features/product/product.module.css";

export default function HelpPage() {
  return (
    <main className={styles.page}>
      <SectionHeader eyebrow="Centro de ayuda" title="¿En qué podemos ayudarte?" description="Encontrá respuestas rápidas sobre jugadas, resultados, comprobantes y acceso a tu cuenta." />
      <div className={styles.rulesGrid}>
        <article className={styles.ruleCard}><h2>Comprobantes</h2><p>Las jugadas aceptadas se guardan en Mis Jugadas, incluso si cerrás el comprobante o cambiás de pantalla.</p><Link className={styles.textLink} href="/mis-jugadas">Ver Mis Jugadas →</Link></article>
        <article className={styles.ruleCard}><h2>Resultados</h2><p>Consultá los sorteos publicados y el historial de resultados instantáneos asociados a tu sesión.</p><Link className={styles.textLink} href="/resultados">Ir a Resultados →</Link></article>
        <article className={styles.ruleCard}><h2>Reglas</h2><p>Revisá cada modalidad antes de elegir número, importe y sorteo.</p><Link className={styles.textLink} href="/reglas">Leer las reglas →</Link></article>
        <article className={styles.ruleCard}><h2>Acceso</h2><p>Gestioná tu sesión desde Cuenta. Nunca compartas tu contraseña ni códigos de acceso.</p><Link className={styles.textLink} href="/cuenta">Gestionar cuenta →</Link></article>
      </div>
    </main>
  );
}
