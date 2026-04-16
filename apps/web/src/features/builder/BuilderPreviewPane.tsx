import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import type { Opening } from "../../lib/stores/useSceneStore";
import { SceneViewport } from "../../components/editor/SceneViewport";
import type { EditorViewMode } from "../../lib/stores/useEditorStore";
import type { BuilderStepId } from "./types";

type BuilderPreviewPaneProps = {
  stepId: BuilderStepId;
  previewMode: Extract<EditorViewMode, "top" | "builder-preview">;
  width: number;
  depth: number;
  unit: "ft" | "cm";
  wallFinishName: string;
  floorFinishName: string;
  doorCount: number;
  windowCount: number;
  selectedWallLabel: string | null;
  selectedOpening: Opening | null;
  onDeleteSelectedOpening: (() => void) | null;
};

function formatDimension(value: number, unit: "ft" | "cm") {
  if (unit === "ft") {
    return `${(value * 3.28084).toFixed(1)} ft`;
  }

  return `${Math.round(value * 100)} cm`;
}

function DimensionOverlay({
  width,
  depth,
  unit
}: {
  width: number;
  depth: number;
  unit: "ft" | "cm";
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-10 py-12">
      <svg viewBox="0 0 820 560" className="h-full max-h-[560px] w-full max-w-[900px]" aria-hidden>
        <line x1="190" y1="150" x2="630" y2="150" stroke="#202020" strokeWidth="6" />
        <line x1="190" y1="410" x2="630" y2="410" stroke="#202020" strokeWidth="6" />
        <line x1="190" y1="150" x2="190" y2="410" stroke="#202020" strokeWidth="6" />
        <line x1="630" y1="150" x2="630" y2="410" stroke="#202020" strokeWidth="6" />

        <line x1="190" y1="124" x2="630" y2="124" stroke="#8f8f8f" strokeWidth="2" />
        <line x1="190" y1="436" x2="630" y2="436" stroke="#8f8f8f" strokeWidth="2" />
        <line x1="164" y1="150" x2="164" y2="410" stroke="#8f8f8f" strokeWidth="2" />
        <line x1="656" y1="150" x2="656" y2="410" stroke="#8f8f8f" strokeWidth="2" />

        <line x1="190" y1="116" x2="190" y2="136" stroke="#8f8f8f" strokeWidth="2" />
        <line x1="630" y1="116" x2="630" y2="136" stroke="#8f8f8f" strokeWidth="2" />
        <line x1="190" y1="424" x2="190" y2="448" stroke="#8f8f8f" strokeWidth="2" />
        <line x1="630" y1="424" x2="630" y2="448" stroke="#8f8f8f" strokeWidth="2" />
        <line x1="156" y1="150" x2="172" y2="150" stroke="#8f8f8f" strokeWidth="2" />
        <line x1="156" y1="410" x2="172" y2="410" stroke="#8f8f8f" strokeWidth="2" />
        <line x1="648" y1="150" x2="664" y2="150" stroke="#8f8f8f" strokeWidth="2" />
        <line x1="648" y1="410" x2="664" y2="410" stroke="#8f8f8f" strokeWidth="2" />

        {[
          [190, 150],
          [630, 150],
          [190, 410],
          [630, 410]
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="10" fill="#ffffff" />
            <circle cx={x} cy={y} r="7" fill="#ffffff" stroke="#202020" strokeWidth="3" />
          </g>
        ))}

        <text x="410" y="105" textAnchor="middle" fill="#6f6f6f" fontSize="24" fontWeight="600">
          {formatDimension(width, unit)}
        </text>
        <text x="410" y="468" textAnchor="middle" fill="#6f6f6f" fontSize="24" fontWeight="600">
          {formatDimension(width, unit)}
        </text>
        <text
          x="128"
          y="280"
          textAnchor="middle"
          fill="#6f6f6f"
          fontSize="24"
          fontWeight="600"
          transform="rotate(-90 128 280)"
        >
          {formatDimension(depth, unit)}
        </text>
        <text
          x="692"
          y="280"
          textAnchor="middle"
          fill="#6f6f6f"
          fontSize="24"
          fontWeight="600"
          transform="rotate(90 692 280)"
        >
          {formatDimension(depth, unit)}
        </text>
      </svg>
    </div>
  );
}

function OpeningOverlay({
  selectedWallLabel,
  selectedOpening,
  onDeleteSelectedOpening
}: {
  selectedWallLabel: string | null;
  selectedOpening: Opening | null;
  onDeleteSelectedOpening: (() => void) | null;
}) {
  const openingLabel = selectedOpening ? (selectedOpening.type === "door" ? "문 선택됨" : "창문 선택됨") : null;

  return (
    <>
      {selectedWallLabel || openingLabel ? (
        <div className="pointer-events-none absolute left-6 top-6 flex flex-wrap gap-2">
          {selectedWallLabel ? (
            <span className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[#2c2924] shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
              {selectedWallLabel}
            </span>
          ) : null}
          {openingLabel ? (
            <span className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[#2c2924] shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
              {openingLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {selectedOpening && onDeleteSelectedOpening ? (
        <div className="absolute right-[12%] top-[22%] z-20">
          <button
            type="button"
            onClick={onDeleteSelectedOpening}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#141414] text-white shadow-[0_18px_35px_rgba(0,0,0,0.18)] transition hover:bg-black"
            aria-label="선택한 개구부 삭제"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </>
  );
}

function StyleSummary({
  wallFinishName,
  floorFinishName,
  doorCount,
  windowCount
}: {
  wallFinishName: string;
  floorFinishName: string;
  doorCount: number;
  windowCount: number;
}) {
  return (
    <div className="pointer-events-none absolute bottom-6 left-6 flex flex-wrap gap-2">
      <span className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[#2c2924] shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
        벽 {wallFinishName}
      </span>
      <span className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[#2c2924] shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
        바닥 {floorFinishName}
      </span>
      <span className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[#2c2924] shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
        문 {doorCount}개 / 창문 {windowCount}개
      </span>
    </div>
  );
}

export function BuilderPreviewPane({
  stepId,
  previewMode,
  width,
  depth,
  unit,
  wallFinishName,
  floorFinishName,
  doorCount,
  windowCount,
  selectedWallLabel,
  selectedOpening,
  onDeleteSelectedOpening
}: BuilderPreviewPaneProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative min-h-[520px] overflow-hidden bg-[#d7d7d3] xl:min-h-full"
    >
      <SceneViewport
        className="h-full min-h-[520px] !rounded-none !border-0 !shadow-none xl:min-h-[820px]"
        camera={previewMode === "top" ? { fov: 42, position: [0, 10.5, 0.01] } : { fov: 46, position: [8, 5, 8] }}
        toneMappingExposure={1.02}
        chromeTone="light"
        showHud={false}
        interactionMode="preview"
      />

      {stepId === "dimension" ? <DimensionOverlay width={width} depth={depth} unit={unit} /> : null}
      {stepId === "opening" ? (
        <OpeningOverlay
          selectedWallLabel={selectedWallLabel}
          selectedOpening={selectedOpening}
          onDeleteSelectedOpening={onDeleteSelectedOpening}
        />
      ) : null}
      {stepId === "style" ? (
        <StyleSummary
          wallFinishName={wallFinishName}
          floorFinishName={floorFinishName}
          doorCount={doorCount}
          windowCount={windowCount}
        />
      ) : null}
    </motion.section>
  );
}
