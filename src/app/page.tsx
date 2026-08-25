import Link from "next/link";
import Image from "next/image";
import { GameCard } from "@/features/product/game-card";
import { SectionHeader } from "@/features/product/section-header";
import { INSTANT_GAMES, MOCK_DRAWS } from "@/lib/product/catalog";
import styles from "@/features/product/product.module.css";

const QUICK_LINKS = [
  {
    href: "/quinielas",
    label: "Quiniela tradicional",
    description: "Seis formas de jugar tus números.",
    icon: "/assets/icons/game/head.svg",
  },
  {
    href: "/instantaneas",
    label: "Instantáneas",
    description: "Nueve juegos, resultado al momento.",
    icon: "/assets/icons/game/bolt.svg",
  },
  {
    href: "/quinielas/megaloto",
    label: "Megaloto",
    description: "Elegí seis números del 1 al 45.",
    icon: "/assets/icons/game/mega.svg",
  },
] as const;

export default function HomePage() {
  return (
    <main className={`${styles.page} ${styles.pageStack}`}>
      <section aria-labelledby="hero-title">
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Quiniela online · Paraguay</p>
            <h1 className={styles.heroTitle} id="hero-title">
              Tus números.<br />Tu momento<span>.</span>
            </h1>
            <p className={styles.heroText}>
              Una experiencia de Quiniela más clara, rápida y preparada para acompañarte en cada jugada.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/quinielas">Jugar Quiniela</Link>
              <Link className={styles.secondaryButton} href="/instantaneas">Ver Instantáneas</Link>
            </div>
          </div>
        </div>

        <div className={styles.quickGrid} aria-label="Accesos rápidos">
          {QUICK_LINKS.map((item) => (
            <Link className={styles.quickCard} href={item.href} key={item.href}>
              <span className={styles.quickIcon} aria-hidden="true"><Image src={item.icon} alt="" width={34} height={34} /></span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="draws-title">
        <SectionHeader
          eyebrow="Resultados recientes"
          title="Sorteos del día"
          description="Consultá cada horario de manera simple y verificable."
          href="/resultados"
          linkLabel="Ver resultados"
          headingLevel={2}
        />
        <div className={styles.drawGrid}>
          {MOCK_DRAWS.map((draw) => (
            <article className={styles.drawCard} data-tone={draw.tone} key={draw.id}>
              <span>{draw.label}</span>
              <strong>{draw.result}</strong>
              <div className={styles.drawMeta}><span>{draw.time}</span><span>Publicado</span></div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="instant-title">
        <SectionHeader
          eyebrow="Resultado al momento"
          title="Instantáneas para cada intuición"
          description="Números, paridad y coincidencias en una experiencia rápida con resultado autoritativo."
          href="/instantaneas"
          linkLabel="Ver las 9"
          headingLevel={2}
        />
        <div className={styles.gameGrid}>
          {INSTANT_GAMES.slice(0, 6).map((game, index) => (
            <GameCard eager={index < 3} game={game} href={`/instantaneas/${game.id}`} key={game.id} />
          ))}
        </div>
      </section>

      <section className={styles.megaBanner} aria-labelledby="mega-title">
        <div>
          <p className={styles.eyebrow}>Seis números · 1 al 45</p>
          <h2 id="mega-title">Megaloto</h2>
          <p>Armá tu combinación manualmente o dejá que el selector la prepare por vos.</p>
          <Link className={styles.primaryButton} href="/quinielas/megaloto">Elegir números</Link>
        </div>
      </section>
    </main>
  );
}
