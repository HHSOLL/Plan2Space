"use client";

import { Save } from "lucide-react";

type SaveButtonProps = {
  onClick: () => void;
  isSaving?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
  savingLabel?: string;
};

export function SaveButton({
  onClick,
  isSaving = false,
  disabled = false,
  className,
  label = "저장",
  savingLabel = "저장 중..."
}: SaveButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || isSaving}
      onClick={onClick}
      className={
        className ||
        "flex items-center gap-3 rounded-[24px] bg-white px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-black shadow-2xl transition-all hover:bg-white/90 disabled:opacity-50 active:scale-95"
      }
    >
      <Save className="h-4 w-4" />
      {isSaving ? savingLabel : label}
    </button>
  );
}
