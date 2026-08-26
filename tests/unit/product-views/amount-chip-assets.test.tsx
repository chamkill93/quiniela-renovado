// @vitest-environment jsdom

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AmountChip,
  getAmountChipAssetSet,
} from "@/features/product/amount-chip";

const expectedAssets = {
  500: "500",
  1_000: "1k",
  2_000: "2k",
  5_000: "5k",
  10_000: "10k",
  50_000: "50k",
} as const;

afterEach(cleanup);

describe("assets 3D de AmountChip", () => {
  it("mapea solamente los importes que tienen WEBP aprobado en ambos temas", () => {
    for (const [amount, slug] of Object.entries(expectedAssets)) {
      const assets = getAmountChipAssetSet(Number(amount));

      expect(assets).toEqual({
        slug,
        dark: `/assets/quinie-icons-v2/chips/dark/${slug}.webp`,
        light: `/assets/quinie-icons-v2/chips/light/${slug}.webp`,
      });
      expect(existsSync(resolve(process.cwd(), "public", assets!.dark.slice(1)))).toBe(true);
      expect(existsSync(resolve(process.cwd(), "public", assets!.light.slice(1)))).toBe(true);
    }

    expect(getAmountChipAssetSet(20_000)).toBeNull();
    expect(getAmountChipAssetSet(100_000)).toBeNull();
    expect(getAmountChipAssetSet(200_000)).toBeNull();
  });

  it("conserva semántica, selección y acción del botón con asset decorativo", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <AmountChip onSelect={onSelect} selected value={5_000} />,
    );
    const button = screen.getByRole("button", { name: "Gs. 5.000" });
    const asset = container.querySelector<HTMLElement>("[aria-hidden='true']");

    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("data-amount-chip-asset")).toBe("5k");
    expect(asset?.style.getPropertyValue("--quinie-amount-chip-dark")).toContain(
      "/chips/dark/5k.webp",
    );
    expect(asset?.style.getPropertyValue("--quinie-amount-chip-light")).toContain(
      "/chips/light/5k.webp",
    );

    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith(5_000);
  });

  it("mantiene un fallback textual legible cuando no existe asset", () => {
    const { container } = render(
      <AmountChip onSelect={vi.fn()} selected={false} value={20_000} />,
    );
    const button = screen.getByRole("button", { name: "Gs. 20.000" });

    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.hasAttribute("data-amount-chip-asset")).toBe(false);
    expect(container.querySelector("[aria-hidden='true']")?.textContent).toBe("20K");
  });
});
