import { CatalogPageClient } from "@/features/product/catalog-views";

export default function TraditionalCatalogPage() {
  return (
    <CatalogPageClient
      description="Elegí una modalidad, revisá sus reglas y participá del sorteo."
      eyebrow="Quiniela tradicional"
      family="traditional"
      limit={4}
      title="Elegí cómo querés jugar"
    />
  );
}
