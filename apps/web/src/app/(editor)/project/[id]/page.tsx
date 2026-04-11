"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { BuilderLibraryShelf } from "../../../../components/editor/BuilderLibraryShelf";
import { useEditorStore, type EditorViewMode } from "../../../../lib/stores/useEditorStore";
import { useSceneStore } from "../../../../lib/stores/useSceneStore";
import { useProjectStore } from "../../../../lib/stores/useProjectStore";
import { motion, AnimatePresence } from "framer-motion";
import { BuilderInspectorPanel } from "../../../../components/editor/BuilderInspectorPanel";
import { BuilderLaunchState } from "../../../../components/editor/BuilderLaunchState";
import { MobileEditorControls } from "../../../../components/editor/MobileEditorControls";
import { ProjectEditorHeader } from "../../../../components/editor/ProjectEditorHeader";
import { SceneViewport } from "../../../../components/editor/SceneViewport";
import { ShareModal } from "../../../../components/editor/ShareModal";
import { useAssetCatalog } from "../../../../components/editor/useAssetCatalog";
import { useEditorSaveSession } from "../../../../components/editor/useEditorSaveSession";
import { PanelLeft, Redo2, RotateCcw, SlidersHorizontal, Undo2 } from "lucide-react";
import "../../../../lib/polyfills/progress-event";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { getScaleGateMessage, parseScaleInfo } from "../../../../lib/ai/scaleInfo";
import { fetchProjectSceneBootstrap } from "../../../../lib/api/project";
import {
  buildProjectAssetSummary,
  findCatalogItem,
  formatAssetIdLabel,
  selectStarterSetItems,
  type LibraryCatalogItem
} from "../../../../lib/builder/catalog";
import { builderFloorFinishes, builderWallFinishes } from "../../../../lib/builder/templates";
import {
  toSceneStorePatch,
  type SceneDocumentBootstrap
} from "../../../../lib/domain/scene-document";
import { constrainPlacementToAnchor, inferAnchorTypeForCatalogItem } from "../../../../lib/scene/anchors";
import { normalizeSceneAnchorType } from "../../../../lib/scene/anchor-types";

const STARTER_SET_OFFSETS: Array<[number, number]> = [
  [-2.2, -1.2],
  [0, -1.2],
  [2.2, -1.2],
  [-2.2, 0.8],
  [0, 0.8],
  [2.2, 0.8]
];

function computeBounds(walls: { start: [number, number]; end: [number, number] }[], scale: number) {
  if (walls.length === 0) return { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  walls.forEach((wall) => {
    [wall.start, wall.end].forEach(([x, z]) => {
      minX = Math.min(minX, x * scale);
      maxX = Math.max(maxX, x * scale);
      minZ = Math.min(minZ, z * scale);
      maxZ = Math.max(maxZ, z * scale);
    });
  });
  return { minX, maxX, minZ, maxZ };
}

export default function ProjectEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;

  const viewMode = useEditorStore((state) => state.viewMode);
  const setViewMode = useEditorStore((state) => state.setViewMode);
  const applyShellPreset = useEditorStore((state) => state.applyShellPreset);
  const panels = useEditorStore((state) => state.panels);
  const setPanels = useEditorStore((state) => state.setPanels);
  const togglePanel = useEditorStore((state) => state.togglePanel);
  const resetShellState = useEditorStore((state) => state.resetShellState);
  const transformMode = useEditorStore((state) => state.transformMode);
  const setIsTransforming = useEditorStore((state) => state.setIsTransforming);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const walls = useSceneStore((state) => state.walls);
  const openings = useSceneStore((state) => state.openings);
  const floors = useSceneStore((state) => state.floors);
  const ceilings = useSceneStore((state) => state.ceilings);
  const rooms = useSceneStore((state) => state.rooms);
  const cameraAnchors = useSceneStore((state) => state.cameraAnchors);
  const navGraph = useSceneStore((state) => state.navGraph);
  const assets = useSceneStore((state) => state.assets);
  const scale = useSceneStore((state) => state.scale);
  const scaleInfo = useSceneStore((state) => state.scaleInfo);
  const wallMaterialIndex = useSceneStore((state) => state.wallMaterialIndex);
  const floorMaterialIndex = useSceneStore((state) => state.floorMaterialIndex);
  const lighting = useSceneStore((state) => state.lighting);
  const selectedAssetId = useSceneStore((state) => state.selectedAssetId);
  const setWallMaterialIndex = useSceneStore((state) => state.setWallMaterialIndex);
  const setFloorMaterialIndex = useSceneStore((state) => state.setFloorMaterialIndex);
  const setLighting = useSceneStore((state) => state.setLighting);
  const setSelectedAssetId = useSceneStore((state) => state.setSelectedAssetId);
  const addFurniture = useSceneStore((state) => state.addFurniture);
  const updateFurniture = useSceneStore((state) => state.updateFurniture);
  const removeFurniture = useSceneStore((state) => state.removeFurniture);
  const initializeHistory = useSceneStore((state) => state.initializeHistory);
  const recordSnapshot = useSceneStore((state) => state.recordSnapshot);
  const undo = useSceneStore((state) => state.undo);
  const redo = useSceneStore((state) => state.redo);
  const setScene = useSceneStore((state) => state.setScene);
  const resetScene = useSceneStore((state) => state.resetScene);
  const entranceId = useSceneStore((state) => state.entranceId);
  const versionHistory = useSceneStore((state) => state.versionHistory);
  const { currentProject, loadProject } = useProjectStore();

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isWebGPUReady, setIsWebGPUReady] = useState(false);
  const {
    catalog: libraryCatalog,
    categories: libraryCategories,
    query: libraryQuery,
    setQuery: setLibraryQuery,
    activeCategory: libraryCategory,
    setActiveCategory: setLibraryCategory,
    filteredItems: filteredLibraryCatalog,
    featuredItems: featuredLibraryCatalog,
    spotlightItem: librarySpotlightItem,
    hasActiveFilters: libraryHasActiveFilters
  } = useAssetCatalog();

  useEffect(() => {
    const supportsWebGPU = typeof navigator !== "undefined" && Boolean((navigator as any).gpu);
    setIsWebGPUReady(supportsWebGPU);
  }, []);

  useEffect(() => {
    const desktopPanels =
      typeof window !== "undefined" && window.innerWidth >= 1280
        ? { assets: true, properties: true }
        : { assets: false, properties: false };
    applyShellPreset("editor", { panels: desktopPanels });
    return () => {
      resetShellState();
    };
  }, [applyShellPreset, resetShellState]);

  const preferWebGPU = searchParams.get("renderer") === "webgpu" && isWebGPUReady;
  const createRenderer = useMemo(() => {
    if (!preferWebGPU) return undefined;
    return (canvas: HTMLCanvasElement) => {
      try {
        const renderer = new WebGPURenderer({ canvas, antialias: true });
        if ("init" in renderer && typeof (renderer as unknown as { init?: () => Promise<void> }).init === "function") {
          throw new Error("WebGPU async init is not supported.");
        }
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        return renderer;
      } catch (error) {
        console.warn("[renderer] WebGPU fallback -> WebGL", error);
        setIsWebGPUReady(false);
        const fallback = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: false,
          stencil: false,
          depth: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false
        });
        fallback.setPixelRatio(window.devicePixelRatio);
        fallback.setSize(canvas.clientWidth, canvas.clientHeight, false);
        return fallback;
      }
    };
  }, [preferWebGPU, setIsWebGPUReady]);

  const applyMappedScene = useCallback(
    (mapped: SceneDocumentBootstrap) => {
      const mappedPatch = toSceneStorePatch(mapped);
      const { entranceId, ...sceneState } = mappedPatch;
      const nextScaleInfo = parseScaleInfo(sceneState.scaleInfo, sceneState.scale);
      setScene({
        ...sceneState,
        scale: nextScaleInfo.value,
        scaleInfo: nextScaleInfo,
      });
      useSceneStore.setState({ entranceId });
    },
    [setScene]
  );

  const bootstrapProjectScene = useCallback(async (): Promise<"version" | "empty"> => {
      const bootstrapResponse = await fetchProjectSceneBootstrap(projectId);
      if (!bootstrapResponse.bootstrap) {
        return "empty";
      }

      if (bootstrapResponse.source === "revision_layout") {
        toast.message("Loaded from the pinned layout revision. Save once to persist this as a project snapshot.");
      }

      applyMappedScene(bootstrapResponse.bootstrap);
      setViewMode("top");
      return "version";
    },
    [applyMappedScene, projectId, setViewMode]
  );

  useEffect(() => {
    const init = async () => {
      resetScene();
      setBootstrapError(null);

      try {
        const project = await loadProject(projectId);
        if (!project) {
          setBootstrapError("This workspace could not be loaded. Check your access or try again.");
          return;
        }

        const source = await bootstrapProjectScene();
        initializeHistory(source === "version" ? "Session start" : "Builder launch");
      } catch (error) {
        console.warn("[project-editor] workspace bootstrap failed:", error);
        setBootstrapError(error instanceof Error ? error.message : "This workspace could not be loaded.");
      } finally {
        setIsInitialLoad(false);
      }
    };
    void init();
  }, [bootstrapProjectScene, initializeHistory, loadProject, projectId, resetScene]);

  const requestViewMode = (mode: EditorViewMode) => {
    if (!hasSceneGeometry) {
      toast.error("No saved room shell yet. Start from the builder first.");
      return;
    }
    const scaleGateMessage = getScaleGateMessage(scale, scaleInfo);
    if (scaleGateMessage) {
      toast.error(scaleGateMessage);
      return;
    }
    setViewMode(mode);
  };

  const triggerZoomControl = useCallback((direction: "in" | "out") => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("plan2space:zoom", { detail: { direction } }));
  }, []);

  const sceneCenter = useMemo(() => {
    const bounds = computeBounds(walls, scale);
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2
    };
  }, [scale, walls]);
  const anchorContext = useMemo(
    () => ({
      walls,
      ceilings,
      scale,
      sceneAssets: assets
    }),
    [assets, ceilings, scale, walls]
  );
  const placedItemKeys = useMemo(
    () => new Set(assets.map((asset) => asset.catalogItemId ?? asset.assetId)),
    [assets]
  );

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );
  const selectedCatalogItem = useMemo(
    () => (selectedAsset ? findCatalogItem(libraryCatalog, selectedAsset) : null),
    [libraryCatalog, selectedAsset]
  );

  const createAssetId = useCallback(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `asset-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const addCatalogItemToScene = useCallback(
    (item: LibraryCatalogItem) => {
      const id = createAssetId();
      const anchoredPlacement = constrainPlacementToAnchor(
        {
          position: [sceneCenter.x, 0, sceneCenter.z],
          rotation: [0, 0, 0],
          anchorType: inferAnchorTypeForCatalogItem(item),
          supportAssetId: null
        },
        anchorContext
      );
      addFurniture({
        id,
        assetId: item.assetId,
        catalogItemId: item.id,
        anchorType: anchoredPlacement.anchorType,
        supportAssetId: anchoredPlacement.supportAssetId,
        supportProfile: item.supportProfile ?? null,
        position: anchoredPlacement.position,
        rotation: anchoredPlacement.rotation,
        scale: item.scale,
        materialId: null
      });
      setSelectedAssetId(id);
      recordSnapshot(`Add ${item.label}`);
      toast.success(`${item.label} added to the room.`);
    },
    [
      addFurniture,
      anchorContext,
      createAssetId,
      recordSnapshot,
      sceneCenter.x,
      sceneCenter.z,
      setSelectedAssetId
    ]
  );

  const addStarterSetToScene = useCallback(() => {
    const selectedItems = selectStarterSetItems(libraryCatalog, STARTER_SET_OFFSETS.length);
    const nextSceneAssets = [...assets];

    selectedItems.slice(0, STARTER_SET_OFFSETS.length).forEach((item, index) => {
      const [offsetX, offsetZ] = STARTER_SET_OFFSETS[index] ?? [0, 0];
      const anchoredPlacement = constrainPlacementToAnchor(
        {
          position: [sceneCenter.x + offsetX, 0, sceneCenter.z + offsetZ],
          rotation: [0, 0, 0],
          anchorType: inferAnchorTypeForCatalogItem(item),
          supportAssetId: null
        },
        {
          ...anchorContext,
          sceneAssets: nextSceneAssets
        }
      );
      const nextAsset = {
        id: createAssetId(),
        assetId: item.assetId,
        catalogItemId: item.id,
        anchorType: anchoredPlacement.anchorType,
        supportAssetId: anchoredPlacement.supportAssetId,
        supportProfile: item.supportProfile ?? null,
        position: anchoredPlacement.position,
        rotation: anchoredPlacement.rotation,
        scale: item.scale,
        materialId: null
      };
      addFurniture(nextAsset);
      nextSceneAssets.push(nextAsset);
    });

    setSelectedAssetId(null);
    recordSnapshot("Add starter set");
    toast.success("Starter set added to the room.");
  }, [
    addFurniture,
    assets,
    anchorContext,
    createAssetId,
    libraryCatalog,
    recordSnapshot,
    sceneCenter.x,
    sceneCenter.z,
    setSelectedAssetId
  ]);

  const updateAssetFromInspector = useCallback(
    (id: string, updates: Parameters<typeof updateFurniture>[1]) => {
      const targetAsset = assets.find((asset) => asset.id === id);
      if (!targetAsset) return;

      const mergedAnchorType = normalizeSceneAnchorType(updates.anchorType ?? targetAsset.anchorType);
      const anchoredPlacement = constrainPlacementToAnchor(
        {
          position: updates.position ?? targetAsset.position,
          rotation: updates.rotation ?? targetAsset.rotation,
          anchorType: mergedAnchorType,
          supportAssetId:
            updates.supportAssetId !== undefined ? updates.supportAssetId : targetAsset.supportAssetId
        },
        {
          ...anchorContext,
          activeAssetId: targetAsset.id
        }
      );

      updateFurniture(id, {
        ...updates,
        anchorType: anchoredPlacement.anchorType,
        supportAssetId: anchoredPlacement.supportAssetId,
        position: anchoredPlacement.position,
        rotation: anchoredPlacement.rotation
      });
      recordSnapshot("Edit asset");
    },
    [anchorContext, assets, recordSnapshot, updateFurniture]
  );

  const removeAssetFromInspector = useCallback(
    (id: string) => {
      removeFurniture(id);
      recordSnapshot("Remove asset");
    },
    [recordSnapshot, removeFurniture]
  );

  const applyWallFinish = useCallback(
    (index: number) => {
      setWallMaterialIndex(index);
      recordSnapshot("Wall finish");
    },
    [recordSnapshot, setWallMaterialIndex]
  );

  const applyFloorFinish = useCallback(
    (index: number) => {
      setFloorMaterialIndex(index);
      recordSnapshot("Floor finish");
    },
    [recordSnapshot, setFloorMaterialIndex]
  );
  const applyLightingSetting = useCallback(
    (updates: Partial<typeof lighting>) => {
      setLighting(updates);
    },
    [setLighting]
  );
  const commitLightingSetting = useCallback(() => {
    recordSnapshot("Lighting");
  }, [recordSnapshot]);

  const hasSceneGeometry = walls.length > 0 || floors.length > 0;
  const canEnter3D = hasSceneGeometry && !getScaleGateMessage(scale, scaleInfo);
  const isSceneVisible = hasSceneGeometry && (viewMode === "top" || viewMode === "walk");
  const showLaunchState = !hasSceneGeometry;
  const isTopEditorVisible = isSceneVisible && viewMode === "top";
  const launchMetrics = [
    { label: "Entry", value: "Builder" },
    { label: "Library", value: `${libraryCatalog.length} items` },
    { label: "Finishes", value: `${builderWallFinishes.length + builderFloorFinishes.length} presets` }
  ];
  const launchPreviewItems = featuredLibraryCatalog.slice(0, 3);
  const headerTitle = currentProject?.name || (isSceneVisible ? "Live Room Editing" : hasSceneGeometry ? "Top View Ready" : "Room shell missing");
  const canUndo = versionHistory.currentIndex > 0;
  const canRedo = versionHistory.currentIndex >= 0 && versionHistory.currentIndex < versionHistory.snapshots.length - 1;

  const savePayload = useMemo(
    () => ({
      topology: {
        scale,
        scaleInfo,
        walls,
        openings,
        floors
      },
      roomShell: {
        scale,
        scaleInfo,
        walls,
        openings,
        floors,
        ceilings,
        rooms,
        cameraAnchors,
        navGraph,
        entranceId
      },
      assets,
      materials: {
        wallIndex: wallMaterialIndex,
        floorIndex: floorMaterialIndex
      },
      lighting,
      assetSummary: buildProjectAssetSummary(libraryCatalog, assets)
    }),
    [
      assets,
      cameraAnchors,
      ceilings,
      entranceId,
      floorMaterialIndex,
      floors,
      libraryCatalog,
      lighting,
      navGraph,
      openings,
      rooms,
      scale,
      scaleInfo,
      wallMaterialIndex,
      walls
    ]
  );
  const saveSignature = useMemo(() => JSON.stringify(savePayload), [savePayload]);
  const {
    isDirty,
    isSaving,
    saveError,
    lastSavedAt,
    triggerManualSave
  } = useEditorSaveSession({
    projectId,
    payload: savePayload,
    signature: saveSignature,
    ready: !isInitialLoad,
    autosaveDelayMs: 2500
  });
  const mobileStatusText = isSaving
    ? "Saving..."
    : saveError
      ? "Save failed"
      : isDirty
        ? "Unsaved changes"
        : lastSavedAt
          ? "Saved"
          : "Ready";
  useEffect(() => {
    if (!isSceneVisible || isTopEditorVisible) return;
    setPanels({ assets: false, properties: false });
    setTransformMode("translate");
    setIsTransforming(false);
  }, [isSceneVisible, isTopEditorVisible, setIsTransforming, setPanels, setTransformMode]);

  if (isInitialLoad) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#e7e4de]">
        <div className="text-[#6f665c] text-[10px] font-bold uppercase tracking-[0.5em] animate-pulse">
          Synchronizing Workspace...
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e7e4de] px-4 text-[#1f1b16]">
        <div className="w-full max-w-2xl rounded-[32px] border border-black/10 bg-white/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.16)] backdrop-blur">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#8f7a62]">Workspace unavailable</div>
          <h1 className="mt-5 text-4xl font-cormorant font-light">This project did not load correctly.</h1>
          <p className="mt-4 text-sm leading-7 text-[#5b5348]">{bootstrapError}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center justify-center rounded-full bg-[#1f1b16] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white transition hover:bg-[#2b261f]"
            >
              Retry Workspace
            </button>
            <button
              type="button"
              onClick={() => router.push("/studio")}
              className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#473f35] transition hover:border-black/25 hover:bg-[#f6f4ef]"
            >
              Back to Studio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#e7e4de] text-[#1f1b16]">

      <ProjectEditorHeader
        title={headerTitle}
        viewMode={viewMode}
        onBack={() => router.push("/studio")}
        onOpenShare={() => setIsShareOpen(true)}
        onSave={() => {
          void triggerManualSave();
        }}
        isSaving={isSaving}
        isDirty={isDirty}
        saveError={saveError}
        lastSavedAt={lastSavedAt}
      />

      {/* Primary Workspace */}
      <div className="relative h-screen w-full overflow-hidden px-3 pb-24 pt-20 sm:px-6 sm:pb-24 sm:pt-24 lg:px-12">
        <AnimatePresence mode="popLayout" initial={false}>
          {/* Step 1: Builder launch */}
          {showLaunchState ? (
            <BuilderLaunchState
              metrics={launchMetrics}
              previewItems={launchPreviewItems}
              onOpenBuilder={() => router.push("/studio/builder")}
              onBrowseStudio={() => router.push("/studio")}
            />
          ) : null}

          {/* Step 4: 3D Workspace */}
          {isSceneVisible && (
            <motion.div
              key="workspace_state"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="relative h-full w-full overflow-hidden rounded-[22px] border border-black/10 bg-[#d8d8d6] shadow-[0_20px_54px_rgba(16,18,22,0.2)] sm:rounded-[30px]"
            >
              {isTopEditorVisible && (
                <>
                  <MobileEditorControls
                    visible={isTopEditorVisible}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onToggleLibrary={() => togglePanel("assets")}
                    onToggleInspector={() => togglePanel("properties")}
                    onUndo={undo}
                    onRedo={redo}
                  />

                  <aside
                    className={`absolute inset-y-3 left-3 z-[30] flex w-[min(86vw,360px)] flex-col rounded-[28px] border border-black/10 bg-[#f7f5f1]/95 shadow-[0_18px_44px_rgba(17,19,22,0.18)] backdrop-blur-xl transition-all duration-300 xl:inset-y-5 xl:left-5 ${
                      panels.assets ? "translate-x-0 opacity-100" : "-translate-x-[108%] opacity-0 pointer-events-none"
                    }`}
                  >
                    <BuilderLibraryShelf
                      items={filteredLibraryCatalog}
                      featuredItems={featuredLibraryCatalog}
                      spotlightItem={librarySpotlightItem}
                      categories={libraryCategories}
                      query={libraryQuery}
                      activeCategory={libraryCategory}
                      catalogCount={libraryCatalog.length}
                      assetCount={assets.length}
                      hasActiveFilters={libraryHasActiveFilters}
                      placedItemKeys={placedItemKeys}
                      onQueryChange={setLibraryQuery}
                      onCategoryChange={setLibraryCategory}
                      onAddStarterSet={addStarterSetToScene}
                      onAddItem={addCatalogItemToScene}
                    />
                  </aside>
                  {!panels.assets ? (
                    <button
                      type="button"
                      onClick={() => togglePanel("assets")}
                      className="absolute left-2 top-1/2 z-[24] hidden -translate-y-1/2 items-center gap-2 rounded-r-full border border-black/10 bg-white/92 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#51483f] shadow-[0_10px_24px_rgba(19,21,24,0.14)] transition hover:bg-[#f4efe7] xl:inline-flex"
                    >
                      <PanelLeft className="h-4 w-4" />
                      Library
                    </button>
                  ) : null}

                  <BuilderInspectorPanel
                    visible={panels.properties}
                    transformMode={transformMode}
                    wallMaterialIndex={wallMaterialIndex}
                    floorMaterialIndex={floorMaterialIndex}
                    lighting={lighting}
                    wallsCount={walls.length}
                    floorsCount={floors.length}
                    assetsCount={assets.length}
                    selectedAsset={selectedAsset}
                    selectedAssetMeta={selectedCatalogItem}
                    onTransformModeChange={setTransformMode}
                    onWallMaterialChange={applyWallFinish}
                    onFloorMaterialChange={applyFloorFinish}
                    onLightingChange={applyLightingSetting}
                    onLightingCommit={commitLightingSetting}
                    onUpdateAsset={updateAssetFromInspector}
                    onRemoveAsset={removeAssetFromInspector}
                    formatAssetLabel={formatAssetIdLabel}
                  />
                  {!panels.properties ? (
                    <button
                      type="button"
                      onClick={() => togglePanel("properties")}
                      className="absolute right-2 top-1/2 z-[24] hidden -translate-y-1/2 items-center gap-2 rounded-l-full border border-black/10 bg-white/92 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#51483f] shadow-[0_10px_24px_rgba(19,21,24,0.14)] transition hover:bg-[#f4efe7] xl:inline-flex"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Inspector
                    </button>
                  ) : null}
                </>
              )}

              <SceneViewport
                className="rounded-none border-0 shadow-none"
                gl={
                  createRenderer ?? {
                    antialias: true,
                    alpha: false,
                    stencil: false,
                    depth: true,
                    powerPreference: "high-performance",
                    preserveDrawingBuffer: false
                  }
                }
                camera={{ fov: 40, position: [0, 10, 20] }}
                toneMappingExposure={1.1}
                includeEditorTools
                chromeTone="light"
              />

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isSceneVisible ? (
        <div className="pointer-events-none fixed inset-x-3 bottom-4 z-[100] flex items-end justify-between gap-3 sm:inset-x-8 sm:bottom-8">
          <div className="pointer-events-auto hidden rounded-full border border-black/10 bg-white/92 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6a6258] shadow-[0_12px_28px_rgba(19,21,24,0.14)] backdrop-blur-xl lg:inline-flex lg:items-center lg:gap-3">
            <span>{isTopEditorVisible ? "Editing mode" : "Walkthrough mode"}</span>
            <span className="h-3 w-px bg-black/15" />
            <span>{mobileStatusText}</span>
            <span className="h-3 w-px bg-black/15" />
            <AssetCountBadge />
          </div>

          <div className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-[28px] border border-black/10 bg-white/95 px-3 py-2 shadow-[0_16px_34px_rgba(16,18,22,0.18)] backdrop-blur-xl sm:gap-3 sm:px-4">
            <div className="hidden min-w-[72px] pl-1 sm:block">
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8a8177]">Camera</div>
              <div className="mt-1 text-[11px] font-medium text-[#5b5248]">
                {viewMode === "top" ? "Planner view" : "Walkthrough"}
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-[#f6f1e9] p-1">
              <button
                type="button"
                onClick={() => requestViewMode("top")}
                className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition sm:px-4 ${
                  viewMode === "top"
                    ? "bg-[#1f1b16] text-white shadow-[0_10px_20px_rgba(16,18,22,0.16)]"
                    : "text-[#4d453a] hover:bg-white"
                }`}
              >
                Top view
              </button>
              <button
                type="button"
                onClick={() => requestViewMode("walk")}
                disabled={!canEnter3D}
                className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition sm:px-4 ${
                  viewMode === "walk"
                    ? "bg-[#1f1b16] text-white shadow-[0_10px_20px_rgba(16,18,22,0.16)]"
                    : "text-[#4d453a] hover:bg-white disabled:cursor-not-allowed disabled:text-[#b0a79c] disabled:hover:bg-transparent"
                }`}
              >
                Walk
              </button>
            </div>
            {isTopEditorVisible ? (
              <>
                <span className="mx-0.5 h-8 w-px bg-black/10" />
                <div className="flex items-center gap-1 rounded-full bg-[#f6f1e9] p-1">
                  <button
                    type="button"
                    onClick={() => togglePanel("assets")}
                    className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition sm:px-4 ${
                      panels.assets ? "bg-white text-[#1f1b16]" : "text-[#4d453a] hover:bg-white"
                    }`}
                  >
                    Library
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePanel("properties")}
                    className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition sm:px-4 ${
                      panels.properties ? "bg-white text-[#1f1b16]" : "text-[#4d453a] hover:bg-white"
                    }`}
                  >
                    Inspector
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransformMode("translate")}
                    className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition sm:px-4 ${
                      transformMode === "translate" ? "bg-white text-[#1f1b16]" : "text-[#4d453a] hover:bg-white"
                    }`}
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransformMode("rotate")}
                    className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition sm:px-4 ${
                      transformMode === "rotate" ? "bg-white text-[#1f1b16]" : "text-[#4d453a] hover:bg-white"
                    }`}
                  >
                    Rotate
                  </button>
                  <button
                    type="button"
                    onClick={undo}
                    disabled={!canUndo}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4d453a] transition hover:bg-white disabled:cursor-not-allowed disabled:text-[#b0a79c] disabled:hover:bg-transparent sm:px-4"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={!canRedo}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4d453a] transition hover:bg-white disabled:cursor-not-allowed disabled:text-[#b0a79c] disabled:hover:bg-transparent sm:px-4"
                  >
                    <Redo2 className="h-3.5 w-3.5" />
                    Redo
                  </button>
                </div>
              </>
            ) : null}
            <span className="mx-0.5 h-8 w-px bg-black/10" />
            <div className="flex items-center gap-1 rounded-full bg-[#f6f1e9] p-1">
              <button
                type="button"
                onClick={() => triggerZoomControl("in")}
                className="rounded-full px-3 py-2 text-[11px] font-bold text-[#4d453a] transition hover:bg-white sm:px-4"
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => triggerZoomControl("out")}
                className="rounded-full px-3 py-2 text-[11px] font-bold text-[#4d453a] transition hover:bg-white sm:px-4"
                aria-label="Zoom out"
              >
                -
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              router.push("/studio");
            }}
            className="pointer-events-auto rounded-full border border-black/10 bg-white/92 p-3 shadow-[0_12px_28px_rgba(19,21,24,0.14)] backdrop-blur-xl transition hover:border-red-400/40 hover:bg-red-50"
            aria-label="Leave editor"
          >
            <RotateCcw className="h-5 w-5 text-[#4a4338] transition-colors hover:text-red-600" />
          </button>
        </div>
      ) : null}

      <ShareModal
        projectId={projectId}
        project={currentProject}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </div >
  );
}

function AssetCountBadge() {
  const assetsCount = useSceneStore((state) => state.assets.length);
  return (
    <span className="text-[10px] font-bold text-[#6a6258] uppercase tracking-[0.1em]">
      Assets: {assetsCount}
    </span>
  );
}
