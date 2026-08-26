import Link from "next/link";

import { GameIcon } from "@/features/product/game-icon";
import {
  INSTANT_RULES,
  type RuleGameCard,
  TRADITIONAL_RULES,
} from "@/features/product/rules-page-data";
import { SectionHeader } from "@/features/product/section-header";
import styles from "@/features/product/product.module.css";

function RuleCard({
  headingLevel = 2,
  rule,
}: {
  headingLevel?: 2 | 3;
  rule: RuleGameCard;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <Link
      aria-label={`Jugar ${rule.title}`}
      className={styles.ruleCardLink}
      href={rule.href}
    >
      <span aria-hidden="true" className={styles.ruleCardIcon}>
        <GameIcon gameId={rule.id} />
      </span>
      <span className={styles.ruleCardCopy}>
        <Heading>{rule.title}</Heading>
        <p>{rule.copy}</p>
      </span>
      <span aria-hidden="true" className={styles.ruleCardCta}>Jugar →</span>
    </Link>
  );
}

export default function RulesPage() {
  return (
    <main className={`${styles.page} ${styles.pageStack}`}>
      <section>
        <SectionHeader eyebrow="Cómo jugar" title="Reglas claras antes de confirmar" description="Conocé qué seleccionás, cómo se evalúa y cuándo recibís tu comprobante." />
        <div className={`${styles.rulesGrid} ${styles.traditionalRulesGrid}`}>
          {TRADITIONAL_RULES.map((rule) => <RuleCard key={rule.id} rule={rule} />)}
        </div>
      </section>
      <section>
        <SectionHeader eyebrow="Resultado inmediato" title="Las 9 Instantáneas" headingLevel={2} />
        <div className={`${styles.rulesGrid} ${styles.instantRulesGrid}`}>
          {INSTANT_RULES.map((rule) => <RuleCard headingLevel={3} key={rule.id} rule={rule} />)}
        </div>
      </section>
      <section className={styles.statusBox} aria-label="Juego responsable">
        <strong>Jugá de forma responsable.</strong> Definí un importe antes de empezar y no persigas resultados. Los multiplicadores y límites finales requieren aprobación de Negocio, Kodexa y Legal antes de producción.
      </section>
    </main>
  );
}
