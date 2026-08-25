import { GameCard } from "@/features/product/game-card";
import { SectionHeader } from "@/features/product/section-header";
import { INSTANT_GAMES } from "@/lib/product/catalog";
import styles from "@/features/product/product.module.css";

export default function InstantCatalogPage() {
  return (
    <main className={styles.page}>
      <SectionHeader
        eyebrow="Nueve formas de probar tu intuición"
        title="Instantáneas"
        description="Elegí, confirmá y mirá cómo los rodillos llegan al resultado definido por el servidor."
      />
      <div className={styles.gameGrid} data-testid="instant-games-grid">
        {INSTANT_GAMES.map((game, index) => (
          <GameCard eager={index < 3} game={game} href={`/instantaneas/${game.id}`} key={game.id} testId="instant-game-card" />
        ))}
      </div>
    </main>
  );
}
