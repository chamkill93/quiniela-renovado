import Link from "next/link";
import { SectionHeader } from "./section-header";
import styles from "./product.module.css";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <SectionHeader eyebrow="Información legal" title={title} description="Contenido sujeto a revisión y aprobación legal antes de la publicación comercial." />
      <article className={styles.contentCard} style={{ maxWidth: 860 }}>
        {children}
        <p className={styles.lede}>Para información adicional, consultá el <Link className={styles.textLink} href="/ayuda">Centro de ayuda</Link>.</p>
      </article>
    </main>
  );
}
