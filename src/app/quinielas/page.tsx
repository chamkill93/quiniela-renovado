import { GameCard } from "@/features/product/game-card";
import { SectionHeader } from "@/features/product/section-header";
import { TRADITIONAL_GAMES } from "@/lib/product/catalog";
import styles from "@/features/product/product.module.css";

export default function TraditionalCatalogPage() {
  return (
    <main className={styles.page}>
      <SectionHeader
        eyebrow="Quiniela tradicional"
        title="Elegí cómo querés jugar"
        description="Ingresá tus números sin grillas interminables. Cada modalidad conserva sus reglas y posiciones."
      />
      <div className={styles.gameGrid}>
        {TRADITIONAL_GAMES.map((game, index) => (
          <GameCard eager={index < 3} game={game} href={`/quinielas/${game.id}`} key={game.id} />
        ))}
      </div>
    </main>
  );
}
