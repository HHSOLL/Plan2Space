"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  DoorOpen,
  Paintbrush,
  Plus,
  Ruler,
  Sparkles,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { AuthPopup } from "../../../components/overlay/AuthPopup";
import { SceneViewport } from "../../../components/editor/SceneViewport";
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
import { useSceneStore, type Opening, type Wall } from "../../../lib/stores/useSceneStore";
import { useEditorStore, type EditorViewMode } from "../../../lib/stores/useEditorStore";

type BuilderStep = {
  label: string;
  title: string;
  description: string;
};

type DoorStyle = "single" | "double" | "french";
type WindowStyle = "single" | "wide";
type BuilderPreviewMode = Extract<EditorViewMode, "top" | "builder-preview">;

const BUILDER_STEPS: BuilderStep[] = [
  {
    label: "1/4",
    title: "Choose room shape",
    description: "Select a shell template first. You can fine-tune dimensions in the next step."
  },
  {
    label: "2/4",
    title: "Set dimensions",
    description: "Adjust width, depth, and niche values to match your room envelope."
  },
  {
    label: "3/4",
    title: "Author openings",
    description: "Place doors and windows wall-by-wall. Tune offsets, widths, and heights directly."
  },
  {
    label: "4/4",
    title: "Pick style and name",
    description: "Set finishes and name the room before entering the editor."
  }
];

const DOOR_STYLE_LABEL: Record<DoorStyle, string> = {
  single: "Single door",
  double: "Double door",
  french: "French door"
};

const WINDOW_STYLE_LABEL: Record<WindowStyle, string> = {
  single: "Single window",
  wide: "Wide window"
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

  const [projectName, setProjectName] = useState("Template Room");
  const [projectDescription, setProjectDescription] = useState("Builder-authored interior concept");
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

  const setScene = useSceneStore((state) => state.setScene);
  const resetScene = useSceneStore((state) => state.resetScene);
  const applyShellPreset = useEditorStore((state) => state.applyShellPreset);
  const resetShellState = useEditorStore((state) => state.resetShellState);
  const setViewMode = useEditorStore((state) => state.setViewMode);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextIntent = new URLSearchParams(window.location.search).get("intent") === "custom" ? "custom" : "template";
    setIntent(nextIntent);
    setProjectName((current) => {
      if (current === "Template Room" || current === "Custom Room") {
        return nextIntent === "custom" ? "Custom Room" : "Template Room";
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

    useSceneStore.setState({
      entranceId: derivedRoomShell.entranceId
    });
  }, [derivedRoomShell, floorMaterialIndex, setScene, wallMaterialIndex]);

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
        toast.error("No wall available for opening placement.");
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
      toast.error("Project name is required.");
      return;
    }

    setIsCreating(true);
    try {
      const project = await createProjectDraft({
        name: projectName.trim(),
        description: projectDescription.trim() || "Builder-authored interior concept"
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
        projectDescription: projectDescription.trim() || "Builder-authored interior concept",
        message: "Builder starter scene"
      });

      router.push(`/project/${project.id}?origin=builder`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create room.");
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
            Back to Projects
          </button>
          <div className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7a6f64]">
            {intent === "template" ? "Template Quick Start" : "Custom Builder"}
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
          <aside className="rounded-[30px] border border-black/10 bg-white/78 p-6 shadow-[0_22px_60px_rgba(68,52,34,0.12)] backdrop-blur sm:p-8">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
              <Sparkles className="h-4 w-4" />
              Guided room builder
            </div>
            <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">{activeStep.label}</div>
            <h1 className="mt-2 font-cormorant text-4xl font-light text-[#1b1510]">{activeStep.title}</h1>
            <p className="mt-3 text-sm leading-7 text-[#5c5044]">{activeStep.description}</p>

            <div className="mt-6 grid grid-cols-4 gap-2">
              {BUILDER_STEPS.map((step, index) => (
                <button
                  key={step.label}
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={`rounded-full border px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.2em] transition ${
                    stepIndex === index
                      ? "border-[#1b1510] bg-[#1b1510] text-white"
                      : index < stepIndex
                        ? "border-[#1b1510]/20 bg-[#efe8de] text-[#3c3228]"
                        : "border-black/10 bg-white text-[#7d6f61]"
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <div className="mt-8 space-y-6">
              {stepIndex === 0 ? (
                <div className="space-y-3">
                  {templateOptions.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleTemplateSelect(template.id)}
                      className={`w-full rounded-[22px] border px-5 py-5 text-left transition ${
                        templateId === template.id
                          ? "border-black/30 bg-[#f2ebe2]"
                          : "border-black/10 bg-[#fbf8f3] hover:border-black/30"
                      }`}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#887a6d]">
                        {template.eyebrow}
                      </div>
                      <div className="mt-2 font-cormorant text-3xl font-light text-[#1d1611]">{template.name}</div>
                      <p className="mt-2 text-sm leading-6 text-[#5a4f44]">{template.description}</p>
                    </button>
                  ))}
                </div>
              ) : null}

              {stepIndex === 1 ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                      <span>Room width</span>
                      <span>{width.toFixed(1)} m</span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={10}
                      step={0.2}
                      value={width}
                      onChange={(event) => setWidth(Number(event.target.value))}
                      className="mt-3 w-full"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                      <span>Room depth</span>
                      <span>{depth.toFixed(1)} m</span>
                    </div>
                    <input
                      type="range"
                      min={3.6}
                      max={8}
                      step={0.2}
                      value={depth}
                      onChange={(event) => setDepth(Number(event.target.value))}
                      className="mt-3 w-full"
                    />
                  </div>

                  {templateId === "corner-suite" ? (
                    <>
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                          <span>Nook width</span>
                          <span>{nookWidth.toFixed(1)} m</span>
                        </div>
                        <input
                          type="range"
                          min={1.6}
                          max={4}
                          step={0.1}
                          value={nookWidth}
                          onChange={(event) => setNookWidth(Number(event.target.value))}
                          className="mt-3 w-full"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                          <span>Nook depth</span>
                          <span>{nookDepth.toFixed(1)} m</span>
                        </div>
                        <input
                          type="range"
                          min={1.4}
                          max={3.6}
                          step={0.1}
                          value={nookDepth}
                          onChange={(event) => setNookDepth(Number(event.target.value))}
                          className="mt-3 w-full"
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {stepIndex === 2 ? (
                <div className="space-y-5">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                      Door default (new doors)
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(Object.keys(DOOR_STYLE_LABEL) as DoorStyle[]).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setDoorStyle(style)}
                          className={`rounded-full border px-4 py-2 text-[11px] font-semibold transition ${
                            doorStyle === style
                              ? "border-black bg-black text-white"
                              : "border-black/10 bg-[#fcfaf6] text-[#51483f] hover:border-black/30"
                          }`}
                        >
                          {DOOR_STYLE_LABEL[style]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                      Window default (new windows)
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(Object.keys(WINDOW_STYLE_LABEL) as WindowStyle[]).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setWindowStyle(style)}
                          className={`rounded-full border px-4 py-2 text-[11px] font-semibold transition ${
                            windowStyle === style
                              ? "border-black bg-black text-white"
                              : "border-black/10 bg-[#fcfaf6] text-[#51483f] hover:border-black/30"
                          }`}
                        >
                          {WINDOW_STYLE_LABEL[style]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-3 rounded-[18px] border border-black/10 bg-[#fbf8f3] px-4 py-3 text-sm text-[#53483d]">
                    <input
                      type="checkbox"
                      checked={addSecondaryWindow}
                      onChange={(event) => setAddSecondaryWindow(event.target.checked)}
                      className="h-4 w-4 rounded border-black/20"
                    />
                    Include second window in fresh template defaults
                  </label>
                  <p className="-mt-2 text-xs text-[#75695d]">Existing openings remain unchanged when you switch defaults.</p>

                  <div className="rounded-[20px] border border-black/10 bg-[#faf7f1] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">Wall targeting</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => addOpening("door")}
                          className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2f251d]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Door
                        </button>
                        <button
                          type="button"
                          onClick={() => addOpening("window")}
                          className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2f251d]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Window
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {wallEntries.map((wall) => (
                        <button
                          key={wall.id}
                          type="button"
                          onClick={() => setSelectedWallId(wall.id)}
                          className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                            selectedWallId === wall.id
                              ? "border-black bg-black text-white"
                              : "border-black/10 bg-white text-[#574c41] hover:border-black/25"
                          }`}
                        >
                          {wall.label} · {wall.length.toFixed(2)}m
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 space-y-2">
                      {selectedWallOpenings.length > 0 ? (
                        selectedWallOpenings.map((opening) => (
                          <button
                            key={opening.id}
                            type="button"
                            onClick={() => setSelectedOpeningId(opening.id)}
                            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                              selectedOpeningId === opening.id
                                ? "border-black/25 bg-white"
                                : "border-black/10 bg-[#fcfaf6] hover:border-black/20"
                            }`}
                          >
                            <span className="font-medium text-[#30261d]">
                              {opening.type === "door" ? "Door" : "Window"} · {opening.id.replace("opening-", "")}
                            </span>
                            <span className="text-[#6e6256]">{opening.width.toFixed(2)}m</span>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-[#6e6256]">No openings on this wall yet.</p>
                      )}
                    </div>
                  </div>

                  {selectedOpening ? (
                    <div className="rounded-[20px] border border-black/10 bg-[#faf7f1] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">Selected opening</div>
                        <button
                          type="button"
                          onClick={() => deleteOpening(selectedOpening.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-red-900/20 bg-red-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-800"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3">
                        <label className="space-y-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b7f72]">
                          Opening wall
                          <select
                            value={selectedOpening.wallId}
                            onChange={(event) => {
                              const wallId = event.target.value;
                              setSelectedWallId(wallId);
                              setOpeningPatch(selectedOpening.id, { wallId });
                            }}
                            className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm font-medium text-[#30261d]"
                          >
                            {wallEntries.map((wall) => (
                              <option key={wall.id} value={wall.id}>
                                {wall.label} ({wall.length.toFixed(2)}m)
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b7f72]">
                          Width · {selectedOpening.width.toFixed(2)}m
                          <input
                            type="range"
                            min={selectedOpening.type === "door" ? 0.72 : 0.92}
                            max={Math.max(
                              selectedOpening.type === "door" ? 0.72 : 0.92,
                              (selectedOpeningWall ? getWallLength(selectedOpeningWall) : 1) - 0.64
                            )}
                            step={0.01}
                            value={selectedOpening.width}
                            onChange={(event) => setOpeningPatch(selectedOpening.id, { width: Number(event.target.value) })}
                            className="w-full"
                          />
                        </label>

                        <label className="space-y-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b7f72]">
                          Offset · {selectedOpening.offset.toFixed(2)}m
                          <input
                            type="range"
                            min={0.3}
                            max={Math.max(
                              0.3,
                              (selectedOpeningWall ? getWallLength(selectedOpeningWall) : 1) - selectedOpening.width - 0.3
                            )}
                            step={0.01}
                            value={selectedOpening.offset}
                            onChange={(event) => setOpeningPatch(selectedOpening.id, { offset: Number(event.target.value) })}
                            className="w-full"
                          />
                        </label>

                        <label className="space-y-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b7f72]">
                          Height · {selectedOpening.height.toFixed(2)}m
                          <input
                            type="range"
                            min={selectedOpening.type === "door" ? 1.9 : 0.82}
                            max={selectedOpening.type === "door" ? 2.4 : 2.1}
                            step={0.01}
                            value={selectedOpening.height}
                            onChange={(event) => setOpeningPatch(selectedOpening.id, { height: Number(event.target.value) })}
                            className="w-full"
                          />
                        </label>

                        {selectedOpening.type === "window" ? (
                          <label className="space-y-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b7f72]">
                            Sill height · {(selectedOpening.sillHeight ?? 0.9).toFixed(2)}m
                            <input
                              type="range"
                              min={0.25}
                              max={1.45}
                              step={0.01}
                              value={selectedOpening.sillHeight ?? 0.9}
                              onChange={(event) =>
                                setOpeningPatch(selectedOpening.id, { sillHeight: Number(event.target.value) })
                              }
                              className="w-full"
                            />
                          </label>
                        ) : (
                          <div className="space-y-3">
                            <label className="space-y-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b7f72]">
                              Door rise · {(selectedOpening.verticalOffset ?? 0).toFixed(2)}m
                              <input
                                type="range"
                                min={0}
                                max={0.42}
                                step={0.01}
                                value={selectedOpening.verticalOffset ?? 0}
                                onChange={(event) =>
                                  setOpeningPatch(selectedOpening.id, { verticalOffset: Number(event.target.value) })
                                }
                                className="w-full"
                              />
                            </label>

                            <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-[#3f3429]">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedOpening.isEntrance)}
                                onChange={() => setEntranceOpening(selectedOpening.id)}
                                className="h-4 w-4 rounded border-black/20"
                              />
                              Mark as entrance door
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {stepIndex === 3 ? (
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                      Project name
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      className="mt-3 w-full rounded-[18px] border border-black/10 bg-[#fcfaf6] px-4 py-4 text-sm outline-none transition focus:border-black/40"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                      Description
                    </label>
                    <textarea
                      value={projectDescription}
                      onChange={(event) => setProjectDescription(event.target.value)}
                      rows={4}
                      className="mt-3 w-full rounded-[18px] border border-black/10 bg-[#fcfaf6] px-4 py-4 text-sm outline-none transition focus:border-black/40"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">Wall finish</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {wallFinishOptions.map((finish) => (
                        <button
                          key={finish.id}
                          type="button"
                          onClick={() => setWallMaterialIndex(finish.id)}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                            wallMaterialIndex === finish.id
                              ? "border-black/30 bg-[#f2ebe2]"
                              : "border-black/10 bg-[#fcfaf6] hover:border-black/25"
                          }`}
                        >
                          <span
                            className="h-7 w-7 rounded-md border border-black/10"
                            style={{ background: WALL_FINISH_SWATCH[finish.id] ?? "#ece6dc" }}
                          />
                          <span className="text-sm font-semibold text-[#3a3026]">{finish.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">Floor finish</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {floorFinishOptions.map((finish) => (
                        <button
                          key={finish.id}
                          type="button"
                          onClick={() => setFloorMaterialIndex(finish.id)}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                            floorMaterialIndex === finish.id
                              ? "border-black/30 bg-[#f2ebe2]"
                              : "border-black/10 bg-[#fcfaf6] hover:border-black/25"
                          }`}
                        >
                          <span
                            className="h-7 w-7 rounded-md border border-black/10"
                            style={{ background: FLOOR_FINISH_SWATCH[finish.id] ?? "#b79d7e" }}
                          />
                          <span className="text-sm font-semibold text-[#3a3026]">{finish.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-8 flex items-center gap-3 border-t border-black/10 pt-6">
              <button
                type="button"
                onClick={handleBack}
                disabled={stepIndex === 0}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-black/15 bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2e251d] transition disabled:opacity-35"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={isCreating}
                className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-full bg-[#11100e] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFinalStep ? (isCreating ? "Creating room..." : "Create room and open editor") : "Next"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </aside>

          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[30px] border border-black/10 bg-white/72 p-4 shadow-[0_24px_70px_rgba(68,52,34,0.12)] backdrop-blur sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">Live preview</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode("builder-preview")}
                  className={`rounded-full border px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${
                    previewMode === "builder-preview"
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-[#f5efe5] text-[#5f5448]"
                  }`}
                >
                  Perspective
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("top")}
                  className={`rounded-full border px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${
                    previewMode === "top"
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-[#f5efe5] text-[#5f5448]"
                  }`}
                >
                  Plan
                </button>
                <div className="rounded-full border border-black/10 bg-[#f5efe5] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#5f5448]">
                  {activeTemplate.name}
                </div>
              </div>
            </div>

            <div className="relative mt-3 overflow-hidden rounded-[24px] border border-black/10 bg-[#d7d7d3]">
              <SceneViewport
                className="h-[58vh] rounded-none border-0 shadow-none"
                camera={{ fov: 46, position: [8, 5, 8] }}
                toneMappingExposure={1.02}
                chromeTone="light"
                showHud={false}
                modeBadge={previewMode === "top" ? "Plan preview" : "3D preview"}
              />
              <div className="pointer-events-none absolute inset-y-0 right-4 z-[24] hidden items-center md:flex">
                <div className="flex flex-col overflow-hidden rounded-full border border-black/10 bg-white/92 shadow-[0_10px_26px_rgba(19,21,24,0.14)]">
                  <button
                    type="button"
                    onClick={() => triggerZoomControl("in")}
                    className="pointer-events-auto px-4 py-3 text-center text-sm font-bold text-[#393229] transition hover:bg-[#f2eee7]"
                    aria-label="Zoom in preview"
                  >
                    +
                  </button>
                  <div className="h-px w-full bg-black/10" />
                  <button
                    type="button"
                    onClick={() => triggerZoomControl("out")}
                    className="pointer-events-auto px-4 py-3 text-center text-sm font-bold text-[#393229] transition hover:bg-[#f2eee7]"
                    aria-label="Zoom out preview"
                  >
                    -
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] border border-black/10 bg-[#fbf8f2] p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#887a6d]">Footprint</div>
                <div className="mt-2 text-2xl font-cormorant">{width.toFixed(1)}m × {depth.toFixed(1)}m</div>
              </div>
              <div className="rounded-[20px] border border-black/10 bg-[#fbf8f2] p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#887a6d]">Openings</div>
                <div className="mt-2 text-2xl font-cormorant">{scene.openings.length}</div>
              </div>
              <div className="rounded-[20px] border border-black/10 bg-[#fbf8f2] p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#887a6d]">Status</div>
                <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#2f251d]">
                  <CheckCircle2 className="h-4 w-4" />
                  Step {stepIndex + 1} active
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[24px] bg-[#1e1915] p-5 text-[#f2e8dc]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d4b99f]">Builder summary</div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="inline-flex items-center gap-2 text-[#ccbaaa]"><Ruler className="h-4 w-4" /> Dimensions</span>
                  <span>{width.toFixed(1)}m × {depth.toFixed(1)}m</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="inline-flex items-center gap-2 text-[#ccbaaa]"><DoorOpen className="h-4 w-4" /> Openings</span>
                  <span>{scene.openings.filter((opening) => opening.type === "door").length} doors / {scene.openings.filter((opening) => opening.type === "window").length} windows</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-[#ccbaaa]"><Paintbrush className="h-4 w-4" /> Finishes</span>
                  <span>{activeWallFinish.name} / {activeFloorFinish.name}</span>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </div>

      <AuthPopup
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        nextPath={`/studio/builder?intent=${intent}`}
      />
    </div>
  );
}
