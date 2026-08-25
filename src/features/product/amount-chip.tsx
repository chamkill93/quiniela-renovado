import { formatGs } from "@/lib/product/catalog";
import styles from "./product.module.css";

export function AmountChip({
  value,
  selected,
  onSelect,
}: {
  value: number;
  selected: boolean;
  onSelect: (value: number) => void;
}) {
  return (
    <button
      aria-label={formatGs(value)}
      aria-pressed={selected}
      className={styles.amountChip}
      data-selected={selected}
      data-tone={amountTone(value)}
      onClick={() => onSelect(value)}
      type="button"
    >
      <span className={styles.amountChipFace} aria-hidden="true">
        <span>{compactAmount(value)}</span>
      </span>
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
