import type { CSSProperties } from "react";

import { formatGs } from "@/lib/product/catalog";
import chipStyles from "./amount-chip.module.css";
import productStyles from "./product.module.css";

const AMOUNT_CHIP_ASSET_SLUGS = {
  500: "500",
  1_000: "1k",
  2_000: "2k",
  5_000: "5k",
  10_000: "10k",
  50_000: "50k",
} as const satisfies Record<number, string>;

interface AmountChipAssetStyle extends CSSProperties {
  "--quinie-amount-chip-dark": string;
  "--quinie-amount-chip-light": string;
}

export function getAmountChipAssetSet(value: number) {
  const slug = AMOUNT_CHIP_ASSET_SLUGS[value as keyof typeof AMOUNT_CHIP_ASSET_SLUGS];
  if (!slug) return null;

  const basePath = "/assets/quinie-icons-v2/chips";
  return {
    slug,
    dark: `${basePath}/dark/${slug}.webp`,
    light: `${basePath}/light/${slug}.webp`,
  } as const;
}

export function AmountChip({
  value,
  selected,
  onSelect,
}: {
  value: number;
  selected: boolean;
  onSelect: (value: number) => void;
}) {
  const assets = getAmountChipAssetSet(value);
  const assetStyle: AmountChipAssetStyle | undefined = assets
    ? {
        "--quinie-amount-chip-dark": `url("${assets.dark}")`,
        "--quinie-amount-chip-light": `url("${assets.light}")`,
      }
    : undefined;

  return (
    <button
      aria-label={formatGs(value)}
      aria-pressed={selected}
      className={`${productStyles.amountChip} ${chipStyles.amountChip}`}
      data-amount-chip-asset={assets?.slug}
      data-selected={selected}
      data-tone={amountTone(value)}
      onClick={() => onSelect(value)}
      type="button"
    >
      {assets ? (
        <span
          aria-hidden="true"
          className={`${productStyles.amountChipFace} ${chipStyles.assetFace}`}
          style={assetStyle}
        />
      ) : (
        <span aria-hidden="true" className={productStyles.amountChipFace}>
          <span>{compactAmount(value)}</span>
        </span>
      )}
    </button>
  );
}

function compactAmount(value: number) {
  if (value >= 1_000 && value % 1_000 === 0) return `${value / 1_000}K`;
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(value);
}

function amountTone(value: number) {
  if (value <= 500) return "black";
  if (value <= 1_000) return "green";
  if (value <= 2_000) return "blue";
  if (value <= 5_000) return "red";
  if (value <= 10_000) return "orange";
  if (value <= 20_000) return "cyan";
  if (value <= 50_000) return "purple";
  if (value <= 100_000) return "silver";
  return "gold";
}
