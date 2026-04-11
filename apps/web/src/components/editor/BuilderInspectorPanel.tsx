"use client";

import { SlidersHorizontal, Trash2 } from "lucide-react";
import type { LibraryCatalogItem } from "../../lib/builder/catalog";
import { SCENE_ANCHOR_TYPES, type SceneAnchorType } from "../../lib/scene/anchor-types";
import { builderFloorFinishes, builderWallFinishes } from "../../lib/builder/templates";
import type { TransformMode } from "../../lib/stores/useEditorStore";
import type { LightingSettings, SceneAsset } from "../../lib/stores/useSceneStore";

type BuilderInspectorPanelProps = {
  visible: boolean;
  transformMode: TransformMode;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  lighting: LightingSettings;
  wallsCount: number;
  floorsCount: number;
  assetsCount: number;
  selectedAsset: SceneAsset | null;
  selectedAssetMeta: LibraryCatalogItem | null;
  onTransformModeChange: (mode: TransformMode) => void;
  onWallMaterialChange: (index: number) => void;
  onFloorMaterialChange: (index: number) => void;
  onLightingChange: (lighting: Partial<LightingSettings>) => void;
  onLightingCommit: () => void;
  onUpdateAsset: (id: string, updates: Partial<SceneAsset>) => void;
  onRemoveAsset: (id: string) => void;
  formatAssetLabel: (assetId: string) => string;
};

export function BuilderInspectorPanel({
  visible,
  transformMode,
  wallMaterialIndex,
  floorMaterialIndex,
  lighting,
  wallsCount,
  floorsCount,
  assetsCount,
  selectedAsset,
  selectedAssetMeta,
  onTransformModeChange,
  onWallMaterialChange,
  onFloorMaterialChange,
  onLightingChange,
  onLightingCommit,
  onUpdateAsset,
  onRemoveAsset,
  formatAssetLabel
}: BuilderInspectorPanelProps) {
  const anchorLabel: Record<SceneAnchorType, string> = {
    floor: "Floor",
    wall: "Wall",
    ceiling: "Ceiling",
    furniture_surface: "Furniture Surface",
    desk_surface: "Desk Surface",
    shelf_surface: "Shelf Surface"
  };
  const isYManagedByAnchor =
    selectedAsset?.anchorType === "floor" ||
    selectedAsset?.anchorType === "ceiling" ||
    selectedAsset?.anchorType === "desk_surface" ||
    selectedAsset?.anchorType === "furniture_surface" ||
    selectedAsset?.anchorType === "shelf_surface";
  const isRotationManagedByAnchor = selectedAsset?.anchorType === "wall";

  return (
    <aside
      className={`absolute inset-y-3 right-3 z-[30] flex w-[min(86vw,340px)] flex-col rounded-[28px] border border-black/10 bg-[#f7f5f1]/95 shadow-[0_18px_44px_rgba(17,19,22,0.18)] backdrop-blur-xl transition-all duration-300 xl:inset-y-5 xl:right-5 ${
        visible ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[108%] opacity-0"
      }`}
    >
      <div className="border-b border-black/10 px-5 py-4">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#6f665b]">
          <SlidersHorizontal className="h-4 w-4" />
          Inspector
        </div>
        <p className="mt-3 text-sm text-[#5f574d]">
          Tune finishes, selected asset placement, and transform mode.
        </p>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">Transform mode</p>
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
                    ? "bg-[#1c1a17] text-white"
                    : "border border-black/10 bg-white text-[#4e473d] hover:border-black/20"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">Wall finish</p>
          <div className="flex flex-wrap gap-2">
            {builderWallFinishes.map((finish) => (
              <button
                key={finish.id}
                type="button"
                onClick={() => onWallMaterialChange(finish.id)}
                className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                  wallMaterialIndex === finish.id
                    ? "bg-[#1c1a17] text-white"
                    : "border border-black/10 bg-white text-[#5f584e] hover:border-black/20"
                }`}
              >
                {finish.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">Floor finish</p>
          <div className="flex flex-wrap gap-2">
            {builderFloorFinishes.map((finish) => (
              <button
                key={finish.id}
                type="button"
                onClick={() => onFloorMaterialChange(finish.id)}
                className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                  floorMaterialIndex === finish.id
                    ? "bg-[#1c1a17] text-white"
                    : "border border-black/10 bg-white text-[#5f584e] hover:border-black/20"
                }`}
              >
                {finish.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-[24px] border border-black/10 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">Lighting</p>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            Ambient
            <input
              type="range"
              min="0.05"
              max="1.2"
              step="0.05"
              value={lighting.ambientIntensity}
              onChange={(event) => onLightingChange({ ambientIntensity: Number(event.target.value) })}
              onMouseUp={onLightingCommit}
              onTouchEnd={onLightingCommit}
              className="w-full accent-[#1c1a17]"
            />
          </label>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            Hemisphere
            <input
              type="range"
              min="0.05"
              max="1.4"
              step="0.05"
              value={lighting.hemisphereIntensity}
              onChange={(event) => onLightingChange({ hemisphereIntensity: Number(event.target.value) })}
              onMouseUp={onLightingCommit}
              onTouchEnd={onLightingCommit}
              className="w-full accent-[#1c1a17]"
            />
          </label>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            Sun
            <input
              type="range"
              min="0.2"
              max="2.4"
              step="0.05"
              value={lighting.directionalIntensity}
              onChange={(event) => onLightingChange({ directionalIntensity: Number(event.target.value) })}
              onMouseUp={onLightingCommit}
              onTouchEnd={onLightingCommit}
              className="w-full accent-[#1c1a17]"
            />
          </label>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            Environment Blur
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.02"
              value={lighting.environmentBlur}
              onChange={(event) => onLightingChange({ environmentBlur: Number(event.target.value) })}
              onMouseUp={onLightingCommit}
              onTouchEnd={onLightingCommit}
              className="w-full accent-[#1c1a17]"
            />
          </label>
        </div>

        <div className="space-y-3 rounded-[24px] border border-black/10 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">Room summary</p>
          <div className="space-y-2 text-sm text-[#4f473d]">
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

        <div className="space-y-3 rounded-[24px] border border-black/10 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">Selection</p>
          {selectedAsset ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-[#1f1b16]">
                  {selectedAssetMeta?.label ?? formatAssetLabel(selectedAsset.assetId)}
                </div>
                {selectedAssetMeta ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-black/10 bg-[#faf9f7] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#6f665a]">
                      {selectedAssetMeta.category}
                    </span>
                    <span className="rounded-full border border-black/10 bg-[#faf9f7] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#6f665a]">
                      {selectedAssetMeta.collection}
                    </span>
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-[#83796d]">{selectedAsset.id}</div>
              </div>
              <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                Anchor
                <select
                  value={selectedAsset.anchorType ?? "floor"}
                  onChange={(event) =>
                    onUpdateAsset(selectedAsset.id, {
                      anchorType: event.target.value as SceneAnchorType
                    })
                  }
                  className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2 text-sm text-[#2f2921] outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35"
                >
                  {SCENE_ANCHOR_TYPES.map((anchorType) => (
                    <option key={anchorType} value={anchorType}>
                      {anchorLabel[anchorType]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
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
                    className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2 text-sm text-[#2f2921] outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35"
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
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
                    className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2 text-sm text-[#2f2921] outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35"
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                  Y
                  <input
                    type="number"
                    step="0.1"
                    value={selectedAsset.position[1]}
                    disabled={isYManagedByAnchor}
                    onChange={(event) =>
                      onUpdateAsset(selectedAsset.id, {
                        position: [
                          selectedAsset.position[0],
                          Number(event.target.value),
                          selectedAsset.position[2]
                        ]
                      })
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35 ${
                      isYManagedByAnchor
                        ? "cursor-not-allowed border-black/10 bg-[#efede8] text-[#9b9287]"
                        : "border-black/10 bg-[#faf9f7] text-[#2f2921]"
                    }`}
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                  Rotate Y
                  <input
                    type="number"
                    step="0.1"
                    value={selectedAsset.rotation[1]}
                    disabled={isRotationManagedByAnchor}
                    onChange={(event) =>
                      onUpdateAsset(selectedAsset.id, {
                        rotation: [
                          selectedAsset.rotation[0],
                          Number(event.target.value),
                          selectedAsset.rotation[2]
                        ]
                      })
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35 ${
                      isRotationManagedByAnchor
                        ? "cursor-not-allowed border-black/10 bg-[#efede8] text-[#9b9287]"
                        : "border-black/10 bg-[#faf9f7] text-[#2f2921]"
                    }`}
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
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
                    className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2 text-sm text-[#2f2921] outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35"
                  />
                </label>
              </div>
              {isYManagedByAnchor || isRotationManagedByAnchor ? (
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#8b8277]">
                  Current anchor manages
                  {isYManagedByAnchor ? " height" : ""}
                  {isYManagedByAnchor && isRotationManagedByAnchor ? " and" : ""}
                  {isRotationManagedByAnchor ? " yaw" : ""}.
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => onRemoveAsset(selectedAsset.id)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700 transition hover:border-red-400 hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                Remove asset
              </button>
            </div>
          ) : (
            <div className="text-sm leading-6 text-[#6f665b]">
              Select a placed asset in top view to edit its position, rotation, and scale.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
