import Link from "next/link";

import { GameIcon } from "./game-icon";
import { isQuinieGameIconId } from "./game-icon-map";
import type { CatalogGameView } from "./product-view-mappers";
import styles from "./product.module.css";

export function CatalogGameCard({
  game,
  testId,
}: {
  game: CatalogGameView;
  eager?: boolean;
  testId?: string;
}) {
  const iconId = game.iconKey ?? (isQuinieGameIconId(game.id) ? game.id : null);

  return (
    <Link
      aria-label={`Jugar ${game.name}`}
      className={styles.gameCard}
      data-testid={testId}
      data-tone={game.tone}
      href={game.href}
    >
      <span aria-hidden="true" className={styles.gameVisual}>
        {iconId ? <GameIcon className={styles.gameEmblem} gameId={iconId} /> : null}
      </span>
      <strong>{game.name}</strong>
      <p>{game.description}</p>
      <span className={styles.gameCardFooter}>
        <span aria-hidden="true" className={styles.cardCta}>Jugar</span>
      </span>
    </Link>
  );
}
