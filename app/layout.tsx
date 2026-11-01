import type { CSSProperties, ReactNode } from "react";
import { brandCssVars, getBrand } from "@/lib/brand";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const brand = getBrand();

export const metadata = {
  title: brand.productName,
  description: brand.tagline,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-brand={brand.id} style={brandCssVars(brand) as CSSProperties}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={brand.fonts.googleHref} rel="stylesheet" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
