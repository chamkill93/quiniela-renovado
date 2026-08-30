import type { Metadata } from "next";
import { HelpClient } from "@/features/product/help-client";

export const metadata: Metadata = { title: "Centro de ayuda", description: "Preguntas frecuentes sobre las modalidades, reglas, sorteos, resultados y comprobantes de la Quiniela." };

export default function HelpPage() {
  return <HelpClient />;
}
