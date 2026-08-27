"use client";

import Link from "next/link";
import { useState } from "react";

import { GameIcon } from "./game-icon";
import type { EnabledRuleGameCard } from "./rules-page-data";
import styles from "./rules.module.css";

export function RuleCard({ rule }: { rule: EnabledRuleGameCard }) {
  const [expanded, setExpanded] = useState(false);
  const titleId = `rule-${rule.id}-title`;
  const detailId = `rule-${rule.id}-detail`;

  return (
    <article aria-labelledby={titleId} className={styles.card} data-testid={`rule-card-${rule.id}`}>
      <header className={styles.header}>
        <span aria-hidden="true" className={styles.icon}><GameIcon gameId={rule.id} /></span>
        <div>
          <h2 id={titleId}>{rule.title}</h2>
          <p>{rule.copy}</p>
        </div>
      </header>
      <div className={styles.payout} data-available={rule.payout.available}>
        <span>{rule.payout.reference ? "Multiplicador de referencia" : "Cuánto paga"}</span>
        <strong>{rule.payout.headline}</strong>
      </div>
      <div className={styles.actions}>
        <button
          aria-controls={detailId}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Contraer" : "Ver"} reglas de ${rule.title}`}
          className={styles.toggle}
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? "Ver menos" : "Ver reglas"}
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <Link aria-label={`Jugar ${rule.title}`} className={styles.play} href={rule.href}>
          Jugar <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className={styles.detail} hidden={!expanded} id={detailId}>
        <section>
          <h3>Cómo jugar</h3>
          <ol>{rule.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
        </section>
        <section>
          <h3>Premio</h3>
          <p>{rule.payout.detail}</p>
          {rule.payout.rows ? (
            <dl className={styles.payoutRows}>
              {rule.payout.rows.map((row) => (
                <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
              ))}
            </dl>
          ) : null}
        </section>
      </div>
    </article>
  );
}
