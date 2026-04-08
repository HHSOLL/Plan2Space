"use client";

import { SlidersHorizontal, Trash2 } from "lucide-react";
import type { LibraryCatalogItem } from "../../lib/builder/catalog";
import { builderFloorFinishes, builderWallFinishes } from "../../lib/builder/templates";
import type { TransformMode } from "../../lib/stores/useEditorStore";
import type { SceneAsset } from "../../lib/stores/useSceneStore";

type BuilderInspectorPanelProps = {
  visible: boolean;
  transformMode: TransformMode;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  wallsCount: number;
  floorsCount: number;
  assetsCount: number;
  selectedAsset: SceneAsset | null;
  selectedAssetMeta: LibraryCatalogItem | null;
  onTransformModeChange: (mode: TransformMode) => void;
  onWallMaterialChange: (index: number) => void;
  onFloorMaterialChange: (index: number) => void;
  onUpdateAsset: (id: string, updates: Partial<SceneAsset>) => void;
  onRemoveAsset: (id: string) => void;
  formatAssetLabel: (assetId: string) => string;
};

export function BuilderInspectorPanel({
  visible,
  transformMode,
  wallMaterialIndex,
  floorMaterialIndex,
  wallsCount,
  floorsCount,
  assetsCount,
  selectedAsset,
  selectedAssetMeta,
  onTransformModeChange,
  onWallMaterialChange,
  onFloorMaterialChange,
  onUpdateAsset,
  onRemoveAsset,
  formatAssetLabel
}: BuilderInspectorPanelProps) {
  return (
    <aside
      className={`absolute inset-y-3 right-3 z-[30] flex w-[min(86vw,320px)] flex-col rounded-[28px] border border-white/10 bg-black/50 backdrop-blur-2xl transition-all duration-300 xl:inset-y-5 xl:right-5 ${
        visible ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[108%] opacity-0"
      }`}
    >
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
          <SlidersHorizontal className="h-4 w-4" />
          Inspector
        </div>
        <p className="mt-3 text-sm text-white/55">
          Tune finishes, selected asset placement, and transform mode.
        </p>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Transform mode</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "translate", label: "Move" },
              { id: "rotate", label: "Rotate" }
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => onTransformModeChange(mode.id as TransformMode)}
                className={`rounded-2xl px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
                  transformMode === mode.id
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/[0.04] text-white/70 hover:border-white/30"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Wall finish</p>
          <div className="flex flex-wrap gap-2">
            {builderWallFinishes.map((finish) => (
              <button
                key={finish.id}
                type="button"
                onClick={() => onWallMaterialChange(finish.id)}
                className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                  wallMaterialIndex === finish.id
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/[0.04] text-white/65 hover:border-white/30"
                }`}
              >
                {finish.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Floor finish</p>
          <div className="flex flex-wrap gap-2">
            {builderFloorFinishes.map((finish) => (
              <button
                key={finish.id}
                type="button"
                onClick={() => onFloorMaterialChange(finish.id)}
                className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                  floorMaterialIndex === finish.id
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/[0.04] text-white/65 hover:border-white/30"
                }`}
              >
                {finish.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Room summary</p>
          <div className="space-y-2 text-sm text-white/70">
            <div className="flex items-center justify-between">
              <span>Walls</span>
              <span>{wallsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Floor zones</span>
              <span>{floorsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Assets</span>
              <span>{assetsCount}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Selection</p>
          {selectedAsset ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-white">
                  {selectedAssetMeta?.label ?? formatAssetLabel(selectedAsset.assetId)}
                </div>
                {selectedAssetMeta ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
                      {selectedAssetMeta.category}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
                      {selectedAssetMeta.collection}
                    </span>
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-white/45">{selectedAsset.id}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  X
                  <input
                    type="number"
                    step="0.25"
                    value={selectedAsset.position[0]}
                    onChange={(event) =>
                      onUpdateAsset(selectedAsset.id, {
                        position: [
                          Number(event.target.value),
                          selectedAsset.position[1],
                          selectedAsset.position[2]
                        ]
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  Z
                  <input
                    type="number"
                    step="0.25"
                    value={selectedAsset.position[2]}
                    onChange={(event) =>
                      onUpdateAsset(selectedAsset.id, {
                        position: [
                          selectedAsset.position[0],
                          selectedAsset.position[1],
                          Number(event.target.value)
                        ]
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  Rotate Y
                  <input
                    type="number"
                    step="0.1"
                    value={selectedAsset.rotation[1]}
                    onChange={(event) =>
                      onUpdateAsset(selectedAsset.id, {
                        rotation: [
                          selectedAsset.rotation[0],
                          Number(event.target.value),
                          selectedAsset.rotation[2]
                        ]
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  Scale
                  <input
                    type="number"
                    step="0.1"
                    value={selectedAsset.scale[0]}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      onUpdateAsset(selectedAsset.id, {
                        scale: [nextValue, nextValue, nextValue]
                      });
                    }}
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => onRemoveAsset(selectedAsset.id)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-red-100 transition hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
                Remove asset
              </button>
            </div>
          ) : (
            <div className="text-sm leading-6 text-white/50">
              Select a placed asset in top view to edit its position, rotation, and scale.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
