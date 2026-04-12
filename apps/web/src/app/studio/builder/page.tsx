"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AuthPopup } from "../../../components/overlay/AuthPopup";
import { StudioWorkspacePanel, StudioWorkspaceShell } from "../../../components/layout/StudioWorkspaceShell";
import { BuilderFooter } from "../../../features/builder/BuilderFooter";
import { BuilderPreviewPane } from "../../../features/builder/BuilderPreviewPane";
import { BuilderStepHeader } from "../../../features/builder/BuilderStepHeader";
import { BuilderDimensionsStep } from "../../../features/builder/steps/BuilderDimensionsStep";
import { BuilderOpeningsStep } from "../../../features/builder/steps/BuilderOpeningsStep";
import { BuilderShapeStep } from "../../../features/builder/steps/BuilderShapeStep";
import { BuilderStyleStep } from "../../../features/builder/steps/BuilderStyleStep";
import type { BuilderStepMeta, DoorStyle, WindowStyle } from "../../../features/builder/types";
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
import { useCameraStore, useShellStore } from "../../../lib/stores/scene-slices";
import type { Opening, Wall } from "../../../lib/stores/useSceneStore";
import { useEditorStore, type EditorViewMode } from "../../../lib/stores/useEditorStore";

type BuilderPreviewMode = Extract<EditorViewMode, "top" | "builder-preview">;

const BUILDER_STEPS: BuilderStepMeta[] = [
  {
    label: "1/4단계",
    title: "모양 및 크기 설정하기",
    description: "방 형태를 먼저 선택하고 다음 단계에서 치수를 조정합니다."
  },
  {
    label: "2/4단계",
    title: "치수 조정하기",
    description: "선택한 방의 가로/세로와 세부 치수를 실제 공간에 맞게 조정합니다."
  },
  {
    label: "3/4단계",
    title: "문과 창문 추가하기",
    description: "벽 기준으로 문/창문을 배치하고 위치와 폭을 조정합니다."
  },
  {
    label: "4/4단계",
    title: "방 스타일 선택하기",
    description: "벽/바닥 스타일을 선택하고 프로젝트 정보를 확인합니다."
  }
];

const DOOR_STYLE_LABEL: Record<DoorStyle, string> = {
  single: "싱글 패널 도어",
  double: "이중 패널 도어",
  french: "프렌치 양문형 도어"
};

const WINDOW_STYLE_LABEL: Record<WindowStyle, string> = {
  single: "유리창 싱글",
  wide: "유리창 와이드"
};

const WALL_FINISH_SWATCH: Record<number, string> = {
  0: "#efe9df",
  1: "#f9f7f2",
  2: "#6e6964"
};

const FLOOR_FINISH_SWATCH: Record<number, string> = {
  0: "#b58f67",
  1: "#7a7570",
  2: "#d8d3cb"
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getWallLength(wall: Wall) {
  return Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
}

function createOpeningId(type: "door" | "window") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `opening-${type}-${crypto.randomUUID()}`;
  }
  return `opening-${type}-${Math.random().toString(36).slice(2, 9)}`;
}

function getDoorWidthByStyle(style: DoorStyle) {
  if (style === "double") return 1.4;
  if (style === "french") return 1.6;
  return 0.92;
}

function getWindowWidthByStyle(style: WindowStyle) {
  return style === "wide" ? 2.4 : 1.8;
}

function ensureSingleEntranceDoor(openings: Opening[]) {
  const doors = openings.filter((opening) => opening.type === "door");
  if (doors.length === 0) return openings;
  const entranceId = doors.find((opening) => opening.isEntrance)?.id ?? doors[0]?.id;
  return openings.map((opening) =>
    opening.type === "door" ? { ...opening, isEntrance: opening.id === entranceId } : opening
  );
}

function sanitizeOpeningForWalls(opening: Opening, walls: Wall[]): Opening | null {
  if (walls.length === 0) return null;
  const wall = walls.find((candidate) => candidate.id === opening.wallId) ?? walls[0];
  if (!wall) return null;

  const wallLength = getWallLength(wall);
  const margin = opening.type === "door" ? 0.38 : 0.32;
  const minWidth = opening.type === "door" ? 0.72 : 0.92;
  const maxWidth = Math.max(minWidth, wallLength - margin * 2);
  const width = clamp(opening.width, minWidth, maxWidth);
  const maxOffset = Math.max(margin, wallLength - width - margin);
  const offset = clamp(opening.offset, margin, maxOffset);

  if (opening.type === "door") {
    return {
      ...opening,
      wallId: wall.id,
      width,
      offset,
      height: clamp(opening.height, 1.9, 2.4),
      verticalOffset: clamp(opening.verticalOffset ?? 0, 0, 0.42),
      sillHeight: undefined,
      isEntrance: Boolean(opening.isEntrance)
    };
  }

  return {
    ...opening,
    wallId: wall.id,
    width,
    offset,
    height: clamp(opening.height, 0.82, 2.1),
    verticalOffset: undefined,
    sillHeight: clamp(opening.sillHeight ?? 0.9, 0.25, 1.45),
    isEntrance: false
  };
}

function normalizeOpenings(openings: Opening[], walls: Wall[]) {
  const normalized = openings
    .map((opening) => sanitizeOpeningForWalls(opening, walls))
    .filter((opening): opening is Opening => Boolean(opening));
  return ensureSingleEntranceDoor(resolveWallOpeningOverlaps(normalized, walls));
}

function resolveWallOpeningOverlaps(openings: Opening[], walls: Wall[]) {
  const openingGap = 0.08;
  const byWall = new Map<string, Opening[]>();

  openings.forEach((opening) => {
    const entries = byWall.get(opening.wallId) ?? [];
    entries.push(opening);
    byWall.set(opening.wallId, entries);
  });

  const resolved: Opening[] = [];

  walls.forEach((wall) => {
    const wallOpenings = byWall.get(wall.id);
    if (!wallOpenings || wallOpenings.length === 0) return;
    const wallLength = getWallLength(wall);
    let cursor = -Infinity;

    [...wallOpenings]
      .sort((a, b) => a.offset - b.offset)
      .forEach((opening) => {
        const margin = opening.type === "door" ? 0.38 : 0.32;
        const minWidth = opening.type === "door" ? 0.72 : 0.92;
        let width = clamp(opening.width, minWidth, Math.max(minWidth, wallLength - margin * 2));
        const minStart = Math.max(margin, Number.isFinite(cursor) ? cursor + openingGap : margin);
        let maxStart = wallLength - width - margin;

        if (maxStart < minStart) {
          const fitWidth = wallLength - margin - minStart;
          if (fitWidth < minWidth) {
            return;
          }
          width = fitWidth;
          maxStart = minStart;
        }

        const offset = clamp(opening.offset, minStart, maxStart);
        cursor = offset + width;
        resolved.push({
          ...opening,
          width,
          offset
        });
      });
  });

  return resolved;
}

function remapOpeningsToWalls(openings: Opening[], previousWalls: Wall[], nextWalls: Wall[]) {
  if (nextWalls.length === 0) return [];

  return openings.map((opening) => {
    const previousWall = previousWalls.find((wall) => wall.id === opening.wallId);
    const previousIndex = previousWall ? previousWalls.findIndex((wall) => wall.id === previousWall.id) : -1;
    const targetWall =
      (previousIndex >= 0 ? nextWalls[previousIndex] : null) ??
      nextWalls.find((wall) => wall.id === opening.wallId) ??
      nextWalls[0];

    if (!targetWall) return opening;

    const previousLength = Math.max(previousWall ? getWallLength(previousWall) : getWallLength(targetWall), 0.01);
    const nextLength = getWallLength(targetWall);

    return {
      ...opening,
      wallId: targetWall.id,
      offset: (opening.offset / previousLength) * nextLength
    };
  });
}

function tuneOpenings(
  openings: Opening[],
  walls: Wall[],
  options: {
    doorStyle: DoorStyle;
    windowStyle: WindowStyle;
    addSecondaryWindow: boolean;
  }
) {
  const tuned = openings.map((opening) => {
    if (opening.type === "door") {
      return {
        ...opening,
        width: getDoorWidthByStyle(options.doorStyle)
      };
    }

    return {
      ...opening,
      width: getWindowWidthByStyle(options.windowStyle)
    };
  });

  if (!options.addSecondaryWindow) {
    const windows = tuned.filter((opening) => opening.type === "window");
    if (windows.length <= 1) {
      return tuned;
    }
    const keepWindowId = windows[0]?.id;
    return tuned.filter((opening) => opening.type !== "window" || opening.id === keepWindowId);
  }

  const windowCount = tuned.filter((opening) => opening.type === "window").length;
  if (windowCount >= 2 || walls.length < 2) {
    return tuned;
  }

  const primaryWindow = tuned.find((opening) => opening.type === "window");
  const secondaryWall =
    walls.find((wall) => wall.id !== primaryWindow?.wallId) ??
    walls[1] ??
    walls[0];

  if (!secondaryWall) {
    return tuned;
  }

  const wallLength = getWallLength(secondaryWall);
  const baseWidth = options.windowStyle === "wide" ? 2.2 : 1.6;
  const width = Math.min(baseWidth, Math.max(1.2, wallLength - 0.9));
  const margin = 0.36;

  tuned.push({
    id: createOpeningId("window"),
    wallId: secondaryWall.id,
    type: "window",
    offset: clamp(wallLength * 0.28, margin, Math.max(margin, wallLength - width - margin)),
    width,
    height: 1.3,
    sillHeight: 0.9
  });

  return tuned;
}

function buildPreviewDataUrl(
  points: Array<[number, number]>,
  openings: { type: "door" | "window"; wallId: string }[]
) {
  if (points.length === 0) {
    points = [
      [0, 0],
      [6, 0],
      [6, 4],
      [0, 4]
    ];
  }
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = 24;
  const width = 640;
  const height = 420;
  const scale = Math.min(
    (width - padding * 2) / Math.max(1, maxX - minX),
    (height - padding * 2) / Math.max(1, maxY - minY)
  );

  const toPoint = ([x, y]: [number, number]) => `${padding + (x - minX) * scale},${padding + (y - minY) * scale}`;
  const polyline = points.map(toPoint).join(" ");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" rx="28" fill="#f6f1e8" />
      <g opacity="0.25" stroke="#c7baa9">
        ${Array.from({ length: 10 })
          .map((_, index) => `<line x1="0" y1="${index * 42}" x2="${width}" y2="${index * 42}" />`)
          .join("")}
        ${Array.from({ length: 15 })
          .map((_, index) => `<line x1="${index * 42}" y1="0" x2="${index * 42}" y2="${height}" />`)
          .join("")}
      </g>
      <polygon points="${polyline}" fill="#fdfbf7" stroke="#181713" stroke-width="10" stroke-linejoin="round" />
      <g fill="#c96f3b">
        ${openings
          .map(
            (opening, index) =>
              `<circle cx="${72 + index * 28}" cy="${height - 42}" r="8" fill="${opening.type === "door" ? "#c96f3b" : "#6b8b9d"}" />`
          )
          .join("")}
      </g>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

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
  const [nookWidth, setNookWidth] = useState(2.8);
  const [nookDepth, setNookDepth] = useState(2.4);
  const [wallMaterialIndex, setWallMaterialIndex] = useState(0);
  const [floorMaterialIndex, setFloorMaterialIndex] = useState(0);
  const [doorStyle, setDoorStyle] = useState<DoorStyle>("single");
  const [windowStyle, setWindowStyle] = useState<WindowStyle>("single");
  const [addSecondaryWindow, setAddSecondaryWindow] = useState(false);
  const [openingDrafts, setOpeningDrafts] = useState<Opening[]>([]);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<BuilderPreviewMode>("builder-preview");
  const [stepIndex, setStepIndex] = useState(0);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [templateOptions, setTemplateOptions] = useState(builderTemplates);
  const [wallFinishOptions, setWallFinishOptions] = useState<BuilderFinishOption[]>([...builderWallFinishes]);
  const [floorFinishOptions, setFloorFinishOptions] = useState<BuilderFinishOption[]>([...builderFloorFinishes]);

  const { setScene, resetScene } = useShellStore();
  const { setEntranceId } = useCameraStore();
  const applyShellPreset = useEditorStore((state) => state.applyShellPreset);
  const resetShellState = useEditorStore((state) => state.resetShellState);
  const setViewMode = useEditorStore((state) => state.setViewMode);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextIntent = new URLSearchParams(window.location.search).get("intent") === "custom" ? "custom" : "template";
    setIntent(nextIntent);
    setProjectName((current) => {
      if (current === "새 공간 디자인" || current === "맞춤 공간 디자인") {
        return nextIntent === "custom" ? "맞춤 공간 디자인" : "새 공간 디자인";
      }
      return current;
    });
  }, []);

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

  const openingDraftsRef = useRef<Opening[]>([]);
  const previousWallSignatureRef = useRef<string | null>(null);
  const previousWallsRef = useRef<Wall[]>(baseScene.walls);

  const wallSignature = useMemo(
    () =>
      baseScene.walls
        .map(
          (wall) =>
            `${wall.id}:${wall.start[0].toFixed(3)},${wall.start[1].toFixed(3)}-${wall.end[0].toFixed(3)},${wall.end[1].toFixed(3)}`
        )
        .join("|"),
    [baseScene.walls]
  );

  useEffect(() => {
    openingDraftsRef.current = openingDrafts;
  }, [openingDrafts]);

  useEffect(() => {
    const wallSignatureChanged = previousWallSignatureRef.current !== wallSignature;
    if (!wallSignatureChanged) return;
    previousWallSignatureRef.current = wallSignature;
    const previousWalls = previousWallsRef.current;
    const hasDrafts = openingDraftsRef.current.length > 0;

    const sourceOpenings =
      hasDrafts && previousWalls.length > 0
        ? remapOpeningsToWalls(openingDraftsRef.current, previousWalls, baseScene.walls)
        : tuneOpenings(baseScene.openings, baseScene.walls, {
            doorStyle,
            windowStyle,
            addSecondaryWindow
          });

    const nextDrafts = normalizeOpenings(sourceOpenings, baseScene.walls);

    setOpeningDrafts(nextDrafts);
    setSelectedOpeningId((current) =>
      current && nextDrafts.some((opening) => opening.id === current)
        ? current
        : nextDrafts[0]?.id ?? null
    );
    setSelectedWallId((current) => {
      if (current && baseScene.walls.some((wall) => wall.id === current)) {
        return current;
      }
      return nextDrafts[0]?.wallId ?? baseScene.walls[0]?.id ?? null;
    });
    previousWallsRef.current = baseScene.walls;
  }, [addSecondaryWindow, baseScene.openings, baseScene.walls, doorStyle, wallSignature, windowStyle]);

  const openings = useMemo(
    () => normalizeOpenings(openingDrafts, baseScene.walls),
    [baseScene.walls, openingDrafts]
  );

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
        label: `Wall ${index + 1}`,
        length: getWallLength(wall)
      })),
    [scene.walls]
  );

  const selectedOpening = useMemo(
    () => openings.find((opening) => opening.id === selectedOpeningId) ?? null,
    [openings, selectedOpeningId]
  );

  const selectedOpeningWall = useMemo(
    () => scene.walls.find((wall) => wall.id === selectedOpening?.wallId) ?? null,
    [scene.walls, selectedOpening?.wallId]
  );

  const selectedWallOpenings = useMemo(
    () => openings.filter((opening) => opening.wallId === selectedWallId),
    [openings, selectedWallId]
  );

  useEffect(() => {
    if (!selectedOpeningId) return;
    const nextOpening = openings.find((opening) => opening.id === selectedOpeningId);
    if (!nextOpening) return;
    if (nextOpening.wallId !== selectedWallId) {
      setSelectedWallId(nextOpening.wallId);
    }
  }, [openings, selectedOpeningId, selectedWallId]);

  useEffect(() => {
    if (!selectedWallId) return;
    const selectedOnCurrentWall = selectedOpeningId
      ? openings.some((opening) => opening.id === selectedOpeningId && opening.wallId === selectedWallId)
      : false;
    if (selectedOnCurrentWall) return;
    setSelectedOpeningId(openings.find((opening) => opening.wallId === selectedWallId)?.id ?? null);
  }, [openings, selectedOpeningId, selectedWallId]);

  const previewDataUrl = useMemo(
    () => buildPreviewDataUrl(scene.floors[0]?.outline ?? [], scene.openings.map(({ type, wallId }) => ({ type, wallId }))),
    [scene.floors, scene.openings]
  );

  useEffect(() => {
    applyShellPreset("viewer", {
      viewMode: "builder-preview"
    });

    return () => {
      resetShellState();
      resetScene();
    };
  }, [applyShellPreset, resetScene, resetShellState]);

  useEffect(() => {
    setViewMode(previewMode);
  }, [previewMode, setViewMode]);

  useEffect(() => {
    setScene({
      scale: derivedRoomShell.scale,
      scaleInfo: derivedRoomShell.scaleInfo,
      walls: derivedRoomShell.walls,
      openings: derivedRoomShell.openings,
      floors: derivedRoomShell.floors,
      ceilings: derivedRoomShell.ceilings,
      rooms: derivedRoomShell.rooms,
      cameraAnchors: derivedRoomShell.cameraAnchors,
      navGraph: derivedRoomShell.navGraph,
      assets: [],
      wallMaterialIndex,
      floorMaterialIndex,
      lighting: {
        ambientIntensity: 0.35,
        hemisphereIntensity: 0.4,
        directionalIntensity: 1.05,
        environmentBlur: 0.2
      }
    });

    setEntranceId(derivedRoomShell.entranceId);
  }, [derivedRoomShell, floorMaterialIndex, setEntranceId, setScene, wallMaterialIndex]);

  const setOpeningPatch = useCallback(
    (openingId: string, patch: Partial<Opening>) => {
      setOpeningDrafts((current) =>
        normalizeOpenings(
          current.map((opening) =>
            opening.id === openingId
              ? {
                  ...opening,
                  ...patch
                }
              : opening
          ),
          baseScene.walls
        )
      );
    },
    [baseScene.walls]
  );

  const setEntranceOpening = useCallback(
    (openingId: string) => {
      setOpeningDrafts((current) =>
        normalizeOpenings(
          current.map((opening) =>
            opening.type === "door" ? { ...opening, isEntrance: opening.id === openingId } : opening
          ),
          baseScene.walls
        )
      );
    },
    [baseScene.walls]
  );

  const deleteOpening = useCallback(
    (openingId: string) => {
      setOpeningDrafts((current) =>
        normalizeOpenings(
          current.filter((opening) => opening.id !== openingId),
          baseScene.walls
        )
      );
      setSelectedOpeningId((current) => (current === openingId ? null : current));
    },
    [baseScene.walls]
  );

  const addOpening = useCallback(
    (type: "door" | "window") => {
      const targetWall =
        baseScene.walls.find((wall) => wall.id === selectedWallId) ??
        baseScene.walls[0];

      if (!targetWall) {
      toast.error("개구부를 배치할 벽이 없습니다.");
        return;
      }

      const wallLength = getWallLength(targetWall);
      const width =
        type === "door"
          ? getDoorWidthByStyle(doorStyle)
          : getWindowWidthByStyle(windowStyle);
      const minMargin = type === "door" ? 0.38 : 0.32;
      const clampedWidth = Math.min(width, Math.max(type === "door" ? 0.72 : 0.92, wallLength - minMargin * 2));
      const nextOpening: Opening = {
        id: createOpeningId(type),
        wallId: targetWall.id,
        type,
        offset: clamp(wallLength * 0.25, minMargin, Math.max(minMargin, wallLength - clampedWidth - minMargin)),
        width: clampedWidth,
        height: type === "door" ? 2.1 : 1.3,
        ...(type === "door" ? { isEntrance: openings.filter((opening) => opening.type === "door").length === 0 } : { sillHeight: 0.9 })
      };

      setOpeningDrafts((current) => normalizeOpenings([...current, nextOpening], baseScene.walls));
      setSelectedWallId(targetWall.id);
      setSelectedOpeningId(nextOpening.id);
    },
    [baseScene.walls, doorStyle, openings, selectedWallId, windowStyle]
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
    setStepIndex((value) => Math.min(BUILDER_STEPS.length - 1, value + 1));
  };

  const handleBack = () => {
    setStepIndex((value) => Math.max(0, value - 1));
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
              onStepChange={setStepIndex}
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
                  templateId={templateId}
                  width={width}
                  depth={depth}
                  nookWidth={nookWidth}
                  nookDepth={nookDepth}
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
                  onAddOpening={addOpening}
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
