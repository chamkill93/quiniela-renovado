import { describe, expect, it, vi } from "vitest";

import { createRandomHeroValue } from "@/features/product/home-hero-random";

describe("rodillo promocional aleatorio de Inicio", () => {
  it("genera siempre tres cifras dentro del rango 001–999", () => {
    expect(createRandomHeroValue(() => 0)).toBe("001");
    expect(createRandomHeroValue(() => 0.5)).toBe("500");
    expect(createRandomHeroValue(() => 1)).toBe("999");
    expect(createRandomHeroValue(() => Number.NaN)).toBe("001");
  });

  it("evita repetir la combinación anterior", () => {
    const random = vi.fn(() => 0);

    expect(createRandomHeroValue(random, "001")).toBe("002");
    expect(random).toHaveBeenCalledTimes(1);
  });

  it("vuelve de 999 a 001 cuando debe evitar una repetición", () => {
    expect(createRandomHeroValue(() => 1, "999")).toBe("001");
  });
});
