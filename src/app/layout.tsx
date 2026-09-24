import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"], display: "swap" });

export const metadata: Metadata = {
  title: "Sinuca Next",
  description: "Campeonato interno de sinuca da Next Fit",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1a082e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={nunito.className}>{children}</body>
    </html>
  );
}
