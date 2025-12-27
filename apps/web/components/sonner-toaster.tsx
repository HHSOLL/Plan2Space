"use client";

import { Toaster } from "sonner";

export function SonnerToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      expand={false}
      toastOptions={{
        classNames: {
          toast:
            "rounded-2xl border border-stone-200 bg-white/90 text-stone-900 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.45)] backdrop-blur",
          title: "font-serif text-sm text-stone-900",
          description: "text-xs text-stone-600",
          icon: "text-stone-700",
          actionButton:
            "rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-stone-50 transition-colors hover:bg-stone-800",
          cancelButton:
            "rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-200",
          closeButton:
            "rounded-full border border-stone-200 bg-white text-stone-600 transition-colors hover:text-stone-900"
        }
      }}
    />
  );
}

