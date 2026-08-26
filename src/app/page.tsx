import Link from "next/link";
import { HomeRemoteSections } from "@/features/product/catalog-views";
import { GameIcon } from "@/features/product/game-icon";
import styles from "@/features/product/product.module.css";

const QUICK_LINKS = [
  {
    href: "/quinielas",
    label: "Quiniela tradicional",
    description: "Seis formas de jugar tus números.",
    gameId: "head",
  },
  {
    href: "/instantaneas",
    label: "Instantáneas",
    description: "Nueve juegos, resultado al momento.",
    gameId: "sapyaite",
  },
  {
    href: "/resultados",
    label: "Resultados",
    description: "Publicaciones recibidas del backoffice.",
    gameId: "prizes",
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
              <span className={styles.quickIcon} aria-hidden="true"><GameIcon gameId={item.gameId} /></span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
            </Link>
          ))}
        </div>
      </section>

      <HomeRemoteSections />
    </main>
  );
}
