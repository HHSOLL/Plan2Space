"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

function requiresGlobalNavbarOffset(pathname: string | null) {
  if (!pathname) return true;
  if (pathname.startsWith("/project/")) return false;
  if (pathname.startsWith("/shared/")) return false;
  if (pathname.startsWith("/studio/builder")) return false;
  return true;
}

export function AppViewportShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const withOffset = requiresGlobalNavbarOffset(pathname);

  return (
    <main className={`relative min-h-screen w-full overflow-x-hidden ${withOffset ? "pt-12" : ""}`}>
      {children}
    </main>
  );
}
