"use client";

import type { LucideIcon } from "lucide-react";

type StudioModeOption = {
  id: string;
  label: string;
  icon: LucideIcon;
  enabled?: boolean;
};

type StudioModeToggleProps = {
  value: string;
  modes: StudioModeOption[];
  onChange: (id: string) => void;
  variant?: "glass" | "solid";
  hideLabelsOnMobile?: boolean;
  className?: string;
};

export function StudioModeToggle({
  value,
  modes,
  onChange,
  variant = "glass",
  hideLabelsOnMobile = false,
  className = ""
}: StudioModeToggleProps) {
  const wrapperClassName =
    variant === "glass"
      ? "flex overflow-x-auto rounded-[16px] border border-white/5 bg-black/35 p-1 shadow-2xl sm:rounded-[24px]"
      : "flex flex-wrap items-center gap-2";

  return (
    <div className={`${wrapperClassName} ${className}`.trim()}>
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          onClick={() => onChange(mode.id)}
          disabled={mode.enabled === false}
          className={`flex items-center gap-2 whitespace-nowrap rounded-[12px] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.15em] transition-all duration-300 sm:rounded-[18px] sm:px-6 sm:py-3 sm:text-[10px] sm:tracking-[0.2em] ${
            value === mode.id
              ? "bg-white text-black shadow-lg"
              : "text-white/60 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/20 disabled:hover:bg-transparent"
          }`}
        >
          <mode.icon className="h-4 w-4" />
          <span className={hideLabelsOnMobile ? "hidden md:inline" : undefined}>{mode.label}</span>
        </button>
      ))}
    </div>
  );
}
