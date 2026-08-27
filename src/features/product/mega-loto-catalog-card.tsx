import Image from "next/image";

import { MEGA_LOTO_LOGO, MEGA_LOTO_URL } from "./product-links";
import styles from "./product.module.css";

/** Mega Loto is an external product, not a locally available betting engine. */
export function MegaLotoCatalogCard() {
  return (
    <a
      aria-label="Jugar Mega Loto (sitio oficial, abre en una nueva pestaña)"
      className={`${styles.gameCard} ${styles.megaLotoCard}`}
      data-testid="mega-loto-card"
      data-tone="green"
      href={MEGA_LOTO_URL}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span aria-hidden="true" className={styles.gameVisual}>
        <Image
          alt=""
          className={styles.gameEmblem}
          height={164}
          sizes="(max-width: 760px) 72px, 88px"
          src={MEGA_LOTO_LOGO}
          width={164}
        />
      </span>
      <strong>Mega Loto</strong>
      <p>Elegí 6 números del 1 al 40 y ganá el Megapozo.</p>
      <span className={styles.gameCardFooter}>
        <span aria-hidden="true" className={styles.cardCta}>Jugar ↗</span>
      </span>
    </a>
  );
}
