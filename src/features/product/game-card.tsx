import Link from "next/link";
import Image from "next/image";
import type { ProductGame } from "@/lib/product/catalog";
import styles from "./product.module.css";

export function GameCard({
  game,
  href,
  eager = false,
  testId,
}: {
  game: ProductGame<string>;
  href: string;
  eager?: boolean;
  testId?: string;
}) {
  return (
    <Link className={styles.gameCard} href={href} data-testid={testId}>
      <span className={styles.gameVisual} aria-hidden="true">
        <Image src={game.art} alt="" width={260} height={220} loading={eager ? "eager" : "lazy"} />
        <Image src={game.icon} alt="" width={62} height={62} />
      </span>
      <span className={styles.gameCardEyebrow}>{game.eyebrow}</span>
      <strong>{game.name}</strong>
      <p>{game.description}</p>
      <span className={styles.cardArrow} aria-hidden="true">→</span>
    </Link>
  );
}
