"use client";

import { RuleCard } from "@/features/product/rule-card";
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
  const cards = rules ? [...rules.traditional, ...rules.instant, ...rules.external] : [];

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
        description="Conocé qué elegir, cómo participar y qué condiciones debe cumplir cada acierto."
        eyebrow="Reglas"
        title="Cómo jugar"
      />
      {unavailable}
      {catalog && error ? <RemoteErrorState message={error} onRetry={() => void refresh()} /> : null}
      {rules && cards.length > 0 ? (
        <>
          <div className={ruleStyles.grid} data-testid="rules-grid">
            {cards.map((rule) => <RuleCard key={rule.id} rule={rule} />)}
          </div>
          <p className={ruleStyles.responsible}>
            Solo mayores de 18 años. Definí tu límite y revisá número, importe y comprobante antes de confirmar.
          </p>
        </>
      ) : null}
    </main>
  );
}
