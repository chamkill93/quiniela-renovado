"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { GameIcon } from "./game-icon";
import { MEGA_LOTO_LOGO } from "./product-links";
import type { RuleGameCard } from "./rules-page-data";
import styles from "./rules.module.css";

export function RuleCard({ rule }: { rule: RuleGameCard }) {
  const [expanded, setExpanded] = useState(false);
  const titleId = `rule-${rule.id}-title`;
  const detailId = `rule-${rule.id}-detail`;

  return (
    <article
      aria-labelledby={titleId}
      className={styles.card}
      data-expanded={expanded}
      data-game={rule.id}
      data-testid={`rule-card-${rule.id}`}
    >
      <header className={styles.header}>
        <span aria-hidden="true" className={styles.icon}>
          {rule.id === "megaloto" ? (
            <Image alt="" height={54} src={MEGA_LOTO_LOGO} width={54} />
          ) : <GameIcon gameId={rule.id} />}
        </span>
        <div className={styles.headerCopy}>
          <h2 id={titleId}>{rule.title}</h2>
          <p>{rule.copy}</p>
        </div>
      </header>
      <dl className={styles.facts}>
        {rule.facts.map((fact) => (
          <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
        ))}
      </dl>
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
        {rule.family === "external" ? (
          <a
            aria-label={`Sitio oficial de ${rule.title} (abre en una nueva pestaña)`}
            className={styles.play}
            href={rule.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            Sitio oficial <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <Link aria-label={`Jugar ${rule.title}`} className={styles.play} href={rule.href}>
            Jugar <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      <div className={styles.detail} hidden={!expanded} id={detailId}>
        <section>
          <h3>Paso a paso</h3>
          <ol className={styles.instructions}>{rule.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
        </section>
        <section>
          <h3>Condiciones del acierto</h3>
          <ul className={styles.conditions}>{rule.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
        </section>
        <section className={styles.example}>
          <h3>Ejemplo</h3>
          <p>{rule.example}</p>
        </section>
      </div>
    </article>
  );
}
