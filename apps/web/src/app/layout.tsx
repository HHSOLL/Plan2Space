import type { ReactNode } from "react";
import "../lib/server/runtime-polyfills";
import "../styles/globals.css";
import { Inter, Outfit, Cormorant_Garamond } from "next/font/google";
import { SonnerToaster } from "../components/sonner-toaster";
import { LoadingOverlay } from "../components/overlay/LoadingOverlay";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap"
});

export const metadata = {
  title: "Plan2Space | AI Architectural Design Studio",
  description: "Transform 2D blueprints into high-end 3D living spaces with precision AI analysis and immersive rendering.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

import { Providers } from "../components/providers/Providers";
import { PremiumNavbar } from "../components/navigation/PremiumNavbar";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${outfit.variable} ${cormorant.variable}`}>
      <body className="bg-[#fdfdfc] text-[#1a1a1a] font-sans antialiased selection:bg-black/5">
        <LoadingOverlay />
        <SonnerToaster />
        <Providers>
          <PremiumNavbar />
          <main className="relative min-h-screen w-full overflow-x-hidden pt-20 md:pt-0">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
