import type { Metadata } from "next";
import { Baloo_2, Onest, Unbounded } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Effects } from "@/components/Effects";
import { cn } from "@/lib/utils";

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

/* only for the logo mark — matches the brand asset */
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "quinie.LA — La quiniela en tu celular",
  description:
    "Jugá a la quiniela desde tu celular: cuatro sorteos por día, juegos instantáneos y resultados al toque. quinie.LA",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={cn("h-full antialiased", unbounded.variable, onest.variable, baloo.variable)}
    >
      {/* espacio inferior para el dock flotante en mobile */}
      <body className="min-h-full flex flex-col pb-[76px] md:pb-6">
        <Effects />
        <Navbar />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
