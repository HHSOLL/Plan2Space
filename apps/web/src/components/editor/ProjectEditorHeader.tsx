"use client";

import { motion } from "framer-motion";
import { ChevronLeft, PanelLeftOpen, Save, Share2, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { EditorStatusBadge } from "./EditorStatusBadge";
import type { EditorViewMode } from "../../lib/stores/useEditorStore";
import { useAuthStore } from "../../lib/stores/useAuthStore";
import { AuthPopup } from "../overlay/AuthPopup";

type ProjectEditorHeaderProps = {
  title: string;
  viewMode: EditorViewMode;
  canShowPanels: boolean;
  activePanel: "assets" | "properties";
  onBack: () => void;
  onShowAssets: () => void;
  onShowInspector: () => void;
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
  canShowPanels,
  activePanel,
  onBack,
  onShowAssets,
  onShowInspector,
  onOpenShare,
  onSave,
  isSaving,
  isDirty,
  saveError,
  lastSavedAt
}: ProjectEditorHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, session, logout } = useAuthStore();
  const isAuthenticated = Boolean(session?.user);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const modeLabel = viewMode === "walk" ? "워크뷰" : "상단뷰";

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] border-b border-black/10 bg-white/95 backdrop-blur-xl">
        <div className="pointer-events-auto flex h-16 items-center gap-2 px-3 sm:px-5 xl:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] font-semibold tracking-[-0.03em] text-[#171411] transition hover:border-black/20 hover:bg-[#f4f4f1]"
            >
              Plan2Space
            </button>
            <button
              type="button"
              onClick={onBack}
              className="group flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white transition hover:border-black/20 hover:bg-[#f4f4f1] active:scale-95"
              aria-label="프로젝트 목록으로 이동"
            >
              <ChevronLeft className="h-4 w-4 text-[#625a51] transition-colors group-hover:text-[#171411]" />
            </button>

            {canShowPanels ? (
              <div className="hidden items-center rounded-full border border-black/10 bg-[#f3f3f0] p-1 xl:flex">
                <button
                  type="button"
                  onClick={onShowAssets}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                    activePanel === "assets"
                      ? "bg-white text-[#171411] shadow-[0_6px_18px_rgba(17,19,22,0.08)]"
                      : "text-[#6d6459] hover:bg-white"
                  }`}
                >
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                  추가
                </button>
                <button
                  type="button"
                  onClick={onShowInspector}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                    activePanel === "properties"
                      ? "bg-white text-[#171411] shadow-[0_6px_18px_rgba(17,19,22,0.08)]"
                      : "text-[#6d6459] hover:bg-white"
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  속성
                </button>
              </div>
            ) : null}
          </div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <div className="min-w-0">
              <div className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a8177]">
                제목 없는 디자인
              </div>
              <h1 className="truncate text-sm font-semibold leading-none text-[#171411] sm:text-[15px]">
                {title}
              </h1>
            </div>
            <span className="hidden h-4 w-px bg-black/10 lg:block" />
            <span className="hidden rounded-full border border-black/10 bg-[#f7f7f4] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#625a51] lg:inline-flex">
              {modeLabel}
            </span>
          </motion.div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <span className="hidden max-w-[180px] truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[#999999] xl:block">
                  {user?.name ?? user?.email ?? "내 프로젝트"}
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex h-10 items-center rounded-full border border-black/10 px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51] transition hover:border-black/20 hover:bg-[#f4f4f1]"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="inline-flex h-10 items-center rounded-full bg-[#171411] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-black"
              >
                로그인
              </button>
            )}

            <EditorStatusBadge
              isDirty={isDirty}
              isSaving={isSaving}
              saveError={saveError}
              lastSavedAt={lastSavedAt}
            />

            <button
              type="button"
              onClick={onOpenShare}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-[#625a51] transition hover:border-black/20 hover:bg-[#f4f4f1] hover:text-[#171411]"
              aria-label="공유"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || (!isDirty && !saveError)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#171411] bg-[#171411] px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Save className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isSaving ? "저장 중" : "저장"}</span>
            </button>
          </div>
        </div>
      </div>

      <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} nextPath={pathname ?? "/studio"} />
    </>
  );
}
