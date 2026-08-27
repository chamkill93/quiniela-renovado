import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MegaLotoCatalogCard } from "@/features/product/mega-loto-catalog-card";
import { MEGA_LOTO_LOGO, MEGA_LOTO_URL } from "@/features/product/product-links";

describe("MegaLotoCatalogCard", () => {
  it("usa el logo oficial y conserva el branding verde sin crear un juego local", () => {
    const markup = renderToStaticMarkup(<MegaLotoCatalogCard />);
    expect(markup).toContain('data-tone="green"');
    expect(markup).toContain("megaLotoCard");
    expect(decodeURIComponent(markup)).toContain(MEGA_LOTO_LOGO);
    expect(markup).toContain(`href="${MEGA_LOTO_URL}"`);
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain("abre en una nueva pestaña");
    expect(markup).toContain("Elegí 6 números del 1 al 40 y ganá el Megapozo.");
    expect(markup).not.toContain("1 al 45");
    expect(markup).not.toContain("/quinielas/megaloto");
    expect(markup).not.toContain("Desde");
  });
});
