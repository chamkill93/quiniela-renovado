import { CatalogPageClient } from "@/features/product/catalog-views";

export default function InstantCatalogPage() {
  return (
    <CatalogPageClient
      description="Elegí entre los juegos habilitados y recibí el resultado autoritativo del backoffice."
      eyebrow="Catálogo operativo"
      family="instant"
      limit={9}
      title="Instantáneas"
    />
  );
}
