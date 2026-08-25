import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ProductFrame } from "@/features/product/product-frame";
import { ProductProvider } from "@/providers/product-provider";

export const metadata: Metadata = {
  title: { default: "quinie.LA", template: "%s · quinie.LA" },
  description: "Quiniela online de Paraguay.",
  icons: { icon: "/assets/brand/logo_quiniela_original.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07090D" },
    { media: "(prefers-color-scheme: light)", color: "#EFEDE8" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" data-theme="dark" lang="es" suppressHydrationWarning>
      <body>
        <ProductProvider><ProductFrame>{children}</ProductFrame></ProductProvider>
      </body>
    </html>
  );
}
