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
  if (diffSeconds < 10) return "방금 저장됨";
  if (diffSeconds < 60) return `${diffSeconds}초 전에 저장됨`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}분 전에 저장됨`;
  const diffHours = Math.round(diffMinutes / 60);
  return `${diffHours}시간 전에 저장됨`;
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
        label: "저장 실패",
        className: "border-red-200 bg-red-50 text-red-700"
      };
    }
    if (isSaving) {
      return {
        icon: Loader2,
        label: "저장 중...",
        className: "border-[#dfd5c8] bg-[#f7f2ea] text-[#6a5a47]",
        iconClassName: "animate-spin"
      };
    }
    if (isDirty) {
      return {
        icon: AlertTriangle,
        label: "저장되지 않은 변경",
        className: "border-amber-200 bg-amber-50 text-amber-700"
      };
    }
    if (lastSavedAt) {
      return {
        icon: CheckCircle2,
        label: formatSavedLabel(lastSavedAt),
        className: "border-emerald-200 bg-emerald-50 text-emerald-700"
      };
    }
      return {
        icon: CheckCircle2,
        label: "준비됨",
        className: "border-[#dfd5c8] bg-[#f7f2ea] text-[#6a5a47]"
      };
  }, [isDirty, isSaving, lastSavedAt, saveError]);

  const Icon = status.icon;

  return (
    <div
      className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] md:flex ${status.className}`}
    >
      <Icon className={`h-4 w-4 ${status.iconClassName ?? ""}`.trim()} />
      <span>{status.label}</span>
    </div>
  );
}
