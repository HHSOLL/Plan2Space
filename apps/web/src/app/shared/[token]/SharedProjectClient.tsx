"use client";

import { useEffect, useMemo } from "react";
import { Box, Link2, Play } from "lucide-react";
import { ProductHotspotDrawer } from "../../../components/viewer/ProductHotspotDrawer";
import { ReadOnlySceneViewport } from "../../../components/viewer/ReadOnlySceneViewport";
import { StudioMetricGrid } from "../../../components/editor/StudioMetricGrid";
import { StudioModeToggle } from "../../../components/editor/StudioModeToggle";
import { StudioWorkspaceShell } from "../../../components/layout/StudioWorkspaceShell";
import { useAssetCatalog } from "../../../components/editor/useAssetCatalog";
import { getScaleGateMessage } from "../../../lib/ai/scaleInfo";
import {
  findCatalogItem,
  getCatalogPreviewClasses,
  summarizePlacedCatalogItems,
  type ProjectAssetSummary
} from "../../../lib/builder/catalog";
import { toSceneStorePatch, type SceneDocumentBootstrap } from "../../../lib/domain/scene-document";
import { normalizeSceneAnchorType } from "../../../lib/scene/anchor-types";
import { resolveShareCapabilities, type SharePermission } from "../../../lib/share/permissions";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useCameraStore, useSelectionStore, useShellStore } from "../../../lib/stores/scene-slices";
import type { ProductHotspot } from "../../../lib/viewer/hotspots";

type SharedProjectClientProps = {
  projectName: string;
  projectDescription: string | null;
  sceneBootstrap: SceneDocumentBootstrap | null;
  linkPermission: SharePermission;
  expiresAt: string | null;
  pinnedVersionNumber: number | null;
  previewAssetSummary: ProjectAssetSummary | null;
};

function toMetadataRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readMetadataText(record: Record<string, unknown> | null, key: string) {
  if (!record) return null;
  const value = record[key];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readMetadataUrl(record: Record<string, unknown> | null, key: string) {
  const value = readMetadataText(record, key);
  if (!value) return null;
  return value.startsWith("http://") || value.startsWith("https://") ? value : null;
}

function readMetadataImageUrl(record: Record<string, unknown> | null) {
  return (
    readMetadataUrl(record, "imageUrl") ??
    readMetadataUrl(record, "thumbnailUrl") ??
    readMetadataUrl(record, "previewImageUrl")
  );
}

function readMetadataPrice(record: Record<string, unknown> | null) {
  if (!record) return null;
  const raw = record.price;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0
    }).format(raw);
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  return null;
}

export function SharedProjectClient({
  projectName,
  projectDescription,
  sceneBootstrap,
  linkPermission,
  expiresAt,
  pinnedVersionNumber,
  previewAssetSummary
}: SharedProjectClientProps) {
  const { setScene, resetScene } = useShellStore();
  const { selectedAssetId, setSelectedAssetId } = useSelectionStore();
  const { setEntranceId } = useCameraStore();
  const applyShellPreset = useEditorStore((state) => state.applyShellPreset);
  const resetShellState = useEditorStore((state) => state.resetShellState);
  const setViewMode = useEditorStore((state) => state.setViewMode);
  const viewMode = useEditorStore((state) => state.viewMode);
  const shareCapabilities = useMemo(() => resolveShareCapabilities(linkPermission), [linkPermission]);
  const { catalog } = useAssetCatalog();

  const mappedScene = sceneBootstrap;
  const isVersionMappingFailed = !mappedScene;
  const fallbackScenePayload = useMemo(
    () => ({
      walls: [],
      openings: [],
      floors: [],
      ceilings: [],
      rooms: [],
      cameraAnchors: [],
      navGraph: { nodes: [], edges: [] },
      assets: [],
      scale: 1,
      scaleInfo: {
        value: 1,
        source: "unknown" as const,
        confidence: 0,
        evidence: {
          notes: "저장된 장면 버전이 없습니다."
        }
      },
      wallMaterialIndex: 0,
      floorMaterialIndex: 0,
      lighting: {
        ambientIntensity: 0.35,
        hemisphereIntensity: 0.4,
        directionalIntensity: 1.05,
        environmentBlur: 0.2
      },
      entranceId: null
    }),
    []
  );
  const scenePayload = useMemo(
    () => (mappedScene ? toSceneStorePatch(mappedScene) : fallbackScenePayload),
    [fallbackScenePayload, mappedScene]
  );

  useEffect(() => {
    setScene({
      walls: scenePayload.walls,
      openings: scenePayload.openings,
      floors: scenePayload.floors,
      ceilings: scenePayload.ceilings,
      rooms: scenePayload.rooms,
      cameraAnchors: scenePayload.cameraAnchors,
      navGraph: scenePayload.navGraph,
      assets: scenePayload.assets,
      scale: scenePayload.scale,
      scaleInfo: scenePayload.scaleInfo,
      wallMaterialIndex: scenePayload.wallMaterialIndex,
      floorMaterialIndex: scenePayload.floorMaterialIndex,
      lighting: scenePayload.lighting
    });
    setSelectedAssetId(scenePayload.assets[0]?.id ?? null);
    setEntranceId(scenePayload.entranceId);
    applyShellPreset("viewer");
    return () => {
      resetShellState();
      resetScene();
    };
  }, [applyShellPreset, resetScene, resetShellState, scenePayload, setEntranceId, setScene, setSelectedAssetId]);

  const placedAssetSummary = useMemo(
    () => summarizePlacedCatalogItems(catalog, scenePayload.assets, 4),
    [catalog, scenePayload.assets]
  );
  const summaryItemsForRail = previewAssetSummary?.highlightedItems ?? null;
  const summaryCollections = previewAssetSummary?.collections ?? placedAssetSummary.collections;
  const summaryUncataloguedCount = previewAssetSummary?.uncataloguedCount ?? placedAssetSummary.unmatchedCount;
  const canEnterWalk =
    (scenePayload.walls.length > 0 || scenePayload.floors.length > 0) &&
    !getScaleGateMessage(scenePayload.scale, scenePayload.scaleInfo);
  const assetHotspots = useMemo(
    () =>
      scenePayload.assets.map((asset, index) => {
        const catalogItem = findCatalogItem(catalog, asset);
        const sceneNode = mappedScene?.document.nodes.find((node) => node.id === asset.id) ?? null;
        const metadata = toMetadataRecord(sceneNode?.metadata ?? null);
        return {
          id: asset.id,
          name: catalogItem?.label ?? asset.assetId,
          category: catalogItem?.category ?? "미분류",
          collection: catalogItem?.collection ?? "사용자 배치",
          tone: catalogItem?.tone ?? "slate",
          anchorType: normalizeSceneAnchorType(asset.anchorType),
          index,
          brand: readMetadataText(metadata, "vendor"),
          price: readMetadataPrice(metadata),
          thumbnail: readMetadataImageUrl(metadata),
          options: readMetadataText(metadata, "variant"),
          externalUrl: readMetadataUrl(metadata, "productUrl"),
          material: readMetadataText(metadata, "material")
        } satisfies ProductHotspot;
      }),
    [catalog, mappedScene, scenePayload.assets]
  );
  const selectedHotspot = useMemo(
    () => assetHotspots.find((asset) => asset.id === selectedAssetId) ?? null,
    [assetHotspots, selectedAssetId]
  );
  const selectedHotspotLabel = selectedHotspot?.name ?? null;
  const viewerModes = [
    { id: "top", label: "상단뷰", icon: Box },
    { id: "walk", label: "워크뷰", icon: Play, enabled: canEnterWalk }
  ];

  if (isVersionMappingFailed) {
    return (
      <div className="min-h-screen bg-[#ece8e1] px-4 pb-12 pt-10 text-[#1f1b16] sm:px-8">
        <div className="mx-auto max-w-4xl rounded-[24px] border border-[#c06e3d]/20 bg-white p-8 shadow-[0_18px_46px_rgba(40,30,21,0.12)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c06e3d]/25 bg-[#fff7f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a75f37]">
            <Link2 className="h-3.5 w-3.5" />
            스냅샷 로드 실패
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#1d1712] sm:text-4xl">
            공유 스냅샷을 렌더링할 수 없습니다.
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#61574d]">
            저장된 버전은 존재하지만 현재 viewer 매퍼와 장면 데이터가 호환되지 않습니다.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[14px] border border-black/10 bg-[#faf7f2] p-4 text-sm text-[#5b5146]">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7c70]">프로젝트</div>
              <div className="mt-2 font-semibold text-[#1f1b16]">{projectName}</div>
            </div>
            <div className="rounded-[14px] border border-black/10 bg-[#faf7f2] p-4 text-sm text-[#5b5146]">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7c70]">고정 버전</div>
              <div className="mt-2 font-semibold text-[#1f1b16]">
                {pinnedVersionNumber ? `v${pinnedVersionNumber}` : "알 수 없음"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ece8e1] text-[#1f1b16]">
      <div className="mx-auto max-w-[1680px] px-4 pb-10 pt-6 sm:px-8 sm:pt-8">
        <div className="rounded-[30px] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,243,236,0.86))] px-5 py-5 shadow-[0_18px_42px_rgba(28,22,16,0.08)] backdrop-blur-xl sm:px-7 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/85 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#7e7367]">
              <Link2 className="h-4 w-4" />
              공유 장면
            </div>
            <h1 className="mt-4 text-4xl font-light tracking-tight text-[#18130f] sm:text-5xl">{projectName}</h1>
            {projectDescription ? (
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5f564b] sm:text-[15px]">{projectDescription}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7e7367]">
                <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">{shareCapabilities.accessLabel}</span>
                <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">
                  제품 {scenePayload.assets.length}개
                </span>
              {pinnedVersionNumber ? (
                <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">버전 {pinnedVersionNumber}</span>
              ) : null}
              {expiresAt ? (
                <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">
                  만료 {new Date(expiresAt).toLocaleDateString()}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[420px] lg:items-end">
            <div className="flex flex-wrap items-center gap-3">
              {shareCapabilities.showPreviewNotice ? (
                <div className="rounded-full border border-amber-500/30 bg-amber-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a5a25]">
                  읽기 전용 링크
                </div>
              ) : null}
              <StudioModeToggle
                value={viewMode}
                modes={viewerModes}
                onChange={(modeId) => setViewMode(modeId as "top" | "walk")}
                variant="solid"
                className="!rounded-full !border !border-black/10 !bg-white/95 !p-1 !shadow-[0_12px_30px_rgba(20,22,24,0.14)] [&>button]:!rounded-full [&>button]:!px-4 [&>button]:!py-2.5 [&>button]:!text-[#5a5147] [&>button:hover]:!bg-[#f2eee7] [&>button:hover]:!text-[#201b16]"
              />
            </div>
            <StudioMetricGrid
              items={[
                {
                  label: "스냅샷",
                  value: pinnedVersionNumber ? `고정 v${pinnedVersionNumber}` : "공유 장면"
                },
                {
                  label: "배치 제품",
                  value: `${scenePayload.assets.length}개`
                },
                {
                  label: "장면",
                  value:
                    scenePayload.rooms.length > 0
                      ? `${scenePayload.rooms.length}개 구역`
                      : `${scenePayload.floors.length}개 바닥 면`
                },
                {
                  label: "권한",
                  value: shareCapabilities.showPreviewNotice ? "읽기 전용" : "공유 뷰어"
                }
              ]}
              gridClassName="grid w-full gap-3 sm:grid-cols-2 lg:min-w-[420px]"
              cardClassName="rounded-[18px] border border-black/10 bg-white/80 px-4 py-3"
              labelClassName="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8a7c70]"
              valueClassName="mt-2 text-sm font-semibold text-[#1f1b16]"
            />
          </div>
          </div>
        </div>

        <StudioWorkspaceShell className="mt-6">
          <ReadOnlySceneViewport
            viewMode={viewMode === "walk" ? "walk" : "top"}
            selectedLabel={selectedHotspotLabel}
            showReadOnlyNotice={shareCapabilities.showPreviewNotice}
          />

          <ProductHotspotDrawer
            hotspots={assetHotspots}
            selectedHotspotId={selectedAssetId}
            onSelectHotspot={setSelectedAssetId}
          >
            <div className="rounded-[18px] border border-black/10 bg-white p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e7367]">배치 요약</div>
                {summaryItemsForRail && summaryItemsForRail.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {summaryItemsForRail.map((item) => {
                      const preview = getCatalogPreviewClasses(item.tone);
                      return (
                        <div
                          key={item.catalogItemId ?? item.assetId}
                          className={`rounded-xl border border-black/10 p-3 ${preview.surface}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f655a]">{item.collection}</div>
                              <div className="mt-1 text-sm font-semibold text-[#1f1b16]">{item.label}</div>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${preview.chip}`}>
                              x{item.count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {summaryUncataloguedCount > 0 ? (
                      <p className="text-xs leading-6 text-[#6a6055]">
                        목록에 매칭되지 않은 제품 {summaryUncataloguedCount}개는 요약에서 제외되었습니다.
                      </p>
                    ) : null}
                  </div>
                ) : placedAssetSummary.items.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {placedAssetSummary.items.map(({ item, count }) => {
                      const preview = getCatalogPreviewClasses(item.tone);
                      return (
                        <div key={item.assetId} className={`rounded-xl border border-black/10 p-3 ${preview.surface}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f655a]">{item.collection}</div>
                              <div className="mt-1 text-sm font-semibold text-[#1f1b16]">{item.label}</div>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${preview.chip}`}>
                              x{count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {placedAssetSummary.unmatchedCount > 0 ? (
                      <p className="text-xs leading-6 text-[#6a6055]">
                        목록에 매칭되지 않은 제품 {placedAssetSummary.unmatchedCount}개는 요약에서 제외되었습니다.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[#61574d]">
                    카탈로그 매칭 제품이 없습니다.
                  </p>
                )}

                {summaryCollections.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-black/10 pt-3">
                    {summaryCollections.slice(0, 4).map((collection) => (
                      <span
                        key={collection.label}
                        className="rounded-full border border-black/10 bg-[#f7f4ee] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#6f655a]"
                      >
                        {collection.label} {collection.count}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
          </ProductHotspotDrawer>
        </StudioWorkspaceShell>
      </div>
    </div>
  );
}
