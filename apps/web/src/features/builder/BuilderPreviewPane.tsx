import { motion } from "framer-motion";
import { CheckCircle2, DoorOpen, Paintbrush, Ruler } from "lucide-react";
import { SceneViewport } from "../../components/editor/SceneViewport";
import type { EditorViewMode } from "../../lib/stores/useEditorStore";

type BuilderPreviewPaneProps = {
  previewMode: Extract<EditorViewMode, "top" | "builder-preview">;
  activeTemplateName: string;
  width: number;
  depth: number;
  openingCount: number;
  stepIndex: number;
  wallFinishName: string;
  floorFinishName: string;
  doorCount: number;
  windowCount: number;
  onPreviewModeChange: (mode: Extract<EditorViewMode, "top" | "builder-preview">) => void;
  onZoomControl: (direction: "in" | "out") => void;
};

export function BuilderPreviewPane({
  previewMode,
  activeTemplateName,
  width,
  depth,
  openingCount,
  stepIndex,
  wallFinishName,
  floorFinishName,
  doorCount,
  windowCount,
  onPreviewModeChange,
  onZoomControl
}: BuilderPreviewPaneProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="p2s-workspace-viewport p-4 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">미리보기</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPreviewModeChange("builder-preview")}
            className={`rounded-full border px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${
              previewMode === "builder-preview"
                ? "border-black bg-black text-white"
                : "border-black/10 bg-[#f5efe5] text-[#5f5448]"
            }`}
          >
            3D
          </button>
          <button
            type="button"
            onClick={() => onPreviewModeChange("top")}
            className={`rounded-full border px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${
              previewMode === "top"
                ? "border-black bg-black text-white"
                : "border-black/10 bg-[#f5efe5] text-[#5f5448]"
            }`}
          >
            탑뷰
          </button>
          <div className="rounded-full border border-black/10 bg-[#f5efe5] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#5f5448]">
            {activeTemplateName}
          </div>
        </div>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-[24px] border border-black/10 bg-[#d7d7d3]">
        <SceneViewport
          className="h-[58vh] rounded-none border-0 shadow-none"
          camera={{ fov: 46, position: [8, 5, 8] }}
          toneMappingExposure={1.02}
          chromeTone="light"
          showHud={false}
          modeBadge={previewMode === "top" ? "탑뷰 미리보기" : "3D 미리보기"}
          interactionMode="preview"
        />
        <div className="pointer-events-none absolute inset-y-0 right-4 z-[24] hidden items-center md:flex">
          <div className="flex flex-col overflow-hidden rounded-full border border-black/10 bg-white/92 shadow-[0_10px_26px_rgba(19,21,24,0.14)]">
            <button
              type="button"
              onClick={() => onZoomControl("in")}
              className="pointer-events-auto px-4 py-3 text-center text-sm font-bold text-[#393229] transition hover:bg-[#f2eee7]"
              aria-label="미리보기 확대"
            >
              +
            </button>
            <div className="h-px w-full bg-black/10" />
            <button
              type="button"
              onClick={() => onZoomControl("out")}
              className="pointer-events-auto px-4 py-3 text-center text-sm font-bold text-[#393229] transition hover:bg-[#f2eee7]"
              aria-label="미리보기 축소"
            >
              -
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[20px] border border-black/10 bg-[#fbf8f2] p-4">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[#887a6d]">면적 정보</div>
          <div className="mt-2 text-2xl">{width.toFixed(1)}m × {depth.toFixed(1)}m</div>
        </div>
        <div className="rounded-[20px] border border-black/10 bg-[#fbf8f2] p-4">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[#887a6d]">개구부</div>
          <div className="mt-2 text-2xl">{openingCount}</div>
        </div>
        <div className="rounded-[20px] border border-black/10 bg-[#fbf8f2] p-4">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[#887a6d]">진행 상태</div>
          <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#2f251d]">
            <CheckCircle2 className="h-4 w-4" />
            {stepIndex + 1}단계 진행 중
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[24px] bg-[#1e1915] p-5 text-[#f2e8dc]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d4b99f]">요약</div>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="inline-flex items-center gap-2 text-[#ccbaaa]"><Ruler className="h-4 w-4" /> 치수</span>
            <span>{width.toFixed(1)}m × {depth.toFixed(1)}m</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="inline-flex items-center gap-2 text-[#ccbaaa]"><DoorOpen className="h-4 w-4" /> 개구부</span>
            <span>{doorCount}개 문 / {windowCount}개 창문</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[#ccbaaa]"><Paintbrush className="h-4 w-4" /> 스타일</span>
            <span>{wallFinishName} / {floorFinishName}</span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
