import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";
import { Inter, Playfair_Display } from "next/font/google";
import { AuthStatus } from "../components/auth-status";
import { SonnerToaster } from "../components/sonner-toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });

export const metadata = {
  title: "Plan2Space",
  description: "AI blueprint to immersive 3D interior walkthrough"
};

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-600 transition-colors hover:text-stone-900"
    >
      {children}
    </Link>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${playfair.variable}`}>
      <body className="bg-stone-50 text-stone-900 font-sans antialiased selection:bg-stone-200">
        <SonnerToaster />
        <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-stone-50/70 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-serif text-lg text-stone-900">
              plan2space
            </Link>
            <nav className="flex items-center gap-5">
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/projects/create">New Project</NavLink>
              <AuthStatus />
            </nav>
          </div>
        </header>
        <main className="w-full">{children}</main>
        <footer className="border-t border-stone-200/80 bg-stone-50">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-stone-500">
            <span className="tracking-wide">© plan2space</span>
            <span className="tracking-wide">AI-driven 3D interior studio</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
