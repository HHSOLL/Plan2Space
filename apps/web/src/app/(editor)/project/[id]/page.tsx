"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { LandingHeroCanvas } from "../../../../components/landing/landing-hero-canvas";
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
import { Play, Box, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { getScaleGateMessage, parseScaleInfo } from "../../../../lib/ai/scaleInfo";
import { fetchLatestProjectVersion } from "../../../../lib/api/project";
import {
  buildProjectAssetSummary,
  findCatalogItem,
  formatAssetIdLabel,
  selectStarterSetItems,
  type LibraryCatalogItem
} from "../../../../lib/builder/catalog";
import { builderFloorFinishes, builderWallFinishes } from "../../../../lib/builder/templates";
import {
  mapProjectVersionToScene,
  type MappedSceneResult
} from "../../../../features/floorplan/result-mapper";

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
  const assets = useSceneStore((state) => state.assets);
  const scale = useSceneStore((state) => state.scale);
  const scaleInfo = useSceneStore((state) => state.scaleInfo);
  const wallMaterialIndex = useSceneStore((state) => state.wallMaterialIndex);
  const floorMaterialIndex = useSceneStore((state) => state.floorMaterialIndex);
  const selectedAssetId = useSceneStore((state) => state.selectedAssetId);
  const setWallMaterialIndex = useSceneStore((state) => state.setWallMaterialIndex);
  const setFloorMaterialIndex = useSceneStore((state) => state.setFloorMaterialIndex);
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
    (mapped: MappedSceneResult) => {
      const nextScaleInfo = parseScaleInfo(mapped.scaleInfo, mapped.scale);
      setScene({
        scale: nextScaleInfo.value,
        scaleInfo: nextScaleInfo,
        walls: mapped.walls,
        openings: mapped.openings,
        floors: mapped.floors,
        ceilings: mapped.ceilings,
        rooms: mapped.rooms,
        cameraAnchors: mapped.cameraAnchors,
        navGraph: mapped.navGraph,
        assets: mapped.assets,
        wallMaterialIndex: mapped.wallMaterialIndex,
        floorMaterialIndex: mapped.floorMaterialIndex
      });
      useSceneStore.setState({ entranceId: mapped.entranceId });
    },
    [setScene]
  );

  const bootstrapProjectScene = useCallback(async (): Promise<"version" | "empty"> => {
      const latestVersionResponse = await fetchLatestProjectVersion(projectId);
      if (!latestVersionResponse.version) {
        return "empty";
      }

      if (typeof latestVersionResponse.version !== "object") {
        throw new Error("Saved room data is invalid.");
      }

      const mapped = mapProjectVersionToScene(latestVersionResponse.version as Record<string, unknown>);
      if (!mapped) {
        throw new Error("Saved room data could not be restored.");
      }

      applyMappedScene(mapped);
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

  const sceneCenter = useMemo(() => {
    const bounds = computeBounds(walls, scale);
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2
    };
  }, [scale, walls]);
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
      addFurniture({
        id,
        assetId: item.assetId,
        catalogItemId: item.id,
        position: [sceneCenter.x, 0, sceneCenter.z],
        rotation: [0, 0, 0],
        scale: item.scale,
        materialId: null
      });
      setSelectedAssetId(id);
      recordSnapshot(`Add ${item.label}`);
      toast.success(`${item.label} added to the room.`);
    },
    [addFurniture, createAssetId, recordSnapshot, sceneCenter.x, sceneCenter.z, setSelectedAssetId]
  );

  const addStarterSetToScene = useCallback(() => {
    const selectedItems = selectStarterSetItems(libraryCatalog, STARTER_SET_OFFSETS.length);

    selectedItems.slice(0, STARTER_SET_OFFSETS.length).forEach((item, index) => {
      const [offsetX, offsetZ] = STARTER_SET_OFFSETS[index] ?? [0, 0];
      addFurniture({
        id: createAssetId(),
        assetId: item.assetId,
        catalogItemId: item.id,
        position: [sceneCenter.x + offsetX, 0, sceneCenter.z + offsetZ],
        rotation: [0, 0, 0],
        scale: item.scale,
        materialId: null
      });
    });

    setSelectedAssetId(null);
    recordSnapshot("Add starter set");
    toast.success("Starter set added to the room.");
  }, [addFurniture, createAssetId, libraryCatalog, recordSnapshot, sceneCenter.x, sceneCenter.z, setSelectedAssetId]);

  const updateAssetFromInspector = useCallback(
    (id: string, updates: Parameters<typeof updateFurniture>[1]) => {
      updateFurniture(id, updates);
      recordSnapshot("Edit asset");
    },
    [recordSnapshot, updateFurniture]
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

  const hasSceneGeometry = walls.length > 0 || floors.length > 0;
  const canEnter3D = hasSceneGeometry && !getScaleGateMessage(scale, scaleInfo);
  const isSceneVisible = hasSceneGeometry && (viewMode === "top" || viewMode === "walk");
  const showLaunchState = !isSceneVisible;
  const isTopEditorVisible = isSceneVisible && viewMode === "top";
  const editorModes = [
    { id: "top", icon: Box, label: "3D Edit", enabled: canEnter3D },
    { id: "walk", icon: Play, label: "Walkthrough", enabled: canEnter3D }
  ];
  const launchMetrics = [
    { label: "Entry", value: "Builder" },
    { label: "Library", value: `${libraryCatalog.length} items` },
    { label: "Finishes", value: `${builderWallFinishes.length + builderFloorFinishes.length} presets` }
  ];
  const launchPreviewItems = featuredLibraryCatalog.slice(0, 3);
  const headerTitle = currentProject?.name || (isSceneVisible ? "Live Room Editing" : hasSceneGeometry ? "Top View Ready" : "Builder Launchpad");
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
      assets,
      materials: {
        wallIndex: wallMaterialIndex,
        floorIndex: floorMaterialIndex
      },
      assetSummary: buildProjectAssetSummary(libraryCatalog, assets)
    }),
    [assets, floorMaterialIndex, floors, libraryCatalog, openings, scale, scaleInfo, wallMaterialIndex, walls]
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
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0b]">
        <div className="text-white/20 text-[10px] font-bold uppercase tracking-[0.5em] animate-pulse">
          Synchronizing Workspace...
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] px-4 text-white">
        <div className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#d8baa0]">Workspace unavailable</div>
          <h1 className="mt-5 text-4xl font-cormorant font-light">This project did not load correctly.</h1>
          <p className="mt-4 text-sm leading-7 text-white/65">{bootstrapError}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-black transition hover:bg-white/90"
            >
              Retry Workspace
            </button>
            <button
              type="button"
              onClick={() => router.push("/studio")}
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white/75 transition hover:border-white/30 hover:bg-white/10"
            >
              Back to Studio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0a0a0b] text-white">
      {/* Background Ambience for 2D modes */}
      {!isSceneVisible && <LandingHeroCanvas onAction={() => { }} />}

      <ProjectEditorHeader
        title={headerTitle}
        viewMode={viewMode}
        modes={editorModes}
        panels={panels}
        transformMode={transformMode}
        isTopEditorVisible={isTopEditorVisible}
        onBack={() => router.push("/studio")}
        onTogglePanel={togglePanel}
        onTransformModeChange={setTransformMode}
        onViewModeChange={requestViewMode}
        onOpenShare={() => setIsShareOpen(true)}
        onSave={() => {
          void triggerManualSave();
        }}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        isSaving={isSaving}
        isDirty={isDirty}
        saveError={saveError}
        lastSavedAt={lastSavedAt}
      />

      {/* Primary Workspace */}
      <div className="relative w-full h-screen overflow-hidden pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-6 lg:px-12">
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
              className="relative w-full h-full rounded-[20px] sm:rounded-[48px] overflow-hidden bg-[#050505] shadow-3xl border border-white/5 border-b-0"
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
                    className={`absolute inset-y-3 left-3 z-[30] flex w-[min(86vw,320px)] flex-col rounded-[28px] border border-white/10 bg-black/50 backdrop-blur-2xl transition-all duration-300 xl:inset-y-5 xl:left-5 ${
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

                  <BuilderInspectorPanel
                    visible={panels.properties}
                    transformMode={transformMode}
                    wallMaterialIndex={wallMaterialIndex}
                    floorMaterialIndex={floorMaterialIndex}
                    wallsCount={walls.length}
                    floorsCount={floors.length}
                    assetsCount={assets.length}
                    selectedAsset={selectedAsset}
                    selectedAssetMeta={selectedCatalogItem}
                    onTransformModeChange={setTransformMode}
                    onWallMaterialChange={applyWallFinish}
                    onFloorMaterialChange={applyFloorFinish}
                    onUpdateAsset={updateAssetFromInspector}
                    onRemoveAsset={removeAssetFromInspector}
                    formatAssetLabel={formatAssetIdLabel}
                  />
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
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status Bar */}
      <div className="fixed bottom-4 sm:bottom-12 inset-x-3 sm:inset-x-12 z-[100] flex items-center justify-between pointer-events-none gap-2">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-4 pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
          <span className="text-[9px] sm:text-[10px] font-bold text-white/60 tracking-[0.15em] sm:tracking-[0.2em] uppercase">Studio Online</span>
          <div className="hidden sm:block w-px h-4 bg-white/10" />
          <div className="hidden sm:block">
            <AssetCountBadge />
          </div>
          <div className="sm:hidden text-[9px] font-bold uppercase tracking-[0.15em] text-white/45">
            {mobileStatusText}
          </div>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={() => {
              resetScene();
              router.push("/studio");
            }}
            className="p-3 sm:p-4 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full hover:bg-red-500/10 hover:border-red-500/20 group transition-all"
          >
            <RotateCcw className="w-5 h-5 text-white/30 group-hover:text-red-500 transition-colors" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.03),transparent_50%)]" />
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
    <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.1em]">
      Assets: {assetsCount}
    </span>
  );
}
