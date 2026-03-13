"use client";

import { Canvas } from "@react-three/fiber";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useMemo, Suspense } from "react";
import { toast } from "sonner";
import CameraRig from "../../../../components/canvas/core/CameraRig";
import PhysicsWorld from "../../../../components/canvas/core/PhysicsWorld";
import Lights from "../../../../components/canvas/effects/Lights";
import PostEffects from "../../../../components/canvas/effects/PostEffects";
import ProceduralCeiling from "../../../../components/canvas/features/ProceduralCeiling";
import ProceduralFloor from "../../../../components/canvas/features/ProceduralFloor";
import Furniture from "../../../../components/canvas/features/Furniture";
import ProceduralWall from "../../../../components/canvas/features/ProceduralWall";
import InteractionManager from "../../../../components/canvas/interaction/InteractionManager";
import AssetTransformControls from "../../../../components/canvas/interaction/AssetTransformControls";
import EditorHotkeys from "../../../../components/canvas/interaction/EditorHotkeys";
import { LandingHeroCanvas } from "../../../../components/landing/landing-hero-canvas";
import { FloorplanEditor } from "../../../../components/editor/FloorplanEditor";
import AssetPanel from "../../../../components/overlay/panels/AssetPanel";
import AIAssistantPanel from "../../../../components/overlay/panels/AIAssistantPanel";
import Crosshair from "../../../../components/overlay/hud/Crosshair";
import MobileTouchHint from "../../../../components/overlay/hud/MobileTouchHint";
import MobileControls from "../../../../components/overlay/hud/MobileControls";
import { useEditorStore, type EditorViewMode } from "../../../../lib/stores/useEditorStore";
import { useSceneStore } from "../../../../lib/stores/useSceneStore";
import { useProjectStore } from "../../../../lib/stores/useProjectStore";
import { motion, AnimatePresence } from "framer-motion";
import { SaveButton } from "../../../../components/editor/SaveButton";
import { ShareModal } from "../../../../components/editor/ShareModal";
import { Upload, ChevronLeft, Play, Edit3, Box, RotateCcw, Share2, Copy } from "lucide-react";
import SceneEnvironment from "../../../../components/canvas/core/SceneEnvironment";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import InteractiveDoors from "../../../../components/canvas/features/InteractiveDoors";
import InteractiveLights from "../../../../components/canvas/features/InteractiveLights";
import { createUnknownScaleInfo, getScaleGateMessage, parseScaleInfo } from "../../../../lib/ai/scaleInfo";
import {
  CatalogCandidate,
  fetchLayoutRevision,
  fetchLatestProjectScene,
  runCatalogIntakeFlow,
  runUploadIntakeFlow,
  selectIntakeCandidate
} from "../../../../features/floorplan/upload";
import { pollJobUntilTerminal } from "../../../../features/floorplan/job-polling";
import {
  buildSyntheticFloorplanPreview,
  mapFloorplanResultToScene,
  mapLayoutRevisionToScene,
  type MappedSceneResult
} from "../../../../features/floorplan/result-mapper";

type AnalysisRecovery = {
  message: string;
  providerErrors: string[];
  errorCode?: string | null;
};

type RecoverablePayload = {
  recoverable?: boolean;
  errorCode?: string;
  details?: string;
  error?: string;
  providerErrors?: string[];
};

export default function ProjectEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;

  const viewMode = useEditorStore((state) => state.viewMode);
  const setViewMode = useEditorStore((state) => state.setViewMode);
  const setReadOnly = useEditorStore((state) => state.setReadOnly);
  const walls = useSceneStore((state) => state.walls);
  const openings = useSceneStore((state) => state.openings);
  const scale = useSceneStore((state) => state.scale);
  const scaleInfo = useSceneStore((state) => state.scaleInfo);
  const setWalls = useSceneStore((state) => state.setWalls);
  const setOpenings = useSceneStore((state) => state.setOpenings);
  const setFloors = useSceneStore((state) => state.setFloors);
  const setScale = useSceneStore((state) => state.setScale);
  const setScene = useSceneStore((state) => state.setScene);
  const resetScene = useSceneStore((state) => state.resetScene);
  const { currentProject, loadProject } = useProjectStore();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastUploadedFileRef = useRef<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisRecovery, setAnalysisRecovery] = useState<AnalysisRecovery | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isWebGPUReady, setIsWebGPUReady] = useState(false);
  const [catalogApartmentName, setCatalogApartmentName] = useState("");
  const [catalogTypeName, setCatalogTypeName] = useState("");
  const [catalogRegion, setCatalogRegion] = useState("");
  const [catalogCandidates, setCatalogCandidates] = useState<CatalogCandidate[]>([]);
  const [activeIntakeSessionId, setActiveIntakeSessionId] = useState<string | null>(null);

  useEffect(() => {
    const supportsWebGPU = typeof navigator !== "undefined" && Boolean((navigator as any).gpu);
    setIsWebGPUReady(supportsWebGPU);
  }, []);

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

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const createPlaceholderFloorplanDataUrl = useCallback(() => {
    if (typeof document === "undefined") return null;
    const width = 1280;
    const height = 900;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#111214";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "600 18px sans-serif";
    ctx.fillText("Template-based floorplan (no source image)", 28, 44);
    return canvas.toDataURL("image/png");
  }, []);

  const applyMappedScene = useCallback(
    (mapped: MappedSceneResult, nextImage?: string | null) => {
      if (typeof nextImage === "string") {
        setImageSrc(nextImage);
      }
      setScene({
        scale: mapped.scale,
        scaleInfo: parseScaleInfo(mapped.scaleInfo, mapped.scale),
        walls: mapped.walls,
        openings: mapped.openings,
        floors: mapped.floors,
        ceilings: mapped.ceilings,
        rooms: mapped.rooms,
        cameraAnchors: mapped.cameraAnchors,
        navGraph: mapped.navGraph
      });
      useSceneStore.setState({ entranceId: mapped.entranceId });
      setAnalysisRecovery(null);
    },
    [setScene]
  );

  const applyRevisionToEditor = useCallback(
    async (layoutRevisionId: string) => {
      const revision = await fetchLayoutRevision(layoutRevisionId);
      const mapped = mapLayoutRevisionToScene(revision);
      const preview = buildSyntheticFloorplanPreview(mapped) ?? createPlaceholderFloorplanDataUrl();
      applyMappedScene(mapped, preview);
      setViewMode("2d-edit");
    },
    [applyMappedScene, createPlaceholderFloorplanDataUrl, setViewMode]
  );

  // Load project + latest scene data on mount
  useEffect(() => {
    const init = async () => {
      resetScene();
      setAnalysisRecovery(null);
      setImageSrc(null);

      const project = await loadProject(projectId);
      if (project?.thumbnail) {
        setImageSrc(project.thumbnail);
      }

      try {
        const latestScene = await fetchLatestProjectScene(projectId);
        if (latestScene.result) {
          const mapped = mapFloorplanResultToScene({
            floorplanId: latestScene.result.floorplanId,
            wallCoordinates: latestScene.result.wallCoordinates,
            roomPolygons: latestScene.result.roomPolygons,
            scale: latestScene.result.scale,
            sceneJson: latestScene.result.sceneJson,
            diagnostics: latestScene.result.diagnostics
          });
          applyMappedScene(mapped);
          setViewMode("top");
        } else if (project?.source_layout_revision_id) {
          await applyRevisionToEditor(project.source_layout_revision_id);
          setViewMode("top");
        } else {
          const metadata = project?.metadata;
          const floorPlan =
            metadata && typeof metadata === "object" && !Array.isArray(metadata)
              ? (metadata as { floorPlan?: { scale?: number; scaleInfo?: unknown; walls?: unknown[]; openings?: unknown[]; floors?: unknown[] } }).floorPlan
              : undefined;

          if (floorPlan && Array.isArray(floorPlan.walls) && floorPlan.walls.length > 0) {
            const nextScale = typeof floorPlan.scale === "number" && floorPlan.scale > 0 ? floorPlan.scale : 1;
            const nextScaleInfo = parseScaleInfo(floorPlan.scaleInfo, nextScale);
            setScene({
              scale: nextScale,
              scaleInfo: nextScaleInfo,
              walls: floorPlan.walls as any,
              openings: Array.isArray(floorPlan.openings) ? (floorPlan.openings as any) : [],
              floors: Array.isArray(floorPlan.floors) ? (floorPlan.floors as any) : []
            });
            const entrance = Array.isArray(floorPlan.openings)
              ? (floorPlan.openings as Array<{ id?: string; isEntrance?: boolean }>).find((opening) => opening.isEntrance)
              : undefined;
            if (entrance?.id) {
              useSceneStore.setState({ entranceId: entrance.id });
            }
            setViewMode("top");
          }
        }
      } catch (error) {
        console.warn("[project-editor] latest scene load failed:", error);
      }

      setIsInitialLoad(false);
      setReadOnly(false);
    };
    void init();
  }, [applyMappedScene, applyRevisionToEditor, loadProject, projectId, resetScene, setReadOnly, setScene, setViewMode]);

  const runAnalysis = useCallback(
    async (file: File) => {
      setIsAnalyzing(true);
      setViewMode("2d-edit");
      setAnalysisRecovery(null);
      setCatalogCandidates([]);
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setImageSrc(dataUrl);
        lastUploadedFileRef.current = file;

        const outcome = await runUploadIntakeFlow({
          file,
          apartmentName: catalogApartmentName,
          typeName: catalogTypeName,
          region: catalogRegion,
          inputKind: "remediation",
          remediationProjectId: projectId,
          pollJobUntilTerminal
        });

        setActiveIntakeSessionId(outcome.session.id);

        if (outcome.kind === "reused") {
          await applyRevisionToEditor(outcome.layoutRevisionId);
          await loadProject(projectId);
          toast.success("Verified layout reused successfully.");
          return;
        }

        if (outcome.kind === "disambiguation_required") {
          setCatalogCandidates(outcome.candidates);
          setImageSrc(null);
          toast.message("Multiple verified layouts matched. Select one to continue.");
          return;
        }

        applyMappedScene(mapFloorplanResultToScene(outcome.result), dataUrl);
        await loadProject(projectId);
        toast.success(outcome.reviewRequired ? "Low-confidence result loaded for review." : "Design blueprint analyzed successfully.");
      } catch (err) {
        const payload =
          err && typeof err === "object" && "payload" in err
            ? ((err as { payload?: unknown }).payload as RecoverablePayload | undefined)
            : undefined;
        const message =
          payload?.details ||
          payload?.error ||
          (err instanceof Error ? err.message : "Low confidence in analysis. Entering manual adjustment mode.");
        setWalls([]);
        setOpenings([]);
        setFloors([]);
        setScale(1, createUnknownScaleInfo(1, message));
        setAnalysisRecovery({
          message,
          providerErrors: Array.isArray(payload?.providerErrors) ? payload.providerErrors : [],
          errorCode: payload?.errorCode ?? null
        });
        setViewMode("2d-edit");
        toast.error(message);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [
      applyMappedScene,
      applyRevisionToEditor,
      catalogApartmentName,
      catalogRegion,
      catalogTypeName,
      loadProject,
      projectId,
      setFloors,
      setOpenings,
      setScale,
      setViewMode,
      setWalls
    ]
  );

  const runCatalogAnalysis = useCallback(
    async (query: { apartmentName: string; typeName: string; region?: string }) => {
      if (!query.apartmentName.trim() || !query.typeName.trim()) {
        toast.error("Apartment name and type are required.");
        return;
      }
      setIsAnalyzing(true);
      setCatalogCandidates([]);
      setAnalysisRecovery(null);
      try {
        const outcome = await runCatalogIntakeFlow({
          apartmentName: query.apartmentName,
          typeName: query.typeName,
          region: query.region,
          inputKind: "remediation",
          remediationProjectId: projectId
        });

        setActiveIntakeSessionId(outcome.session.id);

        if (outcome.kind === "reused") {
          await applyRevisionToEditor(outcome.layoutRevisionId);
          toast.success("Verified layout loaded.");
          return;
        }

        setCatalogCandidates(outcome.candidates);
        toast.message("Multiple verified layouts matched. Select one to continue.");
      } catch (error) {
        const payload =
          error && typeof error === "object" && "payload" in error
            ? ((error as { payload?: unknown }).payload as RecoverablePayload | undefined)
            : undefined;
        const message = payload?.details || payload?.error || (error instanceof Error ? error.message : "Template lookup failed.");
        setWalls([]);
        setOpenings([]);
        setFloors([]);
        setScale(1, createUnknownScaleInfo(1, message));
        setAnalysisRecovery({
          message,
          providerErrors: Array.isArray(payload?.providerErrors) ? payload.providerErrors : [],
          errorCode: payload?.errorCode ?? null
        });
        toast.error(message);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [applyRevisionToEditor, projectId, setFloors, setOpenings, setScale, setWalls]
  );

  const handleSelectCatalogCandidate = useCallback(
    async (layoutRevisionId: string) => {
      if (!activeIntakeSessionId) {
        toast.error("Candidate selection session expired. Retry the search.");
        return;
      }

      setIsAnalyzing(true);
      try {
        await selectIntakeCandidate(activeIntakeSessionId, layoutRevisionId);
        setCatalogCandidates([]);
        await applyRevisionToEditor(layoutRevisionId);
        toast.success("Verified layout loaded.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to select layout candidate.";
        toast.error(message);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [activeIntakeSessionId, applyRevisionToEditor]
  );

  const analyzeFloorplan = useCallback(
    async (file: File) => {
      await runAnalysis(file);
    },
    [runAnalysis]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) analyzeFloorplan(file);
  };

  const handleConfirm2D = () => {
    if (walls.length === 0) {
      toast.error("No walls detected. Add at least one wall before entering 3D.");
      return;
    }
    const scaleGateMessage = getScaleGateMessage(scale, scaleInfo);
    if (scaleGateMessage) {
      toast.error(scaleGateMessage);
      return;
    }
    setViewMode("top");
    toast.success("3D Workspace Initialized");
  };

  const requestViewMode = (mode: EditorViewMode) => {
    if (mode === "top" || mode === "walk") {
      if (walls.length === 0) {
        toast.error("No walls detected. Add at least one wall before entering 3D.");
        setViewMode("2d-edit");
        return;
      }
      const scaleGateMessage = getScaleGateMessage(scale, scaleInfo);
      if (scaleGateMessage) {
        toast.error(scaleGateMessage);
        setViewMode("2d-edit");
        return;
      }
    }
    setViewMode(mode);
  };

  const handleCopyRecoveryErrors = useCallback(async () => {
    if (!analysisRecovery) return;
    const lines = [
      analysisRecovery.message,
      ...(analysisRecovery.errorCode ? [`Code: ${analysisRecovery.errorCode}`] : []),
      ...(analysisRecovery.providerErrors.length > 0 ? ["", ...analysisRecovery.providerErrors] : [])
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Recovery details copied.");
    } catch {
      toast.error("Failed to copy recovery details.");
    }
  }, [analysisRecovery]);

  const handleRetryRecovery = useCallback(() => {
    if (!lastUploadedFileRef.current) {
      toast.error("Re-upload the original image to retry AI analysis.");
      return;
    }
    void runAnalysis(lastUploadedFileRef.current);
  }, [runAnalysis]);

  const handleStartManualRecovery = useCallback(() => {
    setWalls([]);
    setOpenings([]);
    setFloors([]);
    const reason = analysisRecovery?.message ?? "Continue in manual 2D correction mode.";
    setScale(1, createUnknownScaleInfo(1, reason));
    setViewMode("2d-edit");
    toast.message("Manual correction mode enabled.");
  }, [analysisRecovery?.message, setFloors, setOpenings, setScale, setViewMode, setWalls]);

  const isSceneVisible = viewMode === "top" || viewMode === "walk";

  if (isInitialLoad) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0b]">
        <div className="text-white/20 text-[10px] font-bold uppercase tracking-[0.5em] animate-pulse">
          Synchronizing Workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0a0a0b] text-white">
      {/* Background Ambience for 2D modes */}
      {!isSceneVisible && <LandingHeroCanvas onAction={() => { }} />}

      {/* Glass Navigation Header */}
      <div className="fixed top-3 sm:top-8 inset-x-3 sm:inset-x-8 z-[100] flex items-start sm:items-center justify-between pointer-events-none gap-2">
        <div className="flex items-center gap-2 sm:gap-6 pointer-events-auto min-w-0">
          <button
            onClick={() => router.push("/studio")}
            className="p-2.5 sm:p-4 glass-dark rounded-[16px] sm:rounded-[24px] hover:bg-white/10 transition-all group shadow-2xl border border-white/5 active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
          </button>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col min-w-0"
          >
            <span className="text-[9px] sm:text-[10px] font-bold text-white/30 uppercase tracking-[0.25em] sm:tracking-[0.4em] mb-1 truncate">Architecture Studio</span>
            <h1 className="text-sm sm:text-lg font-outfit font-medium tracking-tight text-white leading-none truncate max-w-[44vw] sm:max-w-none">
              {currentProject?.name || (isSceneVisible ? "System Simulation" : "Topology Analysis")}
            </h1>
          </motion.div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 pointer-events-auto">
          <div className="flex p-1 glass-dark rounded-[16px] sm:rounded-[24px] border border-white/5 shadow-2xl overflow-x-auto max-w-[58vw] sm:max-w-none">
            {[
              { id: "2d-edit", icon: Edit3, label: "2D Plan" },
              { id: "top", icon: Box, label: "3D Edit" },
              { id: "walk", icon: Play, label: "Walkthrough" }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => requestViewMode(mode.id as EditorViewMode)}
                className={`flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-[12px] sm:rounded-[18px] text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all duration-500 whitespace-nowrap ${viewMode === mode.id
                  ? "bg-white text-black shadow-lg scale-100"
                  : "text-white/40 hover:text-white hover:bg-white/5 scale-95"
                  }`}
              >
                <mode.icon className="w-4 h-4" />
                <span className="hidden md:inline">{mode.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsShareOpen(true)}
            className="hidden sm:flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-[12px] sm:rounded-[18px] text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
          <div className="hidden sm:block">
            <SaveButton projectId={projectId} />
          </div>
        </div>
      </div>

      {/* Primary Workspace */}
      <div className="relative w-full h-screen overflow-hidden pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-6 lg:px-12">
        <AnimatePresence mode="popLayout" initial={false}>
          {/* Step 1: Upload */}
          {(!imageSrc || catalogCandidates.length > 0) && !isAnalyzing && (
            <motion.div
              key="upload_state"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="w-full h-full flex items-center justify-center p-3 sm:p-10 lg:p-20"
            >
              <div
                onClick={() => inputRef.current?.click()}
                className="group relative w-full max-w-4xl h-full flex flex-col items-center justify-center gap-6 sm:gap-8 rounded-[24px] sm:rounded-[60px] border border-white/10 glass-dark hover:border-white/20 cursor-pointer transition-all duration-700 shadow-3xl px-3 sm:px-0"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-white/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="relative p-12 rounded-full bg-white/5 border border-white/10 group-hover:bg-white/10 group-hover:scale-110 transition-all duration-700">
                    <Upload className="w-16 h-16 text-white/20 group-hover:text-white transition-colors" />
                  </div>
                </div>
                <div className="text-center space-y-4 max-w-md">
                  <h2 className="text-2xl sm:text-4xl font-outfit font-light tracking-tight">Deploy Blueprint</h2>
                  <p className="text-white/40 sm:text-white/30 text-sm sm:text-base font-light font-outfit leading-relaxed">
                    Upload your architectural floorplan. Claude 3.5 will automatically extract structural topology.
                  </p>
                </div>
                <div
                  className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5 backdrop-blur-md"
                  onClick={(event) => event.stopPropagation()}
                >
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
                    Template Catalog
                  </p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      value={catalogApartmentName}
                      onChange={(event) => setCatalogApartmentName(event.target.value)}
                      placeholder="Apartment name"
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/40"
                    />
                    <input
                      value={catalogTypeName}
                      onChange={(event) => setCatalogTypeName(event.target.value)}
                      placeholder="Type (e.g. 84A)"
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/40"
                    />
                    <input
                      value={catalogRegion}
                      onChange={(event) => setCatalogRegion(event.target.value)}
                      placeholder="Region (optional)"
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/40"
                    />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        void runCatalogAnalysis({
                          apartmentName: catalogApartmentName,
                          typeName: catalogTypeName,
                          region: catalogRegion
                        })
                      }
                      disabled={isAnalyzing}
                      className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/85 transition hover:bg-white/15 disabled:opacity-40"
                    >
                      Find Template
                    </button>
                  </div>
                  {catalogCandidates.length > 0 && (
                    <div className="mt-4 grid gap-2">
                      {catalogCandidates.map((candidate) => (
                        <button
                          key={candidate.layoutRevisionId ?? `${candidate.apartmentName}-${candidate.typeName}-${candidate.variantLabel ?? ""}`}
                          type="button"
                          onClick={() => void handleSelectCatalogCandidate(candidate.layoutRevisionId ?? "")}
                          disabled={isAnalyzing || !candidate.layoutRevisionId}
                          className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left transition hover:border-white/35 disabled:opacity-40"
                        >
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                              {candidate.apartmentName} {candidate.typeName}
                            </p>
                            <p className="text-[11px] text-white/55">
                              {[candidate.region, candidate.areaLabel, candidate.variantLabel].filter(Boolean).join(" • ")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60">
                              Match {(candidate.matchScore * 100).toFixed(0)}%
                            </p>
                            {candidate.verified && (
                              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                                Verified
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
              </div>
            </motion.div>
          )}

          {/* Step 2: Processing */}
          {isAnalyzing && (
            <motion.div
              key="processing_state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col items-center justify-center gap-10"
            >
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 border-[3px] border-white/5 rounded-full" />
                <motion.div
                  className="absolute inset-0 border-[3px] border-t-white border-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                />
              </div>
              <div className="text-center space-y-3">
                <h2 className="text-3xl font-outfit font-light tracking-tight">Processing Matrix</h2>
                <div className="flex items-center justify-center gap-4 text-white/40 uppercase tracking-[0.4em] text-[10px]">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span>Analyzing via Sonnet 3.5</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: 2D Refinement */}
          {viewMode === "2d-edit" && imageSrc && !isAnalyzing && (
            <motion.div
              key="refine_state"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full h-full glass-dark overflow-hidden rounded-[24px] sm:rounded-[40px] shadow-3xl border border-white/10 p-2 sm:p-4"
            >
              <div className="flex h-full flex-col gap-4">
                {analysisRecovery && (
                  <div className="rounded-2xl border border-amber-400/40 bg-amber-200/10 p-4 text-amber-100">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/80">
                          Recoverable AI Failure
                        </p>
                        <p className="text-sm">{analysisRecovery.message}</p>
                        {analysisRecovery.errorCode && (
                          <p className="text-[11px] text-amber-100/70">Code: {analysisRecovery.errorCode}</p>
                        )}
                        <p className="text-[11px] text-amber-100/80">
                          Walls/openings are cleared. Draw walls and calibrate scale to continue.
                        </p>
                      </div>
                      <div className="flex w-full sm:w-auto flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyRecoveryErrors}
                          className="inline-flex justify-center items-center gap-2 rounded-xl border border-amber-300/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-amber-300/10 transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy Errors
                        </button>
                        <button
                          type="button"
                          onClick={handleRetryRecovery}
                          className="inline-flex justify-center items-center rounded-xl border border-amber-300/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-amber-300/10 transition-colors"
                        >
                          Try AI Again
                        </button>
                        <button
                          type="button"
                          onClick={handleStartManualRecovery}
                          className="inline-flex justify-center items-center rounded-xl border border-amber-300/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-amber-300/10 transition-colors"
                        >
                          Start Manual
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/10">
                  <FloorplanEditor image={imageSrc} onConfirm={handleConfirm2D} />
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: 3D Workspace */}
          {isSceneVisible && (
            <motion.div
              key="workspace_state"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full rounded-[20px] sm:rounded-[48px] overflow-hidden bg-[#050505] shadow-3xl border border-white/5 border-b-0"
            >
              <Canvas
                shadows
                dpr={[1, 2]}
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
                className="h-full w-full"
                onCreated={({ gl }) => {
                  const renderer = gl as THREE.WebGLRenderer & { physicallyCorrectLights?: boolean };
                  renderer.shadowMap.enabled = true;
                  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                  renderer.toneMapping = THREE.ACESFilmicToneMapping;
                  renderer.toneMappingExposure = 1.1;
                  renderer.outputColorSpace = THREE.SRGBColorSpace;
                  if ("physicallyCorrectLights" in renderer) {
                    renderer.physicallyCorrectLights = true;
                  }
                }}
              >
                <color attach="background" args={["#0a0a0b"]} />
                <Suspense fallback={null}>
                  <PhysicsWorld>
                    <Lights />
                    <SceneEnvironment />
                    <CameraRig />
                    <EditorHotkeys />
                    <AssetTransformControls />
                    <InteractionManager>
                      <ProceduralFloor />
                      <ProceduralCeiling />
                      <ProceduralWall />
                      <InteractiveDoors />
                      <InteractiveLights />
                      <Furniture />
                    </InteractionManager>
                  </PhysicsWorld>
                  <PostEffects />
                </Suspense>
              </Canvas>
              <AssetPanel />
              <AIAssistantPanel />
              <Crosshair />
              <MobileTouchHint />
              <MobileControls />
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
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={() => {
              setWalls([]);
              setOpenings([]);
              setFloors([]);
              router.push("/studio");
            }}
            className="p-3 sm:p-4 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full hover:bg-red-500/10 hover:border-red-500/20 group transition-all"
          >
            <RotateCcw className="w-5 h-5 text-white/30 group-hover:text-red-500 transition-colors" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.03),transparent_50%)]" />
      <ShareModal projectId={projectId} isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} />
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
