import { Plus, Trash2 } from "lucide-react";
import type { Opening, Wall } from "../../../lib/stores/useSceneStore";
import type { BuilderWallEntry, DoorStyle, WindowStyle } from "../types";

type BuilderOpeningsStepProps = {
  doorStyle: DoorStyle;
  windowStyle: WindowStyle;
  addSecondaryWindow: boolean;
  doorStyleLabels: Record<DoorStyle, string>;
  windowStyleLabels: Record<WindowStyle, string>;
  wallEntries: BuilderWallEntry[];
  selectedWallId: string | null;
  selectedWallOpenings: Opening[];
  selectedOpeningId: string | null;
  selectedOpening: Opening | null;
  selectedOpeningWall: Wall | null;
  onDoorStyleChange: (style: DoorStyle) => void;
  onWindowStyleChange: (style: WindowStyle) => void;
  onAddSecondaryWindowChange: (value: boolean) => void;
  onSelectWall: (wallId: string) => void;
  onSelectOpening: (openingId: string) => void;
  onAddOpening: (type: "door" | "window") => void;
  onDeleteOpening: (openingId: string) => void;
  onPatchOpening: (openingId: string, patch: Partial<Opening>) => void;
  onSetEntrance: (openingId: string) => void;
  getWallLength: (wall: Wall) => number;
};

export function BuilderOpeningsStep({
  doorStyle,
  windowStyle,
  addSecondaryWindow,
  doorStyleLabels,
  windowStyleLabels,
  wallEntries,
  selectedWallId,
  selectedWallOpenings,
  selectedOpeningId,
  selectedOpening,
  selectedOpeningWall,
  onDoorStyleChange,
  onWindowStyleChange,
  onAddSecondaryWindowChange,
  onSelectWall,
  onSelectOpening,
  onAddOpening,
  onDeleteOpening,
  onPatchOpening,
  onSetEntrance,
  getWallLength
}: BuilderOpeningsStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">도어 스타일</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(doorStyleLabels) as DoorStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onDoorStyleChange(style)}
              className={`rounded-full border px-4 py-2 text-[11px] font-semibold transition ${
                doorStyle === style
                  ? "border-black bg-black text-white"
                  : "border-black/10 bg-[#fcfaf6] text-[#51483f] hover:border-black/30"
              }`}
            >
              {doorStyleLabels[style]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">창문 스타일</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(windowStyleLabels) as WindowStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onWindowStyleChange(style)}
              className={`rounded-full border px-4 py-2 text-[11px] font-semibold transition ${
                windowStyle === style
                  ? "border-black bg-black text-white"
                  : "border-black/10 bg-[#fcfaf6] text-[#51483f] hover:border-black/30"
              }`}
            >
              {windowStyleLabels[style]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-[18px] border border-black/10 bg-[#fbf8f3] px-4 py-3 text-sm text-[#53483d]">
        <input
          type="checkbox"
          checked={addSecondaryWindow}
          onChange={(event) => onAddSecondaryWindowChange(event.target.checked)}
          className="h-4 w-4 rounded border-black/20"
        />
        템플릿 기본값에 보조 창문 포함
      </label>
      <p className="-mt-2 text-xs text-[#75695d]">기존 개구부 배치는 유지됩니다.</p>

      <div className="rounded-[20px] border border-black/10 bg-[#faf7f1] p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">벽 선택</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAddOpening("door")}
              className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2f251d]"
            >
              <Plus className="h-3.5 w-3.5" />
              문
            </button>
            <button
              type="button"
              onClick={() => onAddOpening("window")}
              className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2f251d]"
            >
              <Plus className="h-3.5 w-3.5" />
              창문
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {wallEntries.map((wall) => (
            <button
              key={wall.id}
              type="button"
              onClick={() => onSelectWall(wall.id)}
              className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                selectedWallId === wall.id
                  ? "border-black bg-black text-white"
                  : "border-black/10 bg-white text-[#574c41] hover:border-black/25"
              }`}
            >
              {wall.label} · {wall.length.toFixed(2)}m
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {selectedWallOpenings.length > 0 ? (
            selectedWallOpenings.map((opening) => (
              <button
                key={opening.id}
                type="button"
                onClick={() => onSelectOpening(opening.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selectedOpeningId === opening.id
                    ? "border-black/25 bg-white"
                    : "border-black/10 bg-[#fcfaf6] hover:border-black/20"
                }`}
              >
                <span className="font-medium text-[#30261d]">
                  {opening.type === "door" ? "문" : "창문"} · {opening.id.replace("opening-", "")}
                </span>
                <span className="text-[#6e6256]">{opening.width.toFixed(2)}m</span>
              </button>
            ))
          ) : (
            <p className="text-sm text-[#6e6256]">이 벽에는 아직 개구부가 없습니다.</p>
          )}
        </div>
      </div>

      {selectedOpening ? (
        <div className="rounded-[20px] border border-black/10 bg-[#faf7f1] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">선택된 개구부</div>
            <button
              type="button"
              onClick={() => onDeleteOpening(selectedOpening.id)}
              className="inline-flex items-center gap-1 rounded-full border border-red-900/20 bg-red-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-800"
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="space-y-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b7f72]">
              배치 벽
              <select
                value={selectedOpening.wallId}
                onChange={(event) => {
                  const wallId = event.target.value;
                  onSelectWall(wallId);
                  onPatchOpening(selectedOpening.id, { wallId });
                }}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm font-medium text-[#30261d]"
              >
                {wallEntries.map((wall) => (
                  <option key={wall.id} value={wall.id}>
                    {wall.label} ({wall.length.toFixed(2)}m)
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b7f72]">
              Width · {selectedOpening.width.toFixed(2)}m
              <input
                type="range"
                min={selectedOpening.type === "door" ? 0.72 : 0.92}
                max={Math.max(
                  selectedOpening.type === "door" ? 0.72 : 0.92,
                  (selectedOpeningWall ? getWallLength(selectedOpeningWall) : 1) - 0.64
                )}
                step={0.01}
                value={selectedOpening.width}
                onChange={(event) => onPatchOpening(selectedOpening.id, { width: Number(event.target.value) })}
                className="w-full"
              />
            </label>

            <label className="space-y-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b7f72]">
              Offset · {selectedOpening.offset.toFixed(2)}m
              <input
                type="range"
                min={0.3}
                max={Math.max(
                  0.3,
                  (selectedOpeningWall ? getWallLength(selectedOpeningWall) : 1) - selectedOpening.width - 0.3
                )}
                step={0.01}
                value={selectedOpening.offset}
                onChange={(event) => onPatchOpening(selectedOpening.id, { offset: Number(event.target.value) })}
                className="w-full"
              />
            </label>

            <label className="space-y-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b7f72]">
              Height · {selectedOpening.height.toFixed(2)}m
              <input
                type="range"
                min={selectedOpening.type === "door" ? 1.9 : 0.82}
                max={selectedOpening.type === "door" ? 2.4 : 2.1}
                step={0.01}
                value={selectedOpening.height}
                onChange={(event) => onPatchOpening(selectedOpening.id, { height: Number(event.target.value) })}
                className="w-full"
              />
            </label>

            {selectedOpening.type === "window" ? (
              <label className="space-y-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b7f72]">
                Sill height · {(selectedOpening.sillHeight ?? 0.9).toFixed(2)}m
                <input
                  type="range"
                  min={0.25}
                  max={1.45}
                  step={0.01}
                  value={selectedOpening.sillHeight ?? 0.9}
                  onChange={(event) => onPatchOpening(selectedOpening.id, { sillHeight: Number(event.target.value) })}
                  className="w-full"
                />
              </label>
            ) : (
              <div className="space-y-3">
                <label className="space-y-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b7f72]">
                  도어 상승 높이 · {(selectedOpening.verticalOffset ?? 0).toFixed(2)}m
                  <input
                    type="range"
                    min={0}
                    max={0.42}
                    step={0.01}
                    value={selectedOpening.verticalOffset ?? 0}
                    onChange={(event) => onPatchOpening(selectedOpening.id, { verticalOffset: Number(event.target.value) })}
                    className="w-full"
                  />
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-[#3f3429]">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedOpening.isEntrance)}
                    onChange={() => onSetEntrance(selectedOpening.id)}
                    className="h-4 w-4 rounded border-black/20"
                  />
                  입구 문으로 지정
                </label>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
