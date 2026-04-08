"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Redo2, Share2, type LucideIcon, Undo2 } from "lucide-react";
import { EditorStatusBadge } from "./EditorStatusBadge";
import { SaveButton } from "./SaveButton";
import { StudioModeToggle } from "./StudioModeToggle";
import type {
  EditorPanels,
  EditorViewMode,
  TransformMode
} from "../../lib/stores/useEditorStore";

type HeaderModeOption = {
  id: string;
  icon: LucideIcon;
  label: string;
  enabled?: boolean;
};

type ProjectEditorHeaderProps = {
  title: string;
  viewMode: EditorViewMode;
  modes: HeaderModeOption[];
  panels: EditorPanels;
  transformMode: TransformMode;
  isTopEditorVisible: boolean;
  onBack: () => void;
  onTogglePanel: (panel: keyof EditorPanels) => void;
  onTransformModeChange: (mode: TransformMode) => void;
  onViewModeChange: (mode: EditorViewMode) => void;
  onOpenShare: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  isDirty: boolean;
  saveError: string | null;
  lastSavedAt: number | null;
};

export function ProjectEditorHeader({
  title,
  viewMode,
  modes,
  panels,
  transformMode,
  isTopEditorVisible,
  onBack,
  onTogglePanel,
  onTransformModeChange,
  onViewModeChange,
  onOpenShare,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isSaving,
  isDirty,
  saveError,
  lastSavedAt
}: ProjectEditorHeaderProps) {
  return (
    <div className="fixed inset-x-3 top-3 z-[100] flex items-start justify-between gap-2 pointer-events-none sm:inset-x-8 sm:top-8 sm:items-center">
      <div className="pointer-events-auto flex min-w-0 items-center gap-2 sm:gap-6">
        <button
          onClick={onBack}
          className="group rounded-[16px] border border-white/5 p-2.5 shadow-2xl transition-all active:scale-95 hover:bg-white/10 sm:rounded-[24px] sm:p-4 glass-dark"
        >
          <ChevronLeft className="h-5 w-5 text-white/40 transition-colors group-hover:text-white" />
        </button>

        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex min-w-0 flex-col"
        >
          <span className="mb-1 truncate text-[9px] font-bold uppercase tracking-[0.25em] text-white/30 sm:text-[10px] sm:tracking-[0.4em]">
            Plan2Space Studio
          </span>
          <h1 className="max-w-[44vw] truncate text-sm font-medium leading-none tracking-tight text-white sm:max-w-none sm:text-lg font-outfit">
            {title}
          </h1>
        </motion.div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2 sm:gap-4">
        {isTopEditorVisible ? (
          <div className="hidden items-center gap-2 rounded-[16px] border border-white/5 bg-black/35 p-1 shadow-2xl xl:flex">
            <button
              type="button"
              onClick={() => onTogglePanel("assets")}
              className={`rounded-[12px] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
                panels.assets
                  ? "bg-white text-black"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              Library
            </button>
            <button
              type="button"
              onClick={() => onTransformModeChange("translate")}
              className={`rounded-[12px] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
                transformMode === "translate"
                  ? "bg-white text-black"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              Move
            </button>
            <button
              type="button"
              onClick={() => onTransformModeChange("rotate")}
              className={`rounded-[12px] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
                transformMode === "rotate"
                  ? "bg-white text-black"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              Rotate
            </button>
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="rounded-[12px] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/20 disabled:hover:bg-transparent"
            >
              <span className="inline-flex items-center gap-2">
                <Undo2 className="h-4 w-4" />
                Undo
              </span>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="rounded-[12px] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/20 disabled:hover:bg-transparent"
            >
              <span className="inline-flex items-center gap-2">
                <Redo2 className="h-4 w-4" />
                Redo
              </span>
            </button>
            <button
              type="button"
              onClick={() => onTogglePanel("properties")}
              className={`rounded-[12px] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
                panels.properties
                  ? "bg-white text-black"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              Inspector
            </button>
          </div>
        ) : null}

        <EditorStatusBadge
          isDirty={isDirty}
          isSaving={isSaving}
          saveError={saveError}
          lastSavedAt={lastSavedAt}
        />

        <StudioModeToggle
          value={viewMode}
          modes={modes}
          onChange={(modeId) => onViewModeChange(modeId as EditorViewMode)}
          hideLabelsOnMobile
          className="max-w-[58vw] sm:max-w-none"
        />

        <button
          onClick={onOpenShare}
          className="hidden items-center gap-2 rounded-[12px] px-4 py-2 text-[9px] font-bold uppercase tracking-[0.15em] text-white/60 transition-all hover:bg-white/10 hover:text-white sm:flex sm:rounded-[18px] sm:px-6 sm:py-3 sm:text-[10px] sm:tracking-[0.2em]"
        >
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </button>
        <div className="hidden sm:block">
          <SaveButton onClick={onSave} isSaving={isSaving} disabled={!isDirty && !saveError} />
        </div>
      </div>
    </div>
  );
}
