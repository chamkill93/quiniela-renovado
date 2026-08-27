"use client";

import { RuleCard } from "@/features/product/rule-card";
import { RulePrizeCalculator } from "@/features/product/rule-prize-calculator";
import { selectEnabledGameRules } from "@/features/product/rules-page-data";
import {
  RemoteEmptyState,
  RemoteErrorState,
  RemoteLoadingState,
  RemoteUnauthorizedState,
} from "@/features/product/remote-view-state";
import { SectionHeader } from "@/features/product/section-header";
import styles from "@/features/product/product.module.css";
import ruleStyles from "@/features/product/rules.module.css";
import { useProduct } from "@/providers/product-provider";

export default function RulesPage() {
  const { catalog, error, loading, refresh, unauthorized } = useProduct();
  const rules = catalog ? selectEnabledGameRules(catalog) : null;

  let unavailable = null;
  if (!catalog) {
    if (loading) unavailable = <RemoteLoadingState label="Cargando reglas…" />;
    else if (unauthorized) unavailable = <RemoteUnauthorizedState message="Iniciá sesión para consultar las reglas disponibles." />;
    else if (error) unavailable = <RemoteErrorState message={error} onRetry={() => void refresh()} />;
    else unavailable = <RemoteEmptyState message="No hay reglas disponibles en este momento." />;
  }

  return (
    <main className={styles.page}>
      <SectionHeader
        description="Elegí tu juego, conocé cómo funciona y cuánto paga."
        eyebrow="Reglas"
        title="Cómo jugar"
      />
      {unavailable}
      {catalog && error ? <RemoteErrorState message={error} onRetry={() => void refresh()} /> : null}
      {rules ? (
        <>
          <RulePrizeCalculator rules={[...rules.traditional, ...rules.instant]} />
          <div className={ruleStyles.grid} data-testid="rules-grid">
            {[...rules.traditional, ...rules.instant].map((rule) => <RuleCard key={rule.id} rule={rule} />)}
          </div>
          {rules.traditional.length + rules.instant.length === 0 ? (
            <RemoteEmptyState message="No hay reglas disponibles en este momento." />
          ) : null}
          <p className={ruleStyles.responsible}>
            Solo mayores de 18 años. Definí tu límite y revisá número, importe y comprobante antes de confirmar.
          </p>
        </>
      ) : null}
    </main>
  );
}
