"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { HELP_CATEGORIES, filterHelpQuestions, type HelpCategory } from "./help-data";
import styles from "./help.module.css";

export function HelpClient() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategory>("Todas");
  const questions = filterHelpQuestions(query, category);
  const clear = () => { setQuery(""); setCategory("Todas"); };

  return <main className={styles.page}>
    <header className={styles.header}><p className={styles.eyebrow}>ESTAMOS PARA AYUDARTE</p><h1>Centro de ayuda</h1><p>Todo lo que necesitás saber para jugar a la quiniela.</p></header>
    <section aria-label="Buscar ayuda sobre la quiniela" className={styles.searchCard}>
      <label htmlFor="quiniela-help-search">¿Sobre qué tenés dudas?</label>
      <div className={styles.searchRow}><input autoComplete="off" id="quiniela-help-search" onChange={(event) => setQuery(event.target.value)} placeholder="Buscá por número, sorteo, comprobante…" type="search" value={query} />{query ? <button aria-label="Limpiar búsqueda" className={styles.clearButton} onClick={() => setQuery("")} type="button"><Icon name="close" size={18} /></button> : null}</div>
      <div aria-label="Temas de ayuda" className={styles.categories} role="group">{HELP_CATEGORIES.map((item) => <button aria-pressed={category === item} key={item} onClick={() => setCategory(item)} type="button">{item}</button>)}</div>
    </section>
    <section aria-labelledby="help-questions-title" className={styles.questionSection}>
      <div className={styles.sectionHeader}><h2 id="help-questions-title">Preguntas frecuentes</h2><p aria-live="polite" role="status">{questions.length} {questions.length === 1 ? "respuesta" : "respuestas"}</p></div>
      {questions.length ? <div className={styles.questions} key={`${category}:${query}`}>
        {questions.map((item) => <details className={styles.question} key={item.id}>
          <summary><span>{item.question}</span><Icon name="plus" size={18} /></summary>
          <div className={styles.answer}><span className={styles.topic}>{item.category}</span><p>{item.answer}</p><Link href={item.href}>{item.linkLabel}<Icon name="chevronRight" size={14} /></Link></div>
        </details>)}
      </div> : <div className={styles.empty}><Icon name="info" size={26} /><h3>No encontramos esa consulta</h3><p>Probá con otra palabra o consultá todas las preguntas.</p><button onClick={clear} type="button">Ver todas las preguntas</button></div>}
    </section>
    <aside className={styles.supportCard}><span className={styles.supportIcon}><Icon name="user" size={24} /></span><div><h2>¿Necesitás más ayuda?</h2><p>Accedé a las opciones de atención desde tu cuenta. Si consultás por una jugada, tené a mano su comprobante.</p></div><Link href="/cuenta">Ir a mi cuenta<Icon name="chevronRight" size={16} /></Link></aside>
    <div className={styles.footerLinks}><Link href="/reglas">Reglas de la quiniela</Link><Link href="/legal/juego-responsable">Juego responsable</Link></div>
  </main>;
}
