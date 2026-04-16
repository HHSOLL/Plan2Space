"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { BuilderLibraryShelf } from "../../../../components/editor/BuilderLibraryShelf";
import {
  useEditorStore,
  type EditorViewMode
} from "../../../../lib/stores/useEditorStore";
import { useProjectStore } from "../../../../lib/stores/useProjectStore";
import {
  useAssetStore,
  useCameraStore,
  usePublishStore,
  useSelectionStore,
  useShellStore
} from "../../../../lib/stores/scene-slices";
import { motion, AnimatePresence } from "framer-motion";
import { BuilderInspectorPanel } from "../../../../components/editor/BuilderInspectorPanel";
import { BuilderLaunchState } from "../../../../components/editor/BuilderLaunchState";
import { MobileEditorControls } from "../../../../components/editor/MobileEditorControls";
import { ProjectEditorViewport } from "../../../../components/editor/ProjectEditorViewport";
import { ProjectEditorHeader } from "../../../../components/editor/ProjectEditorHeader";
import { ShareModal } from "../../../../components/editor/ShareModal";
import { useAssetCatalog } from "../../../../components/editor/useAssetCatalog";
import { useEditorSaveSession } from "../../../../components/editor/useEditorSaveSession";
import { StudioWorkspacePanel } from "../../../../components/layout/StudioWorkspaceShell";
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
  toCatalogProductSnapshot,
  type LibraryCatalogItem
} from "../../../../lib/builder/catalog";
import { builderFloorFinishes, builderWallFinishes } from "../../../../lib/builder/templates";
import {
  toSceneStorePatch,
  type SceneDocumentBootstrap
} from "../../../../lib/domain/scene-document";
import { constrainPlacementToAnchor, inferAnchorTypeForCatalogItem } from "../../../../lib/scene/anchors";
import { normalizeSceneAnchorType } from "../../../../lib/scene/anchor-types";
import { getLightingPreset, type LightingPresetId } from "../../../../lib/scene/lighting-presets";

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
  const resetShellState = useEditorStore((state) => state.resetShellState);
  const transformMode = useEditorStore((state) => state.transformMode);
  const transformSpace = useEditorStore((state) => state.transformSpace);
  const setIsTransforming = useEditorStore((state) => state.setIsTransforming);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const setTransformSpace = useEditorStore((state) => state.setTransformSpace);
  const {
    walls,
    openings,
    floors,
    ceilings,
    rooms,
    cameraAnchors,
    navGraph,
    scale,
    scaleInfo,
    wallMaterialIndex,
    floorMaterialIndex,
    lighting,
    setWallMaterialIndex,
    setFloorMaterialIndex,
    setLighting,
    setScene,
    resetScene
  } = useShellStore();
  const { assets, addFurniture, updateFurniture, removeFurniture } = useAssetStore();
  const { selectedAssetId, setSelectedAssetId } = useSelectionStore();
  const { entranceId, setEntranceId } = useCameraStore();
  const { versionHistory, initializeHistory, recordSnapshot, undo, redo } = usePublishStore();
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
        ? { assets: true, properties: false }
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
          throw new Error("현재 환경에서는 WebGPU 비동기 초기화를 지원하지 않습니다.");
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
      setEntranceId(entranceId);
    },
    [setEntranceId, setScene]
  );

  const bootstrapProjectScene = useCallback(async (): Promise<"version" | "empty"> => {
      const bootstrapResponse = await fetchProjectSceneBootstrap(projectId);
      if (!bootstrapResponse.bootstrap) {
        return "empty";
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
          setBootstrapError("작업 공간을 불러오지 못했습니다. 접근 권한을 확인하거나 다시 시도해 주세요.");
          return;
        }

        const source = await bootstrapProjectScene();
        initializeHistory(source === "version" ? "세션 시작" : "빌더 시작");
      } catch (error) {
        console.warn("[project-editor] workspace bootstrap failed:", error);
        setBootstrapError(error instanceof Error ? error.message : "작업 공간을 불러오지 못했습니다.");
      } finally {
        setIsInitialLoad(false);
      }
    };
    void init();
  }, [bootstrapProjectScene, initializeHistory, loadProject, projectId, resetScene]);

  const requestViewMode = (mode: EditorViewMode) => {
    if (!hasSceneGeometry) {
      toast.error("저장된 공간 껍데기가 없습니다. 빌더에서 먼저 생성해 주세요.");
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
      const productSnapshot = toCatalogProductSnapshot(item);
      const supportProfile = item.supportProfile ?? null;
      const inferredAnchorType = inferAnchorTypeForCatalogItem(item);
      const anchoredPlacement = constrainPlacementToAnchor(
        {
          position: [sceneCenter.x, 0, sceneCenter.z],
          rotation: [0, 0, 0],
          anchorType: inferredAnchorType,
          supportAssetId: null
        },
        {
          ...anchorContext,
          activeAsset: {
            id,
            assetId: item.assetId,
            catalogItemId: item.id,
            product: productSnapshot,
            supportProfile,
            scale: item.scale
          }
        }
      );
      addFurniture({
        id,
        assetId: item.assetId,
        catalogItemId: item.id,
        product: productSnapshot,
        anchorType: anchoredPlacement.anchorType,
        supportAssetId: anchoredPlacement.supportAssetId,
        supportProfile,
        position: anchoredPlacement.position,
        rotation: anchoredPlacement.rotation,
        scale: item.scale,
        materialId: null
      });
      setSelectedAssetId(id);
      recordSnapshot(`제품 추가: ${item.label}`);
      toast.success(`${item.label} 제품을 추가했습니다.`);
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
      const id = createAssetId();
      const productSnapshot = toCatalogProductSnapshot(item);
      const supportProfile = item.supportProfile ?? null;
      const inferredAnchorType = inferAnchorTypeForCatalogItem(item);
      const anchoredPlacement = constrainPlacementToAnchor(
        {
          position: [sceneCenter.x + offsetX, 0, sceneCenter.z + offsetZ],
          rotation: [0, 0, 0],
          anchorType: inferredAnchorType,
          supportAssetId: null
        },
        {
          ...anchorContext,
          sceneAssets: nextSceneAssets,
          activeAsset: {
            id,
            assetId: item.assetId,
            catalogItemId: item.id,
            product: productSnapshot,
            supportProfile,
            scale: item.scale
          }
        }
      );
      const nextAsset = {
        id,
        assetId: item.assetId,
        catalogItemId: item.id,
        product: productSnapshot,
        anchorType: anchoredPlacement.anchorType,
        supportAssetId: anchoredPlacement.supportAssetId,
        supportProfile,
        position: anchoredPlacement.position,
        rotation: anchoredPlacement.rotation,
        scale: item.scale,
        materialId: null
      };
      addFurniture(nextAsset);
      nextSceneAssets.push(nextAsset);
    });

    setSelectedAssetId(null);
    recordSnapshot("추천 세트 추가");
    toast.success("추천 배치 세트를 추가했습니다.");
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
      recordSnapshot("제품 편집");
    },
    [anchorContext, assets, recordSnapshot, updateFurniture]
  );

  const removeAssetFromInspector = useCallback(
    (id: string) => {
      removeFurniture(id);
      recordSnapshot("제품 삭제");
    },
    [recordSnapshot, removeFurniture]
  );

  const applyWallFinish = useCallback(
    (index: number) => {
      setWallMaterialIndex(index);
      recordSnapshot("벽 마감 변경");
    },
    [recordSnapshot, setWallMaterialIndex]
  );

  const applyFloorFinish = useCallback(
    (index: number) => {
      setFloorMaterialIndex(index);
      recordSnapshot("바닥 마감 변경");
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
    recordSnapshot("조명 변경");
  }, [recordSnapshot]);
  const applyLightingPreset = useCallback(
    (presetId: LightingPresetId) => {
      const preset = getLightingPreset(presetId);
      if (!preset) return;
      setLighting(preset.settings);
      recordSnapshot(`조명 프리셋 변경: ${preset.label}`);
    },
    [recordSnapshot, setLighting]
  );

  const hasSceneGeometry = walls.length > 0 || floors.length > 0;
  const canEnter3D = hasSceneGeometry && !getScaleGateMessage(scale, scaleInfo);
  const isSceneVisible = hasSceneGeometry && (viewMode === "top" || viewMode === "walk");
  const showLaunchState = !hasSceneGeometry;
  const isTopEditorVisible = isSceneVisible && viewMode === "top";
  const launchMetrics = [
    { label: "진입", value: "빌더" },
    { label: "제품 목록", value: `${libraryCatalog.length}개` },
    { label: "마감 프리셋", value: `${builderWallFinishes.length + builderFloorFinishes.length}개` }
  ];
  const launchPreviewItems = featuredLibraryCatalog.slice(0, 3);
  const headerTitle = currentProject?.name || (isSceneVisible ? "공간 편집 중" : hasSceneGeometry ? "상단뷰 준비 완료" : "공간 껍데기 필요");
  const canUndo = versionHistory.currentIndex > 0;
  const canRedo = versionHistory.currentIndex >= 0 && versionHistory.currentIndex < versionHistory.snapshots.length - 1;

  const savePayload = useMemo(
    () => ({
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
  useEffect(() => {
    if (!isSceneVisible || isTopEditorVisible) return;
    setPanels({ assets: false, properties: false });
    setTransformMode("translate");
    setTransformSpace("world");
    setIsTransforming(false);
  }, [
    isSceneVisible,
    isTopEditorVisible,
    setIsTransforming,
    setPanels,
    setTransformMode,
    setTransformSpace
  ]);

  const showAssetPanel = panels.assets || !panels.properties;
  const activateAssetPanel = () => setPanels({ assets: true, properties: false });
  const activateInspectorPanel = () => setPanels({ assets: false, properties: true });
  const toggleAssetPanel = () => {
    if (panels.assets && !panels.properties) {
      setPanels({ assets: false, properties: false });
      return;
    }
    activateAssetPanel();
  };
  const toggleInspectorPanel = () => {
    if (panels.properties && !panels.assets) {
      setPanels({ assets: false, properties: false });
      return;
    }
    activateInspectorPanel();
  };

  if (isInitialLoad) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#e7e4de]">
        <div className="text-[#6f665c] text-[10px] font-bold uppercase tracking-[0.5em] animate-pulse">
          작업 공간 동기화 중...
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e7e4de] px-4 text-[#1f1b16]">
        <div className="w-full max-w-2xl rounded-[32px] border border-black/10 bg-white/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.16)] backdrop-blur">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#8f7a62]">작업 공간 오류</div>
          <h1 className="mt-5 text-4xl font-light">프로젝트를 정상적으로 불러오지 못했습니다.</h1>
          <p className="mt-4 text-sm leading-7 text-[#5b5348]">{bootstrapError}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center justify-center rounded-full bg-[#1f1b16] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white transition hover:bg-[#2b261f]"
            >
              작업 공간 다시 시도
            </button>
            <button
              type="button"
              onClick={() => router.push("/studio")}
              className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#473f35] transition hover:border-black/25 hover:bg-[#f6f4ef]"
            >
              스튜디오로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#efefec] text-[#1f1b16]">
      <ProjectEditorHeader
        title={headerTitle}
        viewMode={viewMode}
        canShowPanels={isTopEditorVisible}
        activePanel={showAssetPanel ? "assets" : "properties"}
        onBack={() => router.push("/studio")}
        onShowAssets={activateAssetPanel}
        onShowInspector={activateInspectorPanel}
        onOpenShare={() => setIsShareOpen(true)}
        onSave={() => {
          void triggerManualSave();
        }}
        isSaving={isSaving}
        isDirty={isDirty}
        saveError={saveError}
        lastSavedAt={lastSavedAt}
      />

      <div className="relative h-screen w-full overflow-hidden px-2 pb-20 pt-12 sm:px-3 sm:pb-16 xl:px-4">
        <AnimatePresence mode="popLayout" initial={false}>
          {showLaunchState ? (
            <BuilderLaunchState
              metrics={launchMetrics}
              previewItems={launchPreviewItems}
              onOpenBuilder={() => router.push("/studio/builder")}
              onBrowseStudio={() => router.push("/studio")}
            />
          ) : null}

          {isSceneVisible && (
            <motion.div
              key="workspace_state"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="h-full w-full"
            >
              <div className="flex h-full min-h-0 w-full gap-3 xl:gap-3">
                {isTopEditorVisible ? (
                  <StudioWorkspacePanel className="hidden h-full w-[332px] shrink-0 overflow-hidden !rounded-[24px] !border-black/10 !shadow-none xl:flex xl:flex-col">
                    <div className="min-h-0 flex-1 overflow-y-auto">
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
                    </div>
                  </StudioWorkspacePanel>
                ) : null}

                <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden p2s-workspace-viewport">
                  {isTopEditorVisible && (
                    <>
                      <MobileEditorControls
                        visible={isTopEditorVisible}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        onToggleLibrary={toggleAssetPanel}
                        onToggleInspector={toggleInspectorPanel}
                        onUndo={undo}
                        onRedo={redo}
                      />

                      <StudioWorkspacePanel
                        className={`absolute inset-y-3 left-3 z-[30] flex w-[min(86vw,368px)] flex-col overflow-hidden rounded-[24px] border border-black/10 bg-white/96 shadow-[0_18px_44px_rgba(17,19,22,0.14)] transition-all duration-300 xl:hidden ${
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
                      </StudioWorkspacePanel>

                      <BuilderInspectorPanel
                        visible={panels.properties}
                        className="xl:hidden"
                        transformMode={transformMode}
                        transformSpace={transformSpace}
                        wallMaterialIndex={wallMaterialIndex}
                        floorMaterialIndex={floorMaterialIndex}
                        lighting={lighting}
                        wallsCount={walls.length}
                        floorsCount={floors.length}
                        assetsCount={assets.length}
                        selectedAsset={selectedAsset}
                        selectedAssetMeta={selectedCatalogItem}
                        onTransformModeChange={setTransformMode}
                        onTransformSpaceChange={setTransformSpace}
                        onWallMaterialChange={applyWallFinish}
                        onFloorMaterialChange={applyFloorFinish}
                        onLightingChange={applyLightingSetting}
                        onLightingCommit={commitLightingSetting}
                        onApplyLightingPreset={applyLightingPreset}
                        onUpdateAsset={updateAssetFromInspector}
                        onRemoveAsset={removeAssetFromInspector}
                        formatAssetLabel={formatAssetIdLabel}
                      />

                      <BuilderInspectorPanel
                        visible={panels.properties}
                        className="hidden xl:flex xl:w-[304px]"
                        transformMode={transformMode}
                        transformSpace={transformSpace}
                        wallMaterialIndex={wallMaterialIndex}
                        floorMaterialIndex={floorMaterialIndex}
                        lighting={lighting}
                        wallsCount={walls.length}
                        floorsCount={floors.length}
                        assetsCount={assets.length}
                        selectedAsset={selectedAsset}
                        selectedAssetMeta={selectedCatalogItem}
                        onTransformModeChange={setTransformMode}
                        onTransformSpaceChange={setTransformSpace}
                        onWallMaterialChange={applyWallFinish}
                        onFloorMaterialChange={applyFloorFinish}
                        onLightingChange={applyLightingSetting}
                        onLightingCommit={commitLightingSetting}
                        onApplyLightingPreset={applyLightingPreset}
                        onUpdateAsset={updateAssetFromInspector}
                        onRemoveAsset={removeAssetFromInspector}
                        formatAssetLabel={formatAssetIdLabel}
                      />
                    </>
                  )}

                  <div className="pointer-events-none absolute right-4 top-4 z-[24] flex flex-col gap-3">
                    <div className="pointer-events-auto flex flex-col overflow-hidden rounded-full border border-black/10 bg-white/96 p-1 shadow-[0_10px_24px_rgba(19,21,24,0.12)]">
                      <button
                        type="button"
                        onClick={() => triggerZoomControl("in")}
                        className="rounded-full px-3 py-2 text-[16px] font-bold text-[#4d453a] transition hover:bg-[#f2eee7]"
                        aria-label="확대"
                      >
                        +
                      </button>
                      <div className="mx-2 h-px bg-black/10" />
                      <button
                        type="button"
                        onClick={() => triggerZoomControl("out")}
                        className="rounded-full px-3 py-2 text-[16px] font-bold text-[#4d453a] transition hover:bg-[#f2eee7]"
                        aria-label="축소"
                      >
                        -
                      </button>
                    </div>
                  </div>

                  <ProjectEditorViewport
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
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isSceneVisible ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-3 sm:bottom-6">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/10 bg-white/96 p-1.5 shadow-[0_16px_34px_rgba(16,18,22,0.14)]">
            <div className="flex items-center gap-1 rounded-full bg-[#f4f4f1] p-1">
              {isTopEditorVisible ? (
                <button
                  type="button"
                  onClick={toggleAssetPanel}
                  className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition sm:px-4 xl:hidden ${
                    panels.assets ? "bg-white text-[#1f1b16]" : "text-[#4d453a] hover:bg-white"
                  }`}
                >
                  항목뷰
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => requestViewMode("top")}
                className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition sm:px-4 ${
                  viewMode === "top"
                    ? "bg-white text-[#1f1b16] shadow-[0_8px_20px_rgba(16,18,22,0.08)]"
                    : "text-[#4d453a] hover:bg-white"
                }`}
              >
                상단뷰
              </button>
              <button
                type="button"
                onClick={() => requestViewMode("walk")}
                disabled={!canEnter3D}
                className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition sm:px-4 ${
                  viewMode === "walk"
                    ? "bg-white text-[#1f1b16] shadow-[0_8px_20px_rgba(16,18,22,0.08)]"
                    : "text-[#4d453a] hover:bg-white disabled:cursor-not-allowed disabled:text-[#b0a79c] disabled:hover:bg-transparent"
                }`}
              >
                워크뷰
              </button>
            </div>
            {isTopEditorVisible ? (
              <>
                <span className="mx-1 h-7 w-px bg-black/10" />
                <div className="flex items-center gap-1 rounded-full bg-[#f4f4f1] p-1">
                  <button
                    type="button"
                    onClick={() => setTransformMode("translate")}
                    className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
                      transformMode === "translate" ? "bg-white text-[#1f1b16]" : "text-[#4d453a] hover:bg-white"
                    }`}
                  >
                    이동
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransformMode("rotate")}
                    className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
                      transformMode === "rotate" ? "bg-white text-[#1f1b16]" : "text-[#4d453a] hover:bg-white"
                    }`}
                  >
                    회전
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <ShareModal
        projectId={projectId}
        project={currentProject}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  );
}
