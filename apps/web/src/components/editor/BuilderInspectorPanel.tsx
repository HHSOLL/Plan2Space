"use client";

import { SlidersHorizontal, Trash2 } from "lucide-react";
import type { LibraryCatalogItem } from "../../lib/builder/catalog";
import { SCENE_ANCHOR_TYPES, type SceneAnchorType } from "../../lib/scene/anchor-types";
import { builderFloorFinishes, builderWallFinishes } from "../../lib/builder/templates";
import {
  LIGHTING_PRESETS,
  inferLightingPresetId,
  type LightingPresetId
} from "../../lib/scene/lighting-presets";
import type { TransformMode, TransformSpace } from "../../lib/stores/useEditorStore";
import type { LightingSettings, SceneAsset } from "../../lib/stores/useSceneStore";

type BuilderInspectorPanelProps = {
  visible: boolean;
  layout?: "overlay" | "inline";
  className?: string;
  transformMode: TransformMode;
  transformSpace: TransformSpace;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  lighting: LightingSettings;
  wallsCount: number;
  floorsCount: number;
  assetsCount: number;
  selectedAsset: SceneAsset | null;
  selectedAssetMeta: LibraryCatalogItem | null;
  onTransformModeChange: (mode: TransformMode) => void;
  onTransformSpaceChange: (space: TransformSpace) => void;
  onWallMaterialChange: (index: number) => void;
  onFloorMaterialChange: (index: number) => void;
  onLightingChange: (lighting: Partial<LightingSettings>) => void;
  onLightingCommit: () => void;
  onApplyLightingPreset: (presetId: LightingPresetId) => void;
  onUpdateAsset: (id: string, updates: Partial<SceneAsset>) => void;
  onRemoveAsset: (id: string) => void;
  formatAssetLabel: (assetId: string) => string;
};

function formatDimensionsMm(
  dimensions: { width: number; depth: number; height: number } | null | undefined
) {
  if (!dimensions) return null;
  return `W ${dimensions.width} / D ${dimensions.depth} / H ${dimensions.height} mm`;
}

export function BuilderInspectorPanel({
  visible,
  layout = "overlay",
  className,
  transformMode,
  transformSpace,
  wallMaterialIndex,
  floorMaterialIndex,
  lighting,
  wallsCount,
  floorsCount,
  assetsCount,
  selectedAsset,
  selectedAssetMeta,
  onTransformModeChange,
  onTransformSpaceChange,
  onWallMaterialChange,
  onFloorMaterialChange,
  onLightingChange,
  onLightingCommit,
  onApplyLightingPreset,
  onUpdateAsset,
  onRemoveAsset,
  formatAssetLabel
}: BuilderInspectorPanelProps) {
  const anchorLabel: Record<SceneAnchorType, string> = {
    floor: "바닥",
    wall: "벽",
    ceiling: "천장",
    furniture_surface: "가구 표면",
    desk_surface: "데스크 표면",
    shelf_surface: "선반 표면"
  };
  const isYManagedByAnchor =
    selectedAsset?.anchorType === "floor" ||
    selectedAsset?.anchorType === "ceiling" ||
    selectedAsset?.anchorType === "desk_surface" ||
    selectedAsset?.anchorType === "furniture_surface" ||
    selectedAsset?.anchorType === "shelf_surface";
  const isRotationManagedByAnchor = selectedAsset?.anchorType === "wall";
  const productDimensions = selectedAsset?.product?.dimensionsMm ?? selectedAssetMeta?.dimensionsMm ?? null;
  const productFinishColor = selectedAsset?.product?.finishColor ?? selectedAssetMeta?.finishColor ?? null;
  const productFinishMaterial = selectedAsset?.product?.finishMaterial ?? selectedAssetMeta?.finishMaterial ?? null;
  const productDetailNotes = selectedAsset?.product?.detailNotes ?? selectedAssetMeta?.detailNotes ?? null;
  const scaleLocked =
    selectedAsset?.product?.scaleLocked ?? selectedAssetMeta?.scaleLocked ?? false;
  const dimensionsLabel = formatDimensionsMm(productDimensions);
  const activeLightingPresetId = inferLightingPresetId(lighting);
  const containerClassName =
    layout === "inline"
      ? `flex h-full min-h-0 flex-col ${className ?? ""}`.trim()
      : `absolute inset-y-3 right-3 z-[30] flex w-[min(86vw,340px)] flex-col rounded-[28px] border border-black/10 bg-[#f7f5f1]/95 shadow-[0_18px_44px_rgba(17,19,22,0.18)] backdrop-blur-xl transition-all duration-300 xl:inset-y-5 xl:right-5 ${
          visible ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[108%] opacity-0"
        } ${className ?? ""}`.trim();

  return (
    <aside className={containerClassName}>
      <div className="border-b border-black/10 px-5 py-4">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#6f665b]">
          <SlidersHorizontal className="h-4 w-4" />
          속성 패널
        </div>
        <p className="mt-3 text-sm text-[#5f574d]">
          마감재와 선택한 제품의 배치/변형 값을 조정합니다.
        </p>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">변형 모드</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "translate", label: "이동" },
              { id: "rotate", label: "회전" }
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
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">좌표계</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "world", label: "월드" },
              { id: "local", label: "로컬" }
            ].map((space) => (
              <button
                key={space.id}
                type="button"
                onClick={() => onTransformSpaceChange(space.id as TransformSpace)}
                className={`rounded-2xl px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
                  transformSpace === space.id
                    ? "bg-[#1c1a17] text-white"
                    : "border border-black/10 bg-white text-[#4e473d] hover:border-black/20"
                }`}
              >
                {space.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-5 text-[#82796d]">
            월드는 방 기준, 로컬은 선택한 제품 기준 축으로 이동/회전합니다.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">벽 마감</p>
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
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">바닥 마감</p>
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
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">조명</p>
          <div className="grid gap-2">
            {LIGHTING_PRESETS.map((preset) => {
              const isActive = activeLightingPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onApplyLightingPreset(preset.id)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    isActive
                      ? "border-[#1c1a17] bg-[#1c1a17] text-white"
                      : "border-black/10 bg-[#faf9f7] text-[#4e473d] hover:border-black/20"
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em]">{preset.label}</div>
                  <div className={`mt-1 text-[11px] leading-4 ${isActive ? "text-white/80" : "text-[#6f665a]"}`}>
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            주변광
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
            하늘광
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
            직사광
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
            환경 블러
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
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">공간 요약</p>
          <div className="space-y-2 text-sm text-[#4f473d]">
            <div className="flex items-center justify-between">
              <span>벽</span>
              <span>{wallsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>바닥 구역</span>
              <span>{floorsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>제품</span>
              <span>{assetsCount}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-[24px] border border-black/10 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">선택 항목</p>
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
              {dimensionsLabel || productFinishColor || productFinishMaterial || productDetailNotes ? (
                <div className="space-y-3 rounded-[18px] border border-black/10 bg-[#faf9f7] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                    실제 규격
                  </div>
                  {dimensionsLabel ? (
                    <div className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-semibold text-[#1f1b16]">
                      {dimensionsLabel}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {productFinishColor ? (
                      <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6f665a]">
                        색상 {productFinishColor}
                      </span>
                    ) : null}
                    {productFinishMaterial ? (
                      <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6f665a]">
                        재질 {productFinishMaterial}
                      </span>
                    ) : null}
                  </div>
                  {productDetailNotes ? (
                    <p className="text-xs leading-6 text-[#6f665b]">{productDetailNotes}</p>
                  ) : null}
                </div>
              ) : null}
              <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                기준면
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
                  Y축 회전
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
                  크기 비율
                  <input
                    type="number"
                    step="0.1"
                    value={selectedAsset.scale[0]}
                    disabled={scaleLocked}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      onUpdateAsset(selectedAsset.id, {
                        scale: [nextValue, nextValue, nextValue]
                      });
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35 ${
                      scaleLocked
                        ? "cursor-not-allowed border-black/10 bg-[#efede8] text-[#9b9287]"
                        : "border-black/10 bg-[#faf9f7] text-[#2f2921]"
                    }`}
                  />
                </label>
              </div>
              {isYManagedByAnchor || isRotationManagedByAnchor ? (
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#8b8277]">
                  현재 기준면이
                  {isYManagedByAnchor ? " 높이" : ""}
                  {isYManagedByAnchor && isRotationManagedByAnchor ? " 및" : ""}
                  {isRotationManagedByAnchor ? " 회전" : ""}
                  값을 관리합니다.
                </div>
              ) : null}
              {scaleLocked ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[#8a6a2c]">
                  이 제품은 실제 규격 기준으로 고정되어 있어 크기 비율을 직접 변경할 수 없습니다.
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => onRemoveAsset(selectedAsset.id)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700 transition hover:border-red-400 hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                제품 삭제
              </button>
            </div>
          ) : (
            <div className="text-sm leading-6 text-[#6f665b]">
              상단뷰에서 배치된 제품을 선택하면 위치/회전/크기를 조정할 수 있습니다.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
