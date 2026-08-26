import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
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

const themeBootstrap = `(()=>{try{const stored=localStorage.getItem("quinie_theme");document.documentElement.dataset.theme=stored==="light"?"light":"dark"}catch{document.documentElement.dataset.theme="dark"}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" data-theme="dark" lang="es" suppressHydrationWarning>
      <head>
        <Script id="quinie-theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
      </head>
      <body>
        <ProductProvider><ProductFrame>{children}</ProductFrame></ProductProvider>
      </body>
    </html>
  );
}
