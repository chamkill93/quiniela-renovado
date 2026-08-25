"use client";

import { MOCK_DRAWS } from "@/lib/product/catalog";
import { useProduct } from "@/providers/product-provider";
import { SectionHeader } from "./section-header";
import styles from "./product.module.css";

const LATEST_POSITIONS = ["353", "906", "112", "724", "038", "481", "667", "205", "919", "540", "073", "826", "314", "758"];

export function ResultsClient() {
  const { results, loading, error } = useProduct();
  return (
    <main className={`${styles.page} ${styles.pageStack}`}>
      <section>
        <SectionHeader
          eyebrow="Información verificable"
          title="Resultados"
          description="Revisá los sorteos del día y los resultados de tus Instantáneas en un solo lugar."
        />
        <div className={styles.drawGrid}>
          {MOCK_DRAWS.map((draw) => (
            <article className={styles.drawCard} data-tone={draw.tone} key={draw.id}>
              <span>{draw.label}</span><strong>{draw.result}</strong>
              <div className={styles.drawMeta}><span>{draw.time}</span><span>Publicado</span></div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Tempranero · 10:00" title="Todas las posiciones" description="Resultado completo de la primera a la decimocuarta posición." headingLevel={2} />
        <div className={styles.positionGrid}>
          {LATEST_POSITIONS.map((number, index) => (
            <div className={styles.positionCell} key={`${index}-${number}`}><span>{index + 1}.ª</span><strong>{number}</strong></div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Historial reciente" title="Resultados instantáneos" headingLevel={2} />
        {loading ? <div className={styles.loadingBar} aria-label="Cargando resultados" /> : null}
        {error ? <div className={styles.errorBox} role="alert">{error}</div> : null}
        {!loading && !error && results.length === 0 ? (
          <div className={styles.emptyState}><p>Los resultados de tus próximas Instantáneas aparecerán acá.</p></div>
        ) : (
          <div className={styles.list}>
            {results.map((result) => {
              const numbers = result.resultNumbers?.join(" · ") ?? result.numbers?.join(" · ") ?? result.result ?? "—";
              const date = result.occurredAt ?? result.publishedAt;
              return (
                <article className={styles.listItem} key={result.id}>
                  <div><h3>{result.label ?? result.gameName ?? result.gameId ?? "Resultado"}</h3><p>{date ? new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)) : "Confirmado"}</p></div>
                  <div className={styles.listAmount}>{numbers}</div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
