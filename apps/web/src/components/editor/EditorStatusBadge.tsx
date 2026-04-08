"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type EditorStatusBadgeProps = {
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  lastSavedAt: number | null;
};

function formatSavedLabel(lastSavedAt: number) {
  const diffSeconds = Math.max(0, Math.round((Date.now() - lastSavedAt) / 1000));
  if (diffSeconds < 10) return "Saved just now";
  if (diffSeconds < 60) return `Saved ${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `Saved ${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  return `Saved ${diffHours}h ago`;
}

export function EditorStatusBadge({
  isDirty,
  isSaving,
  saveError,
  lastSavedAt
}: EditorStatusBadgeProps) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!lastSavedAt || isSaving || isDirty || saveError) return;
    const timer = window.setInterval(() => {
      forceTick((value) => value + 1);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [isDirty, isSaving, lastSavedAt, saveError]);

  const status = useMemo(() => {
    if (saveError) {
      return {
        icon: AlertTriangle,
        label: "Save failed",
        className: "border-red-300/25 bg-red-500/10 text-red-50"
      };
    }
    if (isSaving) {
      return {
        icon: Loader2,
        label: "Saving...",
        className: "border-white/10 bg-white/10 text-white/80",
        iconClassName: "animate-spin"
      };
    }
    if (isDirty) {
      return {
        icon: AlertTriangle,
        label: "Unsaved changes",
        className: "border-amber-300/25 bg-amber-200/10 text-amber-50"
      };
    }
    if (lastSavedAt) {
      return {
        icon: CheckCircle2,
        label: formatSavedLabel(lastSavedAt),
        className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-50"
      };
    }
    return {
      icon: CheckCircle2,
      label: "Ready",
      className: "border-white/10 bg-white/10 text-white/70"
    };
  }, [isDirty, isSaving, lastSavedAt, saveError]);

  const Icon = status.icon;

  return (
    <div
      className={`hidden items-center gap-2 rounded-full border px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] backdrop-blur-xl lg:flex ${status.className}`}
    >
      <Icon className={`h-4 w-4 ${status.iconClassName ?? ""}`.trim()} />
      <span>{status.label}</span>
    </div>
  );
}
