"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Share2 } from "lucide-react";
import { EditorStatusBadge } from "./EditorStatusBadge";
import { SaveButton } from "./SaveButton";
import type { EditorViewMode } from "../../lib/stores/useEditorStore";

type ProjectEditorHeaderProps = {
  title: string;
  viewMode: EditorViewMode;
  onBack: () => void;
  onOpenShare: () => void;
  onSave: () => void;
  isSaving: boolean;
  isDirty: boolean;
  saveError: string | null;
  lastSavedAt: number | null;
};

export function ProjectEditorHeader({
  title,
  viewMode,
  onBack,
  onOpenShare,
  onSave,
  isSaving,
  isDirty,
  saveError,
  lastSavedAt
}: ProjectEditorHeaderProps) {
  const modeLabel = viewMode === "walk" ? "Walk" : "Top";
  const modeDescription =
    viewMode === "walk"
      ? "Walkthrough review mode active."
      : "Top-view editing mode active.";

  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex items-start justify-between gap-3 sm:inset-x-8 sm:top-6 sm:items-center">
      <div className="pointer-events-auto flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="group rounded-[18px] border border-black/10 bg-white/95 p-3 shadow-[0_14px_30px_rgba(29,24,18,0.12)] transition hover:border-black/20 hover:bg-[#f7f1e7] active:scale-95"
          aria-label="Back to projects"
        >
          <ChevronLeft className="h-5 w-5 text-[#625a51] transition-colors group-hover:text-[#171411]" />
        </button>

        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex min-w-0 flex-col rounded-[20px] border border-black/10 bg-white/95 px-4 py-3 shadow-[0_14px_30px_rgba(29,24,18,0.12)] sm:min-w-[300px] sm:px-5"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[9px] font-bold uppercase tracking-[0.2em] text-[#8a8177] sm:text-[10px]">
              Room planner
            </span>
            <span className="rounded-full border border-black/10 bg-[#f6f1e9] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#6b6258]">
              {modeLabel}
            </span>
          </div>
          <h1 className="mt-2 max-w-[44vw] truncate font-outfit text-sm font-semibold leading-none tracking-normal text-[#171411] sm:max-w-none sm:text-base">
            {title}
          </h1>
          <p className="mt-2 text-[11px] leading-5 text-[#7a7167]">{modeDescription}</p>
        </motion.div>
      </div>

      <div className="pointer-events-auto flex items-start gap-2 sm:items-center sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <EditorStatusBadge
            isDirty={isDirty}
            isSaving={isSaving}
            saveError={saveError}
            lastSavedAt={lastSavedAt}
          />

          <button
            type="button"
            onClick={onOpenShare}
            className="hidden items-center gap-2 rounded-[18px] border border-black/10 bg-white/95 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51] shadow-[0_14px_30px_rgba(29,24,18,0.12)] transition hover:border-black/20 hover:bg-[#f7f1e7] hover:text-[#171411] sm:flex"
          >
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </button>
          <div className="hidden sm:block">
            <SaveButton
              onClick={onSave}
              isSaving={isSaving}
              disabled={!isDirty && !saveError}
              className="flex items-center gap-2 rounded-[18px] bg-[#171411] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_14px_30px_rgba(29,24,18,0.16)] transition hover:bg-black disabled:opacity-45 active:scale-95"
              label="Save"
              savingLabel="Saving"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
