"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AuthPopup } from "../../../components/overlay/AuthPopup";
import { StudioWorkspacePanel, StudioWorkspaceShell } from "../../../components/layout/StudioWorkspaceShell";
import { BuilderFooter } from "../../../features/builder/BuilderFooter";
import { BuilderPreviewPane } from "../../../features/builder/BuilderPreviewPane";
import { BuilderStepHeader } from "../../../features/builder/BuilderStepHeader";
import {
  BUILDER_STEPS,
  DOOR_STYLE_LABEL,
  FLOOR_FINISH_SWATCH,
  resolveBuilderStepIndex,
  WALL_FINISH_SWATCH,
  WINDOW_STYLE_LABEL
} from "../../../features/builder/constants";
import { buildPreviewDataUrl } from "../../../features/builder/logic/preview";
import {
  getWallLength,
} from "../../../features/builder/logic/openings";
import { useBuilderOpeningState } from "../../../features/builder/state/useBuilderOpeningState";
import { useBuilderSceneSync } from "../../../features/builder/state/useBuilderSceneSync";
import { BuilderDimensionsStep } from "../../../features/builder/steps/BuilderDimensionsStep";
import { BuilderOpeningsStep } from "../../../features/builder/steps/BuilderOpeningsStep";
import { BuilderShapeStep } from "../../../features/builder/steps/BuilderShapeStep";
import { BuilderStyleStep } from "../../../features/builder/steps/BuilderStyleStep";
import type { DoorStyle, WindowStyle } from "../../../features/builder/types";
import { fetchRoomTemplateConfig, type BuilderFinishOption } from "../../../lib/api/room-templates";
import { createProjectDraft, saveProject } from "../../../lib/api/project";
import {
  buildBuilderScene,
  builderFloorFinishes,
  builderTemplates,
  builderWallFinishes,
  type BuilderTemplateId
} from "../../../lib/builder/templates";
import { deriveBlankRoomShell } from "../../../lib/domain/room-shell";
import { useAuthStore } from "../../../lib/stores/useAuthStore";
import type { EditorViewMode } from "../../../lib/stores/useEditorStore";

type BuilderPreviewMode = Extract<EditorViewMode, "top" | "builder-preview">;

export default function StudioBuilderPage() {
  const router = useRouter();
  const [intent, setIntent] = useState<"template" | "custom">("template");
  const { session } = useAuthStore();
  const isAuthenticated = Boolean(session?.user);

  const [projectName, setProjectName] = useState("새 공간 디자인");
  const [projectDescription, setProjectDescription] = useState("빌더에서 생성한 기본 공간");
  const [templateId, setTemplateId] = useState<BuilderTemplateId>("rect-studio");
  const [width, setWidth] = useState(6.4);
  const [depth, setDepth] = useState(4.8);
  const [dimensionUnit, setDimensionUnit] = useState<"ft" | "cm">("cm");
  const [nookWidth, setNookWidth] = useState(2.8);
  const [nookDepth, setNookDepth] = useState(2.4);
  const [wallMaterialIndex, setWallMaterialIndex] = useState(0);
  const [floorMaterialIndex, setFloorMaterialIndex] = useState(0);
  const [doorStyle, setDoorStyle] = useState<DoorStyle>("single");
  const [windowStyle, setWindowStyle] = useState<WindowStyle>("single");
  const [addSecondaryWindow, setAddSecondaryWindow] = useState(false);
  const [previewMode, setPreviewMode] = useState<BuilderPreviewMode>("builder-preview");
  const [stepIndex, setStepIndex] = useState(0);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [templateOptions, setTemplateOptions] = useState(builderTemplates);
  const [wallFinishOptions, setWallFinishOptions] = useState<BuilderFinishOption[]>([...builderWallFinishes]);
  const [floorFinishOptions, setFloorFinishOptions] = useState<BuilderFinishOption[]>([...builderFloorFinishes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = new URLSearchParams(window.location.search);
    const nextIntent = query.get("intent") === "custom" ? "custom" : "template";
    const nextStepIndex = resolveBuilderStepIndex(query.get("step"));
    setIntent(nextIntent);
    setStepIndex(nextStepIndex);
    setProjectName((current) => {
      if (current === "새 공간 디자인" || current === "맞춤 공간 디자인") {
        return nextIntent === "custom" ? "맞춤 공간 디자인" : "새 공간 디자인";
      }
      return current;
    });

    query.set("intent", nextIntent);
    query.set("step", BUILDER_STEPS[nextStepIndex]?.id ?? BUILDER_STEPS[0].id);
    router.replace(`/studio/builder?${query.toString()}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    let active = true;

    fetchRoomTemplateConfig()
      .then((config) => {
        if (!active) return;
        setTemplateOptions(config.templates);
        setWallFinishOptions(config.wallFinishes);
        setFloorFinishOptions(config.floorFinishes);
        setTemplateId((currentTemplateId) => {
          const hydratedTemplate =
            config.templates.find((template) => template.id === currentTemplateId) ?? config.templates[0];
          if (!hydratedTemplate) return currentTemplateId;
          setWidth(hydratedTemplate.defaultWidth);
          setDepth(hydratedTemplate.defaultDepth);
          setNookWidth(hydratedTemplate.defaultNookWidth ?? 2.8);
          setNookDepth(hydratedTemplate.defaultNookDepth ?? 2.4);
          return hydratedTemplate.id;
        });
      })
      .catch(() => {
        if (!active) return;
        setTemplateOptions(builderTemplates);
        setWallFinishOptions([...builderWallFinishes]);
        setFloorFinishOptions([...builderFloorFinishes]);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeTemplate = useMemo(
    () => templateOptions.find((template) => template.id === templateId) ?? templateOptions[0] ?? builderTemplates[0],
    [templateId, templateOptions]
  );
  const activeStep = BUILDER_STEPS[stepIndex] ?? BUILDER_STEPS[0];
  const isFinalStep = stepIndex === BUILDER_STEPS.length - 1;
  const supportsSecondaryDimensions =
    templateId === "l-shape" ||
    templateId === "cut-shape" ||
    templateId === "t-shape" ||
    templateId === "u-shape" ||
    templateId === "slanted-shape";

  const activeWallFinish = useMemo(
    () => wallFinishOptions.find((finish) => finish.id === wallMaterialIndex) ?? wallFinishOptions[0] ?? builderWallFinishes[0],
    [wallFinishOptions, wallMaterialIndex]
  );
  const activeFloorFinish = useMemo(
    () => floorFinishOptions.find((finish) => finish.id === floorMaterialIndex) ?? floorFinishOptions[0] ?? builderFloorFinishes[0],
    [floorFinishOptions, floorMaterialIndex]
  );

  const baseScene = useMemo(
    () =>
      buildBuilderScene({
        templateId,
        width,
        depth,
        nookWidth,
        nookDepth
      }),
    [templateId, width, depth, nookWidth, nookDepth]
  );
  const {
    openings,
    selectedOpeningId,
    selectedWallId,
    selectedOpening,
    selectedOpeningWall,
    selectedWallOpenings,
    setSelectedOpeningId,
    setSelectedWallId,
    setOpeningPatch,
    setEntranceOpening,
    deleteOpening,
    addOpening
  } = useBuilderOpeningState({
    walls: baseScene.walls,
    templateOpenings: baseScene.openings,
    doorStyle,
    windowStyle,
    addSecondaryWindow
  });

  const scene = useMemo(
    () => ({
      ...baseScene,
      openings
    }),
    [baseScene, openings]
  );
  const derivedRoomShell = useMemo(
    () =>
      deriveBlankRoomShell({
        scale: scene.scale,
        scaleInfo: scene.scaleInfo,
        walls: scene.walls,
        openings: scene.openings,
        floors: scene.floors
      }),
    [scene.floors, scene.openings, scene.scale, scene.scaleInfo, scene.walls]
  );

  const wallEntries = useMemo(
    () =>
      scene.walls.map((wall, index) => ({
        id: wall.id,
        label: `벽 ${index + 1}`,
        length: getWallLength(wall)
      })),
    [scene.walls]
  );

  const previewDataUrl = useMemo(
    () => buildPreviewDataUrl(scene.floors[0]?.outline ?? [], scene.openings.map(({ type, wallId }) => ({ type, wallId }))),
    [scene.floors, scene.openings]
  );
  useBuilderSceneSync({
    previewMode,
    derivedRoomShell,
    wallMaterialIndex,
    floorMaterialIndex
  });
  const handleAddOpening = useCallback(
    (type: "door" | "window") => {
      const createdId = addOpening(type);
      if (!createdId) {
        toast.error("개구부를 배치할 벽이 없습니다.");
      }
    },
    [addOpening]
  );

  const handleTemplateSelect = (nextTemplateId: BuilderTemplateId) => {
    const nextTemplate = templateOptions.find((template) => template.id === nextTemplateId);
    if (!nextTemplate) return;
    setTemplateId(nextTemplate.id);
    setWidth(nextTemplate.defaultWidth);
    setDepth(nextTemplate.defaultDepth);
    setNookWidth(nextTemplate.defaultNookWidth ?? 2.8);
    setNookDepth(nextTemplate.defaultNookDepth ?? 2.4);
  };

  const setStepWithRoute = useCallback(
    (nextStepIndex: number) => {
      const clamped = Math.max(0, Math.min(BUILDER_STEPS.length - 1, nextStepIndex));
      setStepIndex(clamped);
      if (typeof window === "undefined") return;
      const query = new URLSearchParams(window.location.search);
      query.set("intent", intent);
      query.set("step", BUILDER_STEPS[clamped]?.id ?? BUILDER_STEPS[0].id);
      router.replace(`/studio/builder?${query.toString()}`, { scroll: false });
    },
    [intent, router]
  );

  const handleCreate = async () => {
    if (!isAuthenticated) {
      setIsAuthOpen(true);
      return;
    }

    if (!projectName.trim()) {
      toast.error("프로젝트 이름을 입력해 주세요.");
      return;
    }

    setIsCreating(true);
    try {
      const project = await createProjectDraft({
        name: projectName.trim(),
        description: projectDescription.trim() || "빌더에서 생성한 기본 공간"
      });

      await saveProject(project.id, {
        topology: {
          scale: scene.scale,
          scaleInfo: scene.scaleInfo,
          walls: scene.walls,
          openings: scene.openings,
          floors: scene.floors
        },
        roomShell: derivedRoomShell,
        assets: [],
        materials: {
          wallIndex: wallMaterialIndex,
          floorIndex: floorMaterialIndex
        },
        lighting: {
          ambientIntensity: 0.35,
          hemisphereIntensity: 0.4,
          directionalIntensity: 1.05,
          environmentBlur: 0.2
        },
        thumbnailDataUrl: previewDataUrl,
        projectName: projectName.trim(),
        projectDescription: projectDescription.trim() || "빌더에서 생성한 기본 공간",
        message: "빌더 초기 장면"
      });

      router.push(`/project/${project.id}?origin=builder`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "공간 생성에 실패했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleNext = () => {
    if (isFinalStep) {
      void handleCreate();
      return;
    }
    setStepWithRoute(stepIndex + 1);
  };

  const handleBack = () => {
    setStepWithRoute(stepIndex - 1);
  };

  const triggerZoomControl = useCallback((direction: "in" | "out") => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("plan2space:zoom", { detail: { direction } }));
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f1e8] pb-16 pt-24 text-[#171411]">
      <div className="mx-auto max-w-[1540px] px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/studio")}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4d443b] transition hover:border-black/40 hover:text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            프로젝트 목록
          </button>
          <div className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7a6f64]">
            {intent === "template" ? "템플릿 빠른 시작" : "맞춤 빌더"}
          </div>
        </div>

        <StudioWorkspaceShell className="mt-6">
          <StudioWorkspacePanel className="p-6 sm:p-8">
            <BuilderStepHeader
              activeStep={activeStep}
              steps={BUILDER_STEPS}
              stepIndex={stepIndex}
              onStepChange={setStepWithRoute}
            />

            <div className="mt-8 space-y-6">
              {stepIndex === 0 ? (
                <BuilderShapeStep
                  templateOptions={templateOptions}
                  templateId={templateId}
                  onSelectTemplate={handleTemplateSelect}
                />
              ) : null}

              {stepIndex === 1 ? (
                <BuilderDimensionsStep
                  unit={dimensionUnit}
                  supportsSecondaryDimensions={supportsSecondaryDimensions}
                  width={width}
                  depth={depth}
                  nookWidth={nookWidth}
                  nookDepth={nookDepth}
                  onUnitChange={setDimensionUnit}
                  onWidthChange={setWidth}
                  onDepthChange={setDepth}
                  onNookWidthChange={setNookWidth}
                  onNookDepthChange={setNookDepth}
                />
              ) : null}

              {stepIndex === 2 ? (
                <BuilderOpeningsStep
                  doorStyle={doorStyle}
                  windowStyle={windowStyle}
                  addSecondaryWindow={addSecondaryWindow}
                  doorStyleLabels={DOOR_STYLE_LABEL}
                  windowStyleLabels={WINDOW_STYLE_LABEL}
                  wallEntries={wallEntries}
                  selectedWallId={selectedWallId}
                  selectedWallOpenings={selectedWallOpenings}
                  selectedOpeningId={selectedOpeningId}
                  selectedOpening={selectedOpening}
                  selectedOpeningWall={selectedOpeningWall}
                  onDoorStyleChange={setDoorStyle}
                  onWindowStyleChange={setWindowStyle}
                  onAddSecondaryWindowChange={setAddSecondaryWindow}
                  onSelectWall={setSelectedWallId}
                  onSelectOpening={setSelectedOpeningId}
                  onAddOpening={handleAddOpening}
                  onDeleteOpening={deleteOpening}
                  onPatchOpening={setOpeningPatch}
                  onSetEntrance={setEntranceOpening}
                  getWallLength={getWallLength}
                />
              ) : null}

              {stepIndex === 3 ? (
                <BuilderStyleStep
                  projectName={projectName}
                  projectDescription={projectDescription}
                  wallMaterialIndex={wallMaterialIndex}
                  floorMaterialIndex={floorMaterialIndex}
                  wallFinishOptions={wallFinishOptions}
                  floorFinishOptions={floorFinishOptions}
                  wallFinishSwatch={WALL_FINISH_SWATCH}
                  floorFinishSwatch={FLOOR_FINISH_SWATCH}
                  onProjectNameChange={setProjectName}
                  onProjectDescriptionChange={setProjectDescription}
                  onWallMaterialIndexChange={setWallMaterialIndex}
                  onFloorMaterialIndexChange={setFloorMaterialIndex}
                />
              ) : null}
            </div>

            <BuilderFooter
              stepIndex={stepIndex}
              isFinalStep={isFinalStep}
              isCreating={isCreating}
              onBack={handleBack}
              onNext={handleNext}
            />
          </StudioWorkspacePanel>

          <BuilderPreviewPane
            previewMode={previewMode}
            activeTemplateName={activeTemplate.name}
            width={width}
            depth={depth}
            openingCount={scene.openings.length}
            stepIndex={stepIndex}
            wallFinishName={activeWallFinish.name}
            floorFinishName={activeFloorFinish.name}
            doorCount={scene.openings.filter((opening) => opening.type === "door").length}
            windowCount={scene.openings.filter((opening) => opening.type === "window").length}
            onPreviewModeChange={setPreviewMode}
            onZoomControl={triggerZoomControl}
          />
        </StudioWorkspaceShell>
      </div>

      <AuthPopup
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        nextPath={`/studio/builder?intent=${intent}`}
      />
    </div>
  );
}
