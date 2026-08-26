import Image from "next/image";
import Link from "next/link";

import { formatGs } from "@/lib/product/catalog";

import { GameIcon } from "./game-icon";
import type { CatalogGameView } from "./product-view-mappers";
import styles from "./product.module.css";

export function CatalogGameCard({
  game,
  eager = false,
  testId,
}: {
  game: CatalogGameView;
  eager?: boolean;
  testId?: string;
}) {
  return (
    <Link
      className={styles.gameCard}
      data-testid={testId}
      data-tone={game.tone}
      href={game.href}
    >
      <span aria-hidden="true" className={styles.gameVisual}>
        <Image
          alt=""
          height={220}
          loading={eager ? "eager" : "lazy"}
          src={game.art}
          width={260}
        />
        <GameIcon className={styles.gameEmblem} gameId={game.id} />
      </span>
      <span className={styles.gameCardEyebrow}>{game.eyebrow}</span>
      <strong>{game.name}</strong>
      <p>{game.description}</p>
      <span className={styles.gameCardFooter}>
        <span className={styles.gamePrice}>
          <small>{game.baseAmount === null ? "Monto" : "Desde"}</small>
          {game.baseAmount === null ? "Consultar" : formatGs(game.baseAmount)}
        </span>
        <span aria-hidden="true" className={styles.cardCta}>Jugar</span>
      </span>
    </Link>
  );
}
