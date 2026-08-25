import { SectionHeader } from "@/features/product/section-header";
import styles from "@/features/product/product.module.css";

const RULES = [
  { title: "A la Cabeza", copy: "Elegí un número de 001 a 999. Participa en la primera posición del sorteo seleccionado." },
  { title: "A los Premios", copy: "Elegí un número de 001 a 999 y una cobertura desde la posición 2 hasta la 14." },
  { title: "Invertida", copy: "Ingresá tres cifras y visualizalas por posición. La postura se configura entre las posiciones habilitadas." },
  { title: "Redoblona", copy: "Combiná un número de cabeza de tres cifras con una terminación de dos cifras y su posición." },
  { title: "Sapy’aite tradicional", copy: "Una jugada rápida de Quiniela tradicional con un número de tres cifras." },
  { title: "Megaloto", copy: "Seleccioná seis números únicos del 1 al 45, manualmente o mediante selección aleatoria." },
] as const;

const INSTANT_RULES = [
  "Sapy’aite: par o impar.",
  "Po’a: rango de centena.",
  "Pya’e: menor o mayor que 500; el 500 se resuelve según configuración.",
  "Peteĩ: última cifra.",
  "Mokõi: últimas dos cifras.",
  "Mbohapy: coincidencia exacta de tres cifras.",
  "Po’a 5: tres números elegidos frente a cinco resultados.",
  "Po’a 10: tres números elegidos frente a diez resultados.",
  "Racha 5: par o impar frente a cinco resultados; premio configurado por coincidencias.",
] as const;

export default function RulesPage() {
  return (
    <main className={`${styles.page} ${styles.pageStack}`}>
      <section>
        <SectionHeader eyebrow="Cómo jugar" title="Reglas claras antes de confirmar" description="Conocé qué seleccionás, cómo se evalúa y cuándo recibís tu comprobante." />
        <div className={styles.rulesGrid}>
          {RULES.map((rule) => <article className={styles.ruleCard} key={rule.title}><h2>{rule.title}</h2><p>{rule.copy}</p></article>)}
        </div>
      </section>
      <section>
        <SectionHeader eyebrow="Resultado inmediato" title="Las 9 Instantáneas" headingLevel={2} />
        <article className={styles.ruleCard}>
          <ul>{INSTANT_RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul>
        </article>
      </section>
      <section className={styles.statusBox} aria-label="Juego responsable">
        <strong>Jugá de forma responsable.</strong> Definí un importe antes de empezar y no persigas resultados. Los multiplicadores y límites finales requieren aprobación de Negocio, Kodexa y Legal antes de producción.
      </section>
    </main>
  );
}
