"use client";

import { useEffect, useMemo } from "react";
import { Box, Link2, Play, Sparkles } from "lucide-react";
import { useAssetCatalog } from "../../../components/editor/useAssetCatalog";
import { useSceneStore } from "../../../lib/stores/useSceneStore";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { StudioMetricGrid } from "../../../components/editor/StudioMetricGrid";
import { StudioModeToggle } from "../../../components/editor/StudioModeToggle";
import { SceneViewport } from "../../../components/editor/SceneViewport";
import { mapProjectVersionToScene } from "../../../features/floorplan/result-mapper";
import { resolveShareCapabilities, type SharePermission } from "../../../lib/share/permissions";
import { getScaleGateMessage } from "../../../lib/ai/scaleInfo";
import {
  findCatalogItem,
  getCatalogToneClasses,
  summarizePlacedCatalogItems,
  type ProjectAssetSummary
} from "../../../lib/builder/catalog";
import { normalizeSceneAnchorType } from "../../../lib/scene/anchor-types";

type SharedProjectClientProps = {
  projectName: string;
  projectDescription: string | null;
  latestVersion: Record<string, unknown> | null;
  linkPermission: SharePermission;
  expiresAt: string | null;
  pinnedVersionNumber: number | null;
  previewAssetSummary: ProjectAssetSummary | null;
};

export function SharedProjectClient({
  projectName,
  projectDescription,
  latestVersion,
  linkPermission,
  expiresAt,
  pinnedVersionNumber,
  previewAssetSummary
}: SharedProjectClientProps) {
  const setScene = useSceneStore((state) => state.setScene);
  const resetScene = useSceneStore((state) => state.resetScene);
  const selectedAssetId = useSceneStore((state) => state.selectedAssetId);
  const setSelectedAssetId = useSceneStore((state) => state.setSelectedAssetId);
  const applyShellPreset = useEditorStore((state) => state.applyShellPreset);
  const resetShellState = useEditorStore((state) => state.resetShellState);
  const setViewMode = useEditorStore((state) => state.setViewMode);
  const viewMode = useEditorStore((state) => state.viewMode);
  const shareCapabilities = useMemo(() => resolveShareCapabilities(linkPermission), [linkPermission]);
  const { catalog } = useAssetCatalog();

  const mappedScene = useMemo(() => (latestVersion ? mapProjectVersionToScene(latestVersion) : null), [latestVersion]);
  const scenePayload = useMemo(
    () =>
      mappedScene ?? {
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
            notes: "Shared project has no saved version yet."
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
        entranceId: null,
        diagnostics: {
          message: "No saved version"
        }
      },
    [mappedScene]
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
    useSceneStore.setState({ entranceId: scenePayload.entranceId });
    applyShellPreset("viewer");
    return () => {
      resetShellState();
      resetScene();
    };
  }, [applyShellPreset, resetScene, resetShellState, scenePayload, setScene, setSelectedAssetId]);

  const summaryItems = useMemo(
    () => [
      { label: "Walls", value: String(scenePayload.walls.length) },
      { label: "Openings", value: String(scenePayload.openings.length) },
      { label: "Assets", value: String(scenePayload.assets.length) },
      { label: "Rooms", value: String(scenePayload.rooms.length || scenePayload.floors.length) }
    ],
    [scenePayload.assets.length, scenePayload.floors.length, scenePayload.openings.length, scenePayload.rooms.length, scenePayload.walls.length]
  );
  const placedAssetSummary = useMemo(
    () => summarizePlacedCatalogItems(catalog, scenePayload.assets, 4),
    [catalog, scenePayload.assets]
  );
  const summaryItemsForRail = previewAssetSummary?.highlightedItems ?? null;
  const summaryCollections = previewAssetSummary?.collections ?? placedAssetSummary.collections;
  const summaryUncataloguedCount = previewAssetSummary?.uncataloguedCount ?? placedAssetSummary.unmatchedCount;
  const canEnterWalk = (scenePayload.walls.length > 0 || scenePayload.floors.length > 0) && !getScaleGateMessage(scenePayload.scale, scenePayload.scaleInfo);
  const assetHotspots = useMemo(
    () =>
      scenePayload.assets.map((asset, index) => {
        const catalogItem = findCatalogItem(catalog, asset);
        return {
          id: asset.id,
          label: catalogItem?.label ?? asset.assetId,
          category: catalogItem?.category ?? "Uncatalogued",
          collection: catalogItem?.collection ?? "Custom",
          tone: catalogItem?.tone ?? "slate",
          anchorType: normalizeSceneAnchorType(asset.anchorType),
          index
        };
      }),
    [catalog, scenePayload.assets]
  );
  const selectedHotspot = useMemo(
    () => assetHotspots.find((asset) => asset.id === selectedAssetId) ?? null,
    [assetHotspots, selectedAssetId]
  );
  const viewerModes = [
    { id: "top", label: "Top View", icon: Box },
    { id: "walk", label: "Walk", icon: Play, enabled: canEnterWalk }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="mx-auto max-w-[1600px] px-4 pb-8 pt-6 sm:px-8 sm:pb-10 sm:pt-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-white/50">
              <Link2 className="h-4 w-4" />
              Shared Viewer
            </div>
            <h1 className="mt-5 text-4xl font-outfit font-light tracking-tight sm:text-5xl">{projectName}</h1>
            {projectDescription ? (
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">{projectDescription}</p>
            ) : null}
          </div>

          <StudioModeToggle
            value={viewMode}
            modes={viewerModes}
            onChange={(modeId) => setViewMode(modeId as "top" | "walk")}
            variant="solid"
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SceneViewport
            className="h-[72vh] sm:h-[78vh]"
            camera={{ fov: 45, position: [0, 8, 14] }}
            toneMappingExposure={1.05}
            modeBadge={viewMode === "top" ? "Read-only top view" : "Read-only walkthrough"}
            bottomNotice={
              shareCapabilities.showPreviewNotice
                ? "Edit-permission links currently open in preview-only mode while the viewer/share refactor is in progress."
                : null
            }
          />

          <aside className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
              <Sparkles className="h-4 w-4" />
              Viewer Summary
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Access</div>
                <div className="mt-3 text-sm text-white/75">Preview-only viewer</div>
                <div className="mt-2 text-xs text-white/45">Requested link permission: {shareCapabilities.accessLabel}</div>
                {pinnedVersionNumber ? (
                  <div className="mt-2 text-xs text-white/45">Pinned snapshot: v{pinnedVersionNumber}</div>
                ) : null}
                {expiresAt ? (
                  <div className="mt-2 text-xs text-white/45">
                    Expires {new Date(expiresAt).toLocaleString()}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Scene stats</div>
                <div className="mt-4">
                  <StudioMetricGrid items={summaryItems} />
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Placed pieces</div>
                {summaryItemsForRail && summaryItemsForRail.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {summaryItemsForRail.map((item) => {
                      const tone = getCatalogToneClasses(item.tone);
                      return (
                        <div key={item.catalogItemId ?? item.assetId} className={`rounded-[18px] border p-3 ${tone.tile}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                                {item.collection}
                              </div>
                              <div className="mt-2 text-sm font-medium text-white">{item.label}</div>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${tone.badge}`}>
                              x{item.count}
                            </span>
                          </div>
                          <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
                            {item.category}
                          </div>
                        </div>
                      );
                    })}
                    {summaryUncataloguedCount > 0 ? (
                      <div className="text-xs leading-6 text-white/45">
                        {summaryUncataloguedCount} custom or uncatalogued piece
                        {summaryUncataloguedCount > 1 ? "s" : ""} hidden from the curated list.
                      </div>
                    ) : null}
                  </div>
                ) : placedAssetSummary.items.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {placedAssetSummary.items.map(({ item, count }) => {
                      const tone = getCatalogToneClasses(item.tone);
                      return (
                        <div key={item.assetId} className={`rounded-[18px] border p-3 ${tone.tile}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                                {item.collection}
                              </div>
                              <div className="mt-2 text-sm font-medium text-white">{item.label}</div>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${tone.badge}`}>
                              x{count}
                            </span>
                          </div>
                          <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
                            {item.category}
                          </div>
                        </div>
                      );
                    })}
                    {placedAssetSummary.unmatchedCount > 0 ? (
                      <div className="text-xs leading-6 text-white/45">
                        {placedAssetSummary.unmatchedCount} custom or uncatalogued piece
                        {placedAssetSummary.unmatchedCount > 1 ? "s" : ""} hidden from the curated list.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 text-sm leading-6 text-white/50">
                    No placed pieces were found in the saved scene yet.
                  </div>
                )}
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Product hotspots</div>
                {assetHotspots.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {assetHotspots.map((hotspot) => {
                      const tone = getCatalogToneClasses(hotspot.tone);
                      const isActive = hotspot.id === selectedAssetId;
                      return (
                        <button
                          key={hotspot.id}
                          type="button"
                          onClick={() => setSelectedAssetId(hotspot.id)}
                          className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                            isActive ? tone.tile : "border-white/10 bg-white/[0.03] hover:border-white/25"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-white">{hotspot.label}</div>
                            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                              {hotspot.collection} · {hotspot.anchorType.replaceAll("_", " ")}
                            </div>
                          </div>
                          <span className="rounded-full border border-white/15 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">
                            #{hotspot.index + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 text-sm leading-6 text-white/50">
                    Saved snapshot has no product hotspot targets yet.
                  </div>
                )}
                {selectedHotspot ? (
                  <div className="mt-4 rounded-[16px] border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                      Selected detail
                    </div>
                    <div className="mt-2 text-sm font-medium text-white">{selectedHotspot.label}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">
                        {selectedHotspot.category}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">
                        {selectedHotspot.collection}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">
                        {selectedHotspot.anchorType.replaceAll("_", " ")}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-white/45">{selectedHotspot.id}</div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Collections</div>
                {summaryCollections.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {summaryCollections.map((collection) => (
                      <span
                        key={collection.label}
                        className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/65"
                      >
                        {collection.label} {collection.count}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 text-sm leading-6 text-white/50">
                    Collections appear here once the saved room includes catalogued pieces.
                  </div>
                )}
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Finishes</div>
                <div className="mt-4 space-y-3 text-sm text-white/70">
                  <div className="flex items-center justify-between">
                    <span>Wall preset</span>
                    <span>{scenePayload.wallMaterialIndex + 1}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Floor preset</span>
                    <span>{scenePayload.floorMaterialIndex + 1}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/55">
                {scenePayload.diagnostics?.message
                  ? `${scenePayload.diagnostics.message}. Shared links now open pinned viewer snapshots first.`
                  : "Shared links now open pinned viewer snapshots first. Use the main editor for builder, placement, and save flows."}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
