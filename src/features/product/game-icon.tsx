import type { CSSProperties } from "react";

import { getGameIconAssetSet } from "./game-icon-map";
import iconStyles from "./game-icon.module.css";

interface GameIconStyle extends CSSProperties {
  "--quinie-game-icon-dark": string;
  "--quinie-game-icon-light": string;
}

export function GameIcon({
  gameId,
  className,
}: {
  gameId: string;
  className?: string;
}) {
  const assets = getGameIconAssetSet(gameId);
  if (!assets) return null;

  const style: GameIconStyle = {
    "--quinie-game-icon-dark": `url("${assets.dark}")`,
    "--quinie-game-icon-light": `url("${assets.light}")`,
  };

  return (
    <span
      aria-hidden="true"
      className={`${iconStyles.icon} ${className ?? ""}`.trim()}
      data-game-icon={gameId}
      data-game-icon-family={assets.family}
      data-game-icon-slug={assets.slug}
      style={style}
    />
  );
}
