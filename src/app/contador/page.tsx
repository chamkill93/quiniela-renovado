import type { Metadata, Viewport } from "next";
import { existsSync } from "node:fs";
import path from "node:path";
import { CountdownScreen } from "./screen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Lanzamiento · quinie.LA" },
  description: "Cada segundo nos acerca al lanzamiento de quinie.LA. ¡Vamos equipo!",
  robots: { index: false, follow: false, noarchive: true },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#faf8f6" };

export default function CountdownPage() {
  const available = (file: string) => existsSync(path.join(process.cwd(), "public", file));
  const mascot = "/assets/contador/mascot/quinie-mascot.png";
  const audio = "/assets/contador/audio/celebracion.mp3";
  // A dynamic server request supplies the hydration snapshot; the client never reads time during render.
  // eslint-disable-next-line react-hooks/purity
  const initialNow = Date.now();
  return <CountdownScreen initialNow={initialNow} mascot={available(mascot) ? mascot : undefined}
    audio={available(audio) ? audio : undefined} />;
}
