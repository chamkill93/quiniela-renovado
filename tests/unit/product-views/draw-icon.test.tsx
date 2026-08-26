import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DRAW_ICON_DEFINITIONS,
  DrawIcon,
  getDrawIconAssetSet,
} from "@/features/product/draw-icon";

describe("assets de los sorteos canónicos", () => {
  it.each([
    ["early", "tempranero", "Tempranero"],
    ["morning", "matutino", "Matutino"],
    ["evening", "vespertino", "Vespertino"],
    ["night", "nocturno", "Nocturno"],
  ] as const)("mapea %s al asset %s sin cambiar el ID", (drawId, slug, label) => {
    expect(DRAW_ICON_DEFINITIONS[drawId]).toEqual({ slug, label });
    expect(getDrawIconAssetSet(drawId)).toEqual({
      slug,
      label,
      dark: `/assets/quinie-icons-v2/draws/dark/${slug}.webp`,
      light: `/assets/quinie-icons-v2/draws/light/${slug}.webp`,
    });
  });

  it("declara ambos temas en CSS y conserva un texto accesible", () => {
    const markup = renderToStaticMarkup(
      <DrawIcon drawId="night" label="Nocturno remoto · 21:00" />,
    );

    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Sorteo Nocturno remoto · 21:00"');
    expect(markup).toContain("--quinie-draw-icon-dark");
    expect(markup).toContain("draws/dark/nocturno.webp");
    expect(markup).toContain("--quinie-draw-icon-light");
    expect(markup).toContain("draws/light/nocturno.webp");
  });

  it("no asigna un icono local a un ID remoto desconocido", () => {
    expect(getDrawIconAssetSet("draw-remoto-42")).toBeNull();
    expect(renderToStaticMarkup(<DrawIcon drawId="draw-remoto-42" />)).toBe("");
  });
});
