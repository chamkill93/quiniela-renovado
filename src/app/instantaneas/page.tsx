import { CatalogPageClient } from "@/features/product/catalog-views";

export default function InstantCatalogPage() {
  return (
    <CatalogPageClient
      description="Elegí entre los juegos disponibles y conocé el resultado al instante."
      eyebrow="Catálogo operativo"
      family="instant"
      limit={9}
      title="Instantáneas"
    />
  );
}
