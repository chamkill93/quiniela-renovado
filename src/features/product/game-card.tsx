import Link from "next/link";
import { formatGs, type ProductGame } from "@/lib/product/catalog";
import { GameIcon } from "./game-icon";
import styles from "./product.module.css";

export function GameCard({
  game,
  href,
  testId,
}: {
  game: ProductGame<string>;
  href: string;
  eager?: boolean;
  testId?: string;
}) {
  return (
    <Link className={styles.gameCard} data-tone={game.tone} href={href} data-testid={testId}>
      <span className={styles.gameVisual} aria-hidden="true">
        <GameIcon className={styles.gameEmblem} gameId={game.id} />
      </span>
      <span className={styles.gameCardEyebrow}>{game.eyebrow}</span>
      <strong>{game.name}</strong>
      <p>{game.description}</p>
      <span className={styles.gameCardFooter}>
        <span className={styles.gamePrice}><small>Desde</small>{formatGs(game.basePrice)}</span>
        <span className={styles.cardCta} aria-hidden="true">Jugar</span>
      </span>
    </Link>
  );
}
