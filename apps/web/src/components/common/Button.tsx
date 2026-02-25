"use client";

import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button">;

export function Button({ className, children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
