import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DrawPageClient } from "@/features/product/draw-page-client";
import {
  DRAW_PAGE_DEFINITIONS,
  getConfiguredDrawStreamUrl,
  getDrawPageDefinition,
} from "@/features/product/draw-page-data";

interface DrawRouteProps {
  params: Promise<{ drawSlug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return DRAW_PAGE_DEFINITIONS.map(({ slug }) => ({ drawSlug: slug }));
}

export async function generateMetadata({
  params,
}: DrawRouteProps): Promise<Metadata> {
  const { drawSlug } = await params;
  const definition = getDrawPageDefinition(drawSlug);

  if (!definition) return { title: "Sorteo no encontrado" };

  return {
    title: `Sorteo ${definition.name}`,
    description: `Programación, transmisión autorizada y resultados del sorteo ${definition.name} de quinie.LA.`,
  };
}

export default async function DrawPage({ params }: DrawRouteProps) {
  const { drawSlug } = await params;
  const definition = getDrawPageDefinition(drawSlug);
  if (!definition) notFound();

  return (
    <DrawPageClient
      definition={definition}
      streamUrl={getConfiguredDrawStreamUrl(definition.drawId)}
    />
  );
}
