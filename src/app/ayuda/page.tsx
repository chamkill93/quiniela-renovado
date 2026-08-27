import type { Metadata } from "next";
import { HelpClient } from "@/features/product/help-client";

export const metadata: Metadata = { title: "Centro de ayuda", description: "Preguntas frecuentes sobre cómo jugar a la quiniela, sorteos, resultados y comprobantes." };

export default function HelpPage() {
  return <HelpClient />;
}
