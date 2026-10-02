import type { Metadata, Viewport } from "next";
import { existsSync } from "node:fs";
import path from "node:path";
import { getDeploymentVersion } from "@/lib/deployment-version";
import { CountdownScreen } from "./screen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Lanzamiento · quinie.LA" },
  description: "Cada segundo nos acerca al lanzamiento de quinie.LA. ¡Vamos equipo!",
  robots: { index: false, follow: false, noarchive: true },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#071126" };

export default async function CountdownPage() {
  const available = (file: string) => existsSync(path.join(process.cwd(), "public", file));
  const audio = "/assets/contador/audio/celebracion.mp3";
  const siren = "/assets/contador/audio/sirena-quinie.wav";
  const deploymentVersion = await getDeploymentVersion();
  // A dynamic server request supplies the hydration snapshot; the client never reads time during render.
  // eslint-disable-next-line react-hooks/purity
  const initialNow = Date.now();
  return <CountdownScreen initialNow={initialNow} deploymentVersion={deploymentVersion} audio={available(audio) ? audio : undefined}
    siren={available(siren) ? siren : undefined} />;
}
