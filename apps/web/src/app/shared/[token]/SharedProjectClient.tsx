"use client";

import { useEffect, useMemo } from "react";
import { ArrowUpRight, Box, Layers3, Link2, Play, Sparkles } from "lucide-react";
import { SceneViewport } from "../../../components/editor/SceneViewport";
import { StudioMetricGrid } from "../../../components/editor/StudioMetricGrid";
import { StudioModeToggle } from "../../../components/editor/StudioModeToggle";
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
import { useSceneStore } from "../../../lib/stores/useSceneStore";

type SharedProjectClientProps = {
  projectName: string;
  projectDescription: string | null;
  sceneBootstrap: SceneDocumentBootstrap | null;
  linkPermission: SharePermission;
  expiresAt: string | null;
  pinnedVersionNumber: number | null;
  previewAssetSummary: ProjectAssetSummary | null;
};

type ViewerHotspotCard = {
  id: string;
  label: string;
  category: string;
  collection: string;
  tone: "sand" | "olive" | "slate" | "ember";
  anchorType: string;
  index: number;
  vendor: string | null;
  price: string | null;
  imageUrl: string | null;
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

function formatPosition(position: [number, number, number] | null) {
  if (!position) return null;
  return `${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}`;
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
    useSceneStore.setState({ entranceId: scenePayload.entranceId });
    applyShellPreset("viewer");
    return () => {
      resetShellState();
      resetScene();
    };
  }, [applyShellPreset, resetScene, resetShellState, scenePayload, setScene, setSelectedAssetId]);

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
          label: catalogItem?.label ?? asset.assetId,
          category: catalogItem?.category ?? "Uncatalogued",
          collection: catalogItem?.collection ?? "Custom",
          tone: catalogItem?.tone ?? "slate",
          anchorType: normalizeSceneAnchorType(asset.anchorType),
          index,
          vendor: readMetadataText(metadata, "vendor"),
          price: readMetadataPrice(metadata),
          imageUrl: readMetadataImageUrl(metadata)
        } satisfies ViewerHotspotCard;
      }),
    [catalog, mappedScene, scenePayload.assets]
  );
  const selectedHotspot = useMemo(
    () => assetHotspots.find((asset) => asset.id === selectedAssetId) ?? null,
    [assetHotspots, selectedAssetId]
  );
  const selectedPreview = selectedHotspot ? getCatalogPreviewClasses(selectedHotspot.tone) : null;
  const selectedSceneAsset = useMemo(
    () => scenePayload.assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [scenePayload.assets, selectedAssetId]
  );
  const selectedSceneNode = useMemo(
    () => mappedScene?.document.nodes.find((node) => node.id === selectedAssetId) ?? null,
    [mappedScene, selectedAssetId]
  );
  const selectedMetadata = useMemo(
    () => toMetadataRecord(selectedSceneNode?.metadata ?? null),
    [selectedSceneNode]
  );
  const selectedProductFields = useMemo(
    () => ({
      position: formatPosition(selectedSceneAsset?.position ?? null),
      sku: readMetadataText(selectedMetadata, "sku"),
      vendor: readMetadataText(selectedMetadata, "vendor"),
      material: readMetadataText(selectedMetadata, "material"),
      variant: readMetadataText(selectedMetadata, "variant"),
      price: readMetadataPrice(selectedMetadata),
      productUrl: readMetadataUrl(selectedMetadata, "productUrl"),
      imageUrl: readMetadataImageUrl(selectedMetadata)
    }),
    [selectedMetadata, selectedSceneAsset]
  );
  const viewerModes = [
    { id: "top", label: "Top View", icon: Box },
    { id: "walk", label: "Walk", icon: Play, enabled: canEnterWalk }
  ];

  if (isVersionMappingFailed) {
    return (
      <div className="min-h-screen bg-[#ece8e1] px-4 pb-12 pt-10 text-[#1f1b16] sm:px-8">
        <div className="mx-auto max-w-4xl rounded-[24px] border border-[#c06e3d]/20 bg-white p-8 shadow-[0_18px_46px_rgba(40,30,21,0.12)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c06e3d]/25 bg-[#fff7f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a75f37]">
            <Link2 className="h-3.5 w-3.5" />
            Snapshot unavailable
          </div>
          <h1 className="mt-5 text-4xl font-cormorant font-light tracking-tight text-[#1d1712] sm:text-5xl">
            This shared snapshot cannot be rendered.
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#61574d]">
            The saved version exists, but its scene data is incompatible with the current viewer mapper.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[14px] border border-black/10 bg-[#faf7f2] p-4 text-sm text-[#5b5146]">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7c70]">Project</div>
              <div className="mt-2 font-semibold text-[#1f1b16]">{projectName}</div>
            </div>
            <div className="rounded-[14px] border border-black/10 bg-[#faf7f2] p-4 text-sm text-[#5b5146]">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7c70]">Pinned version</div>
              <div className="mt-2 font-semibold text-[#1f1b16]">
                {pinnedVersionNumber ? `v${pinnedVersionNumber}` : "Unknown"}
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
              Shared scene
            </div>
            <h1 className="mt-4 text-4xl font-cormorant font-light tracking-tight text-[#18130f] sm:text-5xl">{projectName}</h1>
            {projectDescription ? (
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5f564b] sm:text-[15px]">{projectDescription}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7e7367]">
              <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">{shareCapabilities.accessLabel}</span>
              <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">
                {scenePayload.assets.length} products
              </span>
              {pinnedVersionNumber ? (
                <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">Version {pinnedVersionNumber}</span>
              ) : null}
              {expiresAt ? (
                <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">
                  Expires {new Date(expiresAt).toLocaleDateString()}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[420px] lg:items-end">
            <div className="flex flex-wrap items-center gap-3">
              {shareCapabilities.showPreviewNotice ? (
                <div className="rounded-full border border-amber-500/30 bg-amber-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a5a25]">
                  View-only link
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
                  label: "Snapshot",
                  value: pinnedVersionNumber ? `Pinned v${pinnedVersionNumber}` : "Live shared scene"
                },
                {
                  label: "Products",
                  value: `${scenePayload.assets.length} placed pieces`
                },
                {
                  label: "Scene",
                  value:
                    scenePayload.rooms.length > 0
                      ? `${scenePayload.rooms.length} room zones`
                      : `${scenePayload.floors.length} floor surfaces`
                },
                {
                  label: "Access",
                  value: shareCapabilities.showPreviewNotice ? "Read-only" : "Shared viewer"
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

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_380px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a7c70]">Viewer canvas</div>
                <p className="mt-1 text-sm leading-6 text-[#665c51]">
                  Inspect the furnished room in a calm read-only shell. Select hotspots to review products.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/86 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6e6458]">
                <Layers3 className="h-4 w-4" />
                Read-only presentation
              </div>
            </div>
            <div className="overflow-hidden rounded-[30px] border border-black/10 bg-white shadow-[0_20px_54px_rgba(16,18,22,0.16)]">
              <div className="flex items-center justify-between gap-3 border-b border-black/8 bg-[#fcfaf6] px-4 py-3 sm:px-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7a7064]">
                  {viewMode === "top" ? "Planner overview" : "Immersive walkthrough"}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8e8377]">
                  {selectedHotspot ? `Focused on ${selectedHotspot.label}` : "No product selected"}
                </div>
              </div>
            <SceneViewport
              className="h-[72vh] rounded-none border-0 shadow-none sm:h-[78vh]"
              camera={{ fov: 45, position: [0, 8, 14] }}
              toneMappingExposure={1.05}
              chromeTone="light"
              modeBadge={viewMode === "top" ? "Read-only top view" : "Read-only walkthrough"}
              bottomNotice={
                shareCapabilities.showPreviewNotice
                  ? "This link opens in read-only mode for safe public viewing."
                  : null
              }
            />
          </div>
          </div>

          <aside className="rounded-[24px] border border-black/10 bg-[#faf8f4] p-4 shadow-[0_14px_34px_rgba(16,18,22,0.1)] sm:p-5 xl:sticky xl:top-8 xl:self-start">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7e7367]">
                  <Sparkles className="h-4 w-4" />
                  Product inspection
                </div>
                <p className="mt-2 text-xs leading-6 text-[#6a6055]">
                  Select markers in the room or choose items from the list.
                </p>
              </div>
              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#695f55]">
                {assetHotspots.length}
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <div className={`rounded-[20px] border border-black/10 p-4 ${selectedPreview?.surface ?? "bg-white"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e7367]">Selected product</div>
                  <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#6e6458]">
                    {selectedHotspot ? `Hotspot #${selectedHotspot.index + 1}` : "Awaiting selection"}
                  </span>
                </div>
                {selectedHotspot ? (
                  <div className="mt-3">
                    {selectedProductFields.imageUrl ? (
                      <div className="mb-3 overflow-hidden rounded-[14px] border border-black/10 bg-white/70">
                        <img
                          src={selectedProductFields.imageUrl}
                          alt={selectedHotspot.label}
                          className="h-36 w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="text-lg font-semibold leading-tight text-[#1f1b16]">{selectedHotspot.label}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6e6458]">
                        {selectedHotspot.category}
                      </span>
                      <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6e6458]">
                        {selectedHotspot.collection}
                      </span>
                      <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6e6458]">
                        {selectedHotspot.anchorType.replaceAll("_", " ")}
                      </span>
                    </div>
                    {selectedProductFields.price ? (
                      <p className="mt-4 text-lg font-semibold text-[#1f1b16]">{selectedProductFields.price}</p>
                    ) : null}
                    <div className="mt-3 grid gap-2 text-[11px] text-[#5f564b]">
                      {selectedProductFields.vendor ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white/70 px-2.5 py-2">
                          <span className="uppercase tracking-[0.12em] text-[#84796d]">Vendor</span>
                          <span className="font-semibold text-[#1f1b16]">{selectedProductFields.vendor}</span>
                        </div>
                      ) : null}
                      {selectedProductFields.material ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white/70 px-2.5 py-2">
                          <span className="uppercase tracking-[0.12em] text-[#84796d]">Material</span>
                          <span className="font-semibold text-[#1f1b16]">{selectedProductFields.material}</span>
                        </div>
                      ) : null}
                      {selectedProductFields.variant ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white/70 px-2.5 py-2">
                          <span className="uppercase tracking-[0.12em] text-[#84796d]">Variant</span>
                          <span className="font-semibold text-[#1f1b16]">{selectedProductFields.variant}</span>
                        </div>
                      ) : null}
                      {selectedProductFields.sku ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white/70 px-2.5 py-2">
                          <span className="uppercase tracking-[0.12em] text-[#84796d]">SKU</span>
                          <span className="font-semibold text-[#1f1b16]">{selectedProductFields.sku}</span>
                        </div>
                      ) : null}
                    </div>
                    {selectedProductFields.productUrl ? (
                      <a
                        href={selectedProductFields.productUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-black/15 bg-[#f3eee5] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1f1b16] transition hover:bg-[#ebe4d7]"
                      >
                        Open product page
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[#61574d]">
                    No product selected yet. Choose a hotspot from the canvas or product list to inspect details.
                  </p>
                )}
              </div>

              <div className="rounded-[18px] border border-black/10 bg-white p-4">
                <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e7367]">
                  <span>Hotspot list</span>
                  <span>{assetHotspots.length}</span>
                </div>
                {assetHotspots.length > 0 ? (
                  <div className="mt-3 max-h-[340px] space-y-2.5 overflow-y-auto pr-1">
                    {assetHotspots.map((hotspot) => {
                      const preview = getCatalogPreviewClasses(hotspot.tone);
                      const isActive = hotspot.id === selectedAssetId;
                      return (
                        <button
                          key={hotspot.id}
                          type="button"
                          onClick={() => setSelectedAssetId(hotspot.id)}
                          aria-pressed={isActive}
                          aria-label={`Inspect hotspot ${hotspot.index + 1}: ${hotspot.label}`}
                          className={`group flex w-full items-stretch gap-3 rounded-[18px] border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 ${
                            isActive
                              ? "border-black/15 bg-[#f8f4ed] shadow-[0_14px_30px_rgba(29,24,18,0.08)]"
                              : "border-black/10 bg-[#fcfbf8] hover:border-black/20 hover:bg-white"
                          }`}
                        >
                          <div className={`relative h-[86px] w-[92px] shrink-0 overflow-hidden rounded-[14px] border border-black/10 ${preview.surface}`}>
                            {hotspot.imageUrl ? (
                              <img src={hotspot.imageUrl} alt={hotspot.label} className="h-full w-full object-cover" />
                            ) : (
                              <>
                                <div className="absolute inset-x-3 bottom-3 h-6 rounded-full bg-black/10 blur-md" />
                                <div className="absolute inset-x-4 bottom-4 h-8 rounded-[14px] border border-black/10 bg-white/50" />
                                <div className="absolute bottom-6 left-1/2 h-8 w-8 -translate-x-1/2 rounded-[12px] border border-black/10 bg-white/60" />
                              </>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 py-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[#1f1b16]">{hotspot.label}</div>
                                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f655a]">
                                  {hotspot.collection}
                                </div>
                                {hotspot.vendor ? (
                                  <div className="mt-1 truncate text-xs text-[#6f655a]">{hotspot.vendor}</div>
                                ) : null}
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${
                                  isActive
                                    ? "bg-[#171411] text-white"
                                    : "border border-black/10 bg-white text-[#6f655a]"
                                }`}
                              >
                                #{hotspot.index + 1}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="rounded-full border border-black/10 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#736659]">
                                {hotspot.category}
                              </span>
                              <span className="rounded-full border border-black/10 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#736659]">
                                {hotspot.anchorType.replaceAll("_", " ")}
                              </span>
                              {hotspot.price ? (
                                <span className="rounded-full border border-black/10 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#736659]">
                                  {hotspot.price}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[#61574d]">
                    This room does not have visible hotspot products yet.
                  </p>
                )}
              </div>

              <div className="rounded-[18px] border border-black/10 bg-white p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e7367]">Room mix</div>
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
                        {summaryUncataloguedCount} uncatalogued piece{summaryUncataloguedCount > 1 ? "s" : ""} omitted from this list.
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
                        {placedAssetSummary.unmatchedCount} uncatalogued piece{placedAssetSummary.unmatchedCount > 1 ? "s" : ""} omitted from this list.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[#61574d]">
                    No catalogued products were found in this snapshot.
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
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
