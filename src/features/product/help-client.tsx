"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { filterHelpQuestions } from "./help-data";
import styles from "./help.module.css";

export function HelpClient() {
  const [query, setQuery] = useState("");
  const questions = filterHelpQuestions(query);

  return <main className={styles.page}>
    <header className={styles.header}>
      <div className={styles.headingRow}>
        <Link
          aria-label="Volver atrás"
          className={styles.backLink}
          href="/"
          onClick={(event) => {
            if (
              event.button === 0
              && !event.altKey
              && !event.ctrlKey
              && !event.metaKey
              && !event.shiftKey
              && window.history.length > 1
            ) {
              event.preventDefault();
              window.history.back();
            }
          }}
          title="Volver atrás"
        >
          <Icon name="arrowLeft" size={19} />
        </Link>
        <div className={styles.headingCopy}>
          <p className={styles.eyebrow}>AYUDA DE QUINIELA</p>
          <h1>Centro de ayuda</h1>
        </div>
      </div>
      <p>Buscá respuestas claras sobre las modalidades y las reglas de juego.</p>
    </header>

    <section aria-label="Buscar ayuda sobre la quiniela" className={styles.searchCard}>
      <label htmlFor="quiniela-help-search">¿Sobre qué tenés dudas?</label>
      <div className={styles.searchRow}>
        <input
          autoComplete="off"
          id="quiniela-help-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscá por modalidad, número, postura o comprobante…"
          type="search"
          value={query}
        />
        {query ? <button aria-label="Limpiar búsqueda" className={styles.clearButton} onClick={() => setQuery("")} type="button"><Icon name="close" size={18} /></button> : null}
      </div>
    </section>

    <section aria-labelledby="help-questions-title" className={styles.questionSection}>
      <div className={styles.sectionHeader}>
        <h2 id="help-questions-title">Preguntas frecuentes</h2>
        <p aria-live="polite" role="status">{questions.length} {questions.length === 1 ? "respuesta" : "respuestas"}</p>
      </div>
      {questions.length ? <div className={styles.questions} key={query}>
        {questions.map((item) => <details className={styles.question} key={item.id}>
          <summary><span>{item.question}</span><Icon name="plus" size={18} /></summary>
          <div className={styles.answer}>
            <p>{item.answer}</p>
            <Link href={item.href}>{item.linkLabel}<Icon name="chevronRight" size={14} /></Link>
          </div>
        </details>)}
      </div> : <div className={styles.empty}>
        <Icon name="info" size={26} />
        <h3>No encontramos esa consulta</h3>
        <p>Probá con otra palabra o volvé a ver todas las preguntas.</p>
        <button onClick={() => setQuery("")} type="button">Ver todas las preguntas</button>
      </div>}
    </section>
  </main>;
}
