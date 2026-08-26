import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  GAME_ICON_DEFINITIONS,
  getGameIcon,
  getGameIconAssetSet,
} from "@/features/product/game-icon-map";

const expectedAssets = {
  head: ["traditional", "a-la-cabeza"],
  prizes: ["traditional", "a-los-premios"],
  invert: ["traditional", "invertida"],
  redoblona: ["traditional", "redoblona"],
  "sapyaite-traditional": ["traditional", "sapyaite-tradicional"],
  megaloto: ["traditional", "megaloto"],
  sapyaite: ["instant", "sapyaite"],
  poa: ["instant", "poa"],
  pyae: ["instant", "pyae"],
  petei: ["instant", "petei"],
  mokoi: ["instant", "mokoi"],
  mbohapy: ["instant", "mbohapy"],
  poa5: ["instant", "poa-5"],
  poa10: ["instant", "poa-10"],
  racha5: ["instant", "racha-5"],
} as const;

describe("resolver de iconos 3D quinie.LA", () => {
  it("mapea cada ID canónico a su familia y slug aprobados", () => {
    expect(Object.keys(GAME_ICON_DEFINITIONS)).toEqual(Object.keys(expectedAssets));

    for (const [gameId, [family, slug]] of Object.entries(expectedAssets)) {
      expect(getGameIconAssetSet(gameId)).toMatchObject({ family, slug });
      expect(getGameIcon(gameId, "dark")).toBe(
        `/assets/quinie-icons-v2/games/${family}/dark/${slug}.webp`,
      );
      expect(getGameIcon(gameId, "light")).toBe(
        `/assets/quinie-icons-v2/games/${family}/light/${slug}.webp`,
      );
      expect(
        existsSync(resolve(process.cwd(), "public", "assets", "quinie-icons-v2", "games", family, "dark", `${slug}.webp`)),
      ).toBe(true);
      expect(
        existsSync(resolve(process.cwd(), "public", "assets", "quinie-icons-v2", "games", family, "light", `${slug}.webp`)),
      ).toBe(true);
    }
  });

  it("rechaza keys desconocidas en lugar de interpolarlas en una ruta pública", () => {
    expect(getGameIcon("icono-entregado-por-un-backoffice", "dark")).toBeNull();
    expect(getGameIconAssetSet("../ruta-insegura")).toBeNull();
  });
});
