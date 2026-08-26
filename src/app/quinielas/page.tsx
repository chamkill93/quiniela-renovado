import { CatalogPageClient } from "@/features/product/catalog-views";

export default function TraditionalCatalogPage() {
  return (
    <CatalogPageClient
      description="Las modalidades, reglas visibles y disponibilidad son informadas por el backoffice."
      eyebrow="Quiniela tradicional"
      family="traditional"
      limit={4}
      title="Elegí cómo querés jugar"
    />
  );
}
