import type { Metadata } from "next";
import { Archivo, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";
import { SiteHeader } from "@/components/SiteHeader";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap", weight: ["500", "600", "700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const plexmono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plexmono", display: "swap", weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "Retinue — the retainer that audits the work itself",
  description:
    "Escrowed retainers for content operators, released window by window against what a GenLayer validator panel actually sees live on the public web. Warn, constrain, revoke — with bonded appeals and a portable operator record.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable} ${plexmono.variable}`}>
      <body>
        <WalletProvider>
          <SiteHeader />
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
