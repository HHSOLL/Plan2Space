import type { Opening, ScaleInfo, Wall } from "../../lib/stores/useSceneStore";

export type FloorplanResultResponse = {
  floorplanId: string;
  wallCoordinates: Array<{
    id?: string;
    start?: [number, number];
    end?: [number, number];
    thickness?: number;
    type?: "exterior" | "interior" | "balcony" | "column";
    length?: number;
    confidence?: number;
  }>;
  roomPolygons: unknown[];
  scale: number;
  sceneJson?: Record<string, unknown>;
  diagnostics?: Record<string, unknown>;
};

const toStringValue = (value: unknown, fallback: string) => (typeof value === "string" && value.length > 0 ? value : fallback);
const toNumberValue = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toVec2 = (value: unknown, fallback: [number, number]): [number, number] => {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return [x, y];
    }
  }
  return fallback;
};

const toWallType = (value: unknown): Wall["type"] => {
  if (value === "exterior" || value === "interior" || value === "balcony" || value === "column") {
    return value;
  }
  return "interior";
};

export function mapFloorplanResultToScene(result: FloorplanResultResponse): {
  walls: Wall[];
  openings: Opening[];
  scale: number;
  scaleInfo: ScaleInfo;
  diagnostics?: Record<string, unknown>;
} {
  const sceneJson = result.sceneJson ?? {};
  const sceneWalls = Array.isArray((sceneJson as { walls?: unknown }).walls)
    ? (((sceneJson as { walls?: unknown }).walls ?? []) as Record<string, unknown>[])
    : [];
  const sceneOpenings = Array.isArray((sceneJson as { openings?: unknown }).openings)
    ? (((sceneJson as { openings?: unknown }).openings ?? []) as Record<string, unknown>[])
    : [];

  const walls: Wall[] =
    sceneWalls.length > 0
      ? sceneWalls.map((wall, index) => ({
          id: toStringValue(wall.id, `w${index + 1}`),
          start: toVec2(wall.start ?? wall.a, [0, 0]),
          end: toVec2(wall.end ?? wall.b, [0, 0]),
          thickness: toNumberValue(wall.thickness, 12),
          height: toNumberValue(wall.height, 2.8),
          type: toWallType(wall.type),
          isPartOfBalcony: Boolean(wall.isPartOfBalcony),
          confidence: typeof wall.confidence === "number" ? wall.confidence : undefined
        }))
      : result.wallCoordinates.map((wall, index) => ({
          id: toStringValue(wall.id, `w${index + 1}`),
          start: toVec2(wall.start, [0, 0]),
          end: toVec2(wall.end, [0, 0]),
          thickness: toNumberValue(wall.thickness, 12),
          height: 2.8,
          type: wall.type ?? "interior",
          isPartOfBalcony: wall.type === "balcony",
          confidence: typeof wall.confidence === "number" ? wall.confidence : undefined
        }));

  const openings: Opening[] = sceneOpenings.map((opening, index) => ({
    id: toStringValue(opening.id, `o${index + 1}`),
    wallId: toStringValue(opening.wallId, ""),
    type: opening.type === "window" ? "window" : "door",
    offset: toNumberValue(opening.offset, 0),
    width: toNumberValue(opening.width, 90),
    height: toNumberValue(opening.height, 210),
    verticalOffset: typeof opening.verticalOffset === "number" ? opening.verticalOffset : undefined,
    sillHeight: typeof opening.sillHeight === "number" ? opening.sillHeight : undefined,
    isEntrance: Boolean(opening.isEntrance),
    detectConfidence: typeof opening.detectConfidence === "number" ? opening.detectConfidence : undefined,
    attachConfidence: typeof opening.attachConfidence === "number" ? opening.attachConfidence : undefined,
    typeConfidence: typeof opening.typeConfidence === "number" ? opening.typeConfidence : undefined
  }));

  const scaleInfo = ((sceneJson as { scaleInfo?: ScaleInfo }).scaleInfo ??
    ({
      value: result.scale,
      source: "unknown",
      confidence: 0,
      evidence: {
        notes: "Scale source not provided by worker."
      }
    } as const)) as ScaleInfo;

  return {
    walls,
    openings,
    scale: result.scale,
    scaleInfo,
    diagnostics: result.diagnostics
  };
}
