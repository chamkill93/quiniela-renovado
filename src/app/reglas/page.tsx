"use client";

import Link from "next/link";

import { GameIcon } from "@/features/product/game-icon";
import {
  selectEnabledGameRules,
  type EnabledRuleGameCard,
} from "@/features/product/rules-page-data";
import {
  RemoteEmptyState,
  RemoteErrorState,
  RemoteLoadingState,
  RemoteUnauthorizedState,
} from "@/features/product/remote-view-state";
import { SectionHeader } from "@/features/product/section-header";
import styles from "@/features/product/product.module.css";
import { useProduct } from "@/providers/product-provider";

function RuleCard({
  headingLevel = 2,
  rule,
}: {
  headingLevel?: 2 | 3;
  rule: EnabledRuleGameCard;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <Link
      aria-label={`Jugar ${rule.title}`}
      className={styles.ruleDetailCard}
      href={rule.href}
    >
      <div className={styles.ruleDetailHeader}>
        <span aria-hidden="true" className={styles.ruleDetailIcon}>
          <GameIcon gameId={rule.id} />
        </span>
        <div className={styles.ruleDetailHeading}>
          <span className={styles.ruleDetailTag}>{rule.tagline}</span>
          <Heading>{rule.title}</Heading>
          <p className={styles.ruleDetailSummary}>{rule.copy}</p>
        </div>
      </div>

      <div className={styles.ruleDetailSteps}>
        <strong>Qué tenés que hacer</strong>
        <ol>
          {rule.instructions.map((instruction) => (
            <li key={instruction}>{instruction}</li>
          ))}
        </ol>
      </div>

      <div className={styles.ruleDetailFact}>
        <span className={styles.ruleDetailLabel}>Cómo ganás</span>
        <span>{rule.winCondition}</span>
      </div>

      <div
        className={styles.rulePayoutBox}
        data-source={rule.payout.source}
      >
        <span className={styles.rulePayoutTopline}>
          <span className={styles.ruleDetailLabel}>Cuánto ganás</span>
          <span className={styles.rulePayoutSource}>{rule.payout.sourceLabel}</span>
        </span>
        <strong>{rule.payout.headline}</strong>
        <span>{rule.payout.detail}</span>
        <small>{rule.payout.note}</small>
      </div>

      <div className={styles.ruleExample}>
        <span className={styles.ruleDetailLabel}>Ejemplo</span>
        <span>{rule.example}</span>
      </div>

      <span aria-hidden="true" className={styles.ruleDetailCta}>
        Jugar {rule.title} <span>→</span>
      </span>
    </Link>
  );
}

export default function RulesPage() {
  const { catalog, error, loading, refresh, unauthorized } = useProduct();

  if (!catalog) {
    let state = <RemoteEmptyState message="El backoffice no publicó reglas disponibles." />;
    if (loading) state = <RemoteLoadingState label="Cargando juegos habilitados…" />;
    else if (unauthorized) {
      state = <RemoteUnauthorizedState message="Iniciá sesión para consultar las reglas habilitadas por el backoffice." />;
    } else if (error) {
      state = <RemoteErrorState message={error} onRetry={() => void refresh()} />;
    }

    return (
      <main className={`${styles.page} ${styles.pageStack}`}>
        <SectionHeader
          description="Las reglas visibles corresponden al catálogo operativo actual."
          eyebrow="Cómo jugar"
          title="Reglas claras antes de confirmar"
        />
        {state}
      </main>
    );
  }

  const enabledRules = selectEnabledGameRules(catalog);
  const instantTitle = enabledRules.instant.length === 1
    ? "Instantánea habilitada"
    : "Instantáneas habilitadas";

  return (
    <main className={`${styles.page} ${styles.pageStack}`}>
      <SectionHeader
        description="Revisá qué tenés que elegir, cómo se valida el resultado y qué premio informa el catálogo antes de confirmar."
        eyebrow="Cómo jugar"
        title="Reglas claras, paso a paso"
      />

      <section aria-labelledby="rules-guide-title" className={styles.rulesGuide}>
        <div className={styles.rulesGuideIntro}>
          <p className={styles.eyebrow}>Antes de jugar</p>
          <h2 id="rules-guide-title">Cómo registrar una jugada</h2>
          <p>El comprobante debe coincidir con tu selección. El resultado y el premio válidos son siempre los que confirma el proveedor.</p>
        </div>
        <ol className={styles.rulesGuideSteps}>
          <li><strong>1</strong><span><b>Elegí el juego</b> y, si corresponde, el sorteo.</span></li>
          <li><strong>2</strong><span><b>Completá la selección</b> indicada en la regla.</span></li>
          <li><strong>3</strong><span><b>Definí el importe</b> entre los valores habilitados.</span></li>
          <li><strong>4</strong><span><b>Revisá y confirmá</b>; después consultá Mis jugadas.</span></li>
        </ol>
      </section>

      <section>
        <SectionHeader
          description="Estas modalidades dependen de un sorteo. El proveedor publica el resultado y la tabla de premios aplicable."
          eyebrow="Resultado por sorteo"
          headingLevel={2}
          title="Quinielas tradicionales"
        />
        <div
          className={`${styles.rulesGrid} ${styles.traditionalRulesGrid}`}
          data-testid="traditional-rules-grid"
        >
          {enabledRules.traditional.map((rule) => <RuleCard key={rule.id} rule={rule} />)}
        </div>
      </section>
      <section>
        <SectionHeader eyebrow="Resultado inmediato" title={instantTitle} headingLevel={2} />
        {enabledRules.instant.length === 0 ? (
          <RemoteEmptyState message="No hay Instantáneas habilitadas en este momento." />
        ) : (
          <div
            className={`${styles.rulesGrid} ${styles.instantRulesGrid}`}
            data-testid="instant-rules-grid"
          >
            {enabledRules.instant.map((rule) => <RuleCard headingLevel={3} key={rule.id} rule={rule} />)}
          </div>
        )}
      </section>
      <section className={styles.statusBox} aria-label="Juego responsable">
        <strong>Jugá de forma responsable.</strong> Definí un importe antes de empezar y no persigas resultados. Los importes y premios visibles deben coincidir con la información que confirme el proveedor antes de cada jugada.
      </section>
    </main>
  );
}
