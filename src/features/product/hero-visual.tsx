import { GameIcon } from "./game-icon";
import styles from "./hero-visual.module.css";

const REEL_DIGITS = ["4", "9", "7"] as const;
const QUICK_AMOUNTS = ["500", "1K", "2K", "5K"] as const;

/** Decorative composition built from the visual language in the current UI kit. */
export function HeroVisual() {
  return (
    <div aria-hidden="true" className={styles.visual}>
      <div className={styles.glow} />
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Rodillo resultado</span>
          <span className={styles.live}><i /> En vivo</span>
        </div>

        <div className={styles.reelRow}>
          {REEL_DIGITS.map((digit, index) => (
            <div className={styles.reel} key={`${digit}-${index}`}>
              <span>{(Number(digit) + 9) % 10}</span>
              <strong>{digit}</strong>
              <span>{(Number(digit) + 1) % 10}</span>
            </div>
          ))}
        </div>

        <div className={styles.lowerRow}>
          <div className={styles.gameIcons}>
            {(["head", "redoblona", "pyae"] as const).map((gameId) => (
              <span className={styles.gameIcon} key={gameId}>
                <GameIcon gameId={gameId} />
              </span>
            ))}
          </div>
          <div className={styles.winner}>
            <span className={styles.trophy}>★</span>
            <span><small>Resultado</small><strong>¡Ganaste!</strong></span>
          </div>
        </div>

        <div className={styles.chips}>
          {QUICK_AMOUNTS.map((amount, index) => (
            <span className={styles.chip} data-tone={index} key={amount}>
              <i>{amount}</i>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
