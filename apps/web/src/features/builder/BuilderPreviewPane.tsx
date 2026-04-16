import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import type { Opening, Vector2 } from "../../lib/stores/useSceneStore";
import { SceneViewport } from "../../components/editor/SceneViewport";
import type { EditorViewMode } from "../../lib/stores/useEditorStore";
import type { BuilderStepId } from "./types";

type BuilderPreviewPaneProps = {
  stepId: BuilderStepId;
  previewMode: Extract<EditorViewMode, "top" | "builder-preview">;
  width: number;
  depth: number;
  unit: "ft" | "cm";
  outline: Vector2[];
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

function buildScaledOutline(outline: Vector2[]) {
  const fallback: Vector2[] = [
    [0, 0],
    [6.2, 0],
    [6.2, 4.4],
    [0, 4.4]
  ];
  const source = outline.length >= 3 ? outline : fallback;
  const minX = Math.min(...source.map(([x]) => x));
  const maxX = Math.max(...source.map(([x]) => x));
  const minY = Math.min(...source.map(([, y]) => y));
  const maxY = Math.max(...source.map(([, y]) => y));
  const shapeWidth = Math.max(maxX - minX, 0.01);
  const shapeHeight = Math.max(maxY - minY, 0.01);
  const viewportWidth = 420;
  const viewportHeight = 260;
  const scale = Math.min(viewportWidth / shapeWidth, viewportHeight / shapeHeight);
  const scaledWidth = shapeWidth * scale;
  const scaledHeight = shapeHeight * scale;
  const offsetX = (820 - scaledWidth) / 2;
  const offsetY = (560 - scaledHeight) / 2;

  const points = source.map(([x, y]) => {
    const scaledX = offsetX + (x - minX) * scale;
    const scaledY = offsetY + (maxY - y) * scale;
    return [scaledX, scaledY] as const;
  });

  const path = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")
    .concat(" Z");

  return {
    path,
    points,
    bounds: {
      minX: offsetX,
      maxX: offsetX + scaledWidth,
      minY: offsetY,
      maxY: offsetY + scaledHeight
    }
  };
}

function DimensionOverlay({
  outline,
  width,
  depth,
  unit
}: {
  outline: Vector2[];
  width: number;
  depth: number;
  unit: "ft" | "cm";
}) {
  const scaled = buildScaledOutline(outline);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-10 py-12">
      <svg viewBox="0 0 820 560" className="h-full max-h-[560px] w-full max-w-[900px]" aria-hidden>
        <path d={scaled.path} fill="rgba(255,255,255,0.18)" stroke="#202020" strokeWidth="6" strokeLinejoin="round" />

        <line x1={scaled.bounds.minX} y1={scaled.bounds.minY - 26} x2={scaled.bounds.maxX} y2={scaled.bounds.minY - 26} stroke="#8f8f8f" strokeWidth="2" />
        <line x1={scaled.bounds.minX} y1={scaled.bounds.maxY + 26} x2={scaled.bounds.maxX} y2={scaled.bounds.maxY + 26} stroke="#8f8f8f" strokeWidth="2" />
        <line x1={scaled.bounds.minX - 26} y1={scaled.bounds.minY} x2={scaled.bounds.minX - 26} y2={scaled.bounds.maxY} stroke="#8f8f8f" strokeWidth="2" />
        <line x1={scaled.bounds.maxX + 26} y1={scaled.bounds.minY} x2={scaled.bounds.maxX + 26} y2={scaled.bounds.maxY} stroke="#8f8f8f" strokeWidth="2" />

        <line x1={scaled.bounds.minX} y1={scaled.bounds.minY - 34} x2={scaled.bounds.minX} y2={scaled.bounds.minY - 14} stroke="#8f8f8f" strokeWidth="2" />
        <line x1={scaled.bounds.maxX} y1={scaled.bounds.minY - 34} x2={scaled.bounds.maxX} y2={scaled.bounds.minY - 14} stroke="#8f8f8f" strokeWidth="2" />
        <line x1={scaled.bounds.minX} y1={scaled.bounds.maxY + 14} x2={scaled.bounds.minX} y2={scaled.bounds.maxY + 38} stroke="#8f8f8f" strokeWidth="2" />
        <line x1={scaled.bounds.maxX} y1={scaled.bounds.maxY + 14} x2={scaled.bounds.maxX} y2={scaled.bounds.maxY + 38} stroke="#8f8f8f" strokeWidth="2" />
        <line x1={scaled.bounds.minX - 34} y1={scaled.bounds.minY} x2={scaled.bounds.minX - 14} y2={scaled.bounds.minY} stroke="#8f8f8f" strokeWidth="2" />
        <line x1={scaled.bounds.minX - 34} y1={scaled.bounds.maxY} x2={scaled.bounds.minX - 14} y2={scaled.bounds.maxY} stroke="#8f8f8f" strokeWidth="2" />
        <line x1={scaled.bounds.maxX + 14} y1={scaled.bounds.minY} x2={scaled.bounds.maxX + 34} y2={scaled.bounds.minY} stroke="#8f8f8f" strokeWidth="2" />
        <line x1={scaled.bounds.maxX + 14} y1={scaled.bounds.maxY} x2={scaled.bounds.maxX + 34} y2={scaled.bounds.maxY} stroke="#8f8f8f" strokeWidth="2" />

        {scaled.points.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="10" fill="#ffffff" />
            <circle cx={x} cy={y} r="7" fill="#ffffff" stroke="#202020" strokeWidth="3" />
          </g>
        ))}

        <text x="410" y={scaled.bounds.minY - 44} textAnchor="middle" fill="#6f6f6f" fontSize="24" fontWeight="600">
          {formatDimension(width, unit)}
        </text>
        <text x="410" y={scaled.bounds.maxY + 58} textAnchor="middle" fill="#6f6f6f" fontSize="24" fontWeight="600">
          {formatDimension(width, unit)}
        </text>
        <text
          x={scaled.bounds.minX - 62}
          y="280"
          textAnchor="middle"
          fill="#6f6f6f"
          fontSize="24"
          fontWeight="600"
          transform={`rotate(-90 ${scaled.bounds.minX - 62} 280)`}
        >
          {formatDimension(depth, unit)}
        </text>
        <text
          x={scaled.bounds.maxX + 62}
          y="280"
          textAnchor="middle"
          fill="#6f6f6f"
          fontSize="24"
          fontWeight="600"
          transform={`rotate(90 ${scaled.bounds.maxX + 62} 280)`}
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
  outline,
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
      className="relative min-h-[360px] overflow-hidden bg-[#d7d7d3] xl:min-h-0 xl:h-full"
    >
      <SceneViewport
        className="h-full min-h-[360px] !rounded-none !border-0 !shadow-none xl:min-h-0 xl:h-full"
        camera={previewMode === "top" ? { fov: 42, position: [0, 10.5, 0.01] } : { fov: 46, position: [8, 5, 8] }}
        toneMappingExposure={1.02}
        chromeTone="light"
        showHud={false}
        interactionMode="preview"
      />

      {stepId === "dimension" ? <DimensionOverlay outline={outline} width={width} depth={depth} unit={unit} /> : null}
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
