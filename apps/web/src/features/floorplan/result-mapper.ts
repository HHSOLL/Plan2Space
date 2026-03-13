import type { Floor, Opening, ScaleInfo, Wall } from "../../lib/stores/useSceneStore";
import type { FloorplanResultResponse, LayoutRevisionResponse } from "./upload";

const SYNTHETIC_PX_PER_MM = 0.1;
const SYNTHETIC_SCALE_METERS_PER_PIXEL = 0.001 / SYNTHETIC_PX_PER_MM;
const DEFAULT_WALL_HEIGHT_METERS = 2.8;
const SYNTHETIC_CANVAS_PADDING = 72;

export type MappedSceneResult = {
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
  scale: number;
  scaleInfo: ScaleInfo;
  diagnostics?: Record<string, unknown>;
};

const toStringValue = (value: unknown, fallback: string) =>
  typeof value === "string" && value.length > 0 ? value : fallback;

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

function getPolygonPoints(value: unknown): [number, number][] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((point) => toVec2(point, [Number.NaN, Number.NaN]))
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const polygon = record.polygon ?? record.points ?? record.outline ?? record.vertices;
    return getPolygonPoints(polygon);
  }
  return [];
}

function mapRoomPolygonsToFloors(roomPolygons: unknown[]): Floor[] {
  return roomPolygons
    .map((room, index) => {
      const polygon = getPolygonPoints(room);
      if (polygon.length < 3) return null;
      const record = room && typeof room === "object" && !Array.isArray(room) ? (room as Record<string, unknown>) : {};
      return {
        id: toStringValue(record.id, `floor-${index + 1}`),
        outline: polygon,
        materialId: null
      };
    })
    .filter((room): room is Floor => Boolean(room));
}

export function mapFloorplanResultToScene(result: FloorplanResultResponse): MappedSceneResult {
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
          height: toNumberValue(wall.height, DEFAULT_WALL_HEIGHT_METERS),
          type: toWallType(wall.type),
          isPartOfBalcony: Boolean(wall.isPartOfBalcony),
          confidence: typeof wall.confidence === "number" ? wall.confidence : undefined
        }))
      : result.wallCoordinates.map((wall, index) => ({
          id: toStringValue(wall.id, `w${index + 1}`),
          start: toVec2(wall.start, [0, 0]),
          end: toVec2(wall.end, [0, 0]),
          thickness: toNumberValue(wall.thickness, 12),
          height: DEFAULT_WALL_HEIGHT_METERS,
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

  const floors = mapRoomPolygonsToFloors(result.roomPolygons);

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
    floors,
    scale: result.scale,
    scaleInfo,
    diagnostics: result.diagnostics
  };
}

function extractRevisionGeometry(revision: LayoutRevisionResponse) {
  const geometry = revision.geometry_json ?? {};
  const scaleRecord = (geometry.scale ?? {}) as Record<string, unknown>;
  const walls = Array.isArray((geometry as { walls?: unknown }).walls)
    ? (((geometry as { walls?: unknown }).walls ?? []) as Record<string, unknown>[])
    : [];
  const openings = Array.isArray((geometry as { openings?: unknown }).openings)
    ? (((geometry as { openings?: unknown }).openings ?? []) as Record<string, unknown>[])
    : [];
  const rooms = Array.isArray((geometry as { rooms?: unknown }).rooms)
    ? (((geometry as { rooms?: unknown }).rooms ?? []) as Record<string, unknown>[])
    : [];

  return {
    walls,
    openings,
    rooms,
    scale: {
      metersPerPixel: toNumberValue(scaleRecord.metersPerPixel, SYNTHETIC_SCALE_METERS_PER_PIXEL),
      source: toStringValue(scaleRecord.source, "unknown"),
      confidence: toNumberValue(scaleRecord.confidence, 0)
    }
  };
}

function measureBounds(points: Array<[number, number]>) {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  }
  return points.reduce(
    (accumulator, [x, y]) => ({
      minX: Math.min(accumulator.minX, x),
      minY: Math.min(accumulator.minY, y),
      maxX: Math.max(accumulator.maxX, x),
      maxY: Math.max(accumulator.maxY, y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );
}

function mmPointToSyntheticPx(
  pointMm: [number, number],
  offset: { x: number; y: number }
): [number, number] {
  return [
    Math.round(pointMm[0] * SYNTHETIC_PX_PER_MM + offset.x),
    Math.round(pointMm[1] * SYNTHETIC_PX_PER_MM + offset.y)
  ];
}

export function mapLayoutRevisionToScene(revision: LayoutRevisionResponse): MappedSceneResult {
  const extracted = extractRevisionGeometry(revision);
  const pointCloud: Array<[number, number]> = [
    ...extracted.walls.flatMap((wall) => [
      toVec2(wall.startMm, [0, 0]),
      toVec2(wall.endMm, [0, 0])
    ]),
    ...extracted.rooms.flatMap((room) => getPolygonPoints(room.polygonMm ?? room.polygon))
  ];

  const bounds = measureBounds(pointCloud);
  const offset = {
    x: SYNTHETIC_CANVAS_PADDING - bounds.minX * SYNTHETIC_PX_PER_MM,
    y: SYNTHETIC_CANVAS_PADDING - bounds.minY * SYNTHETIC_PX_PER_MM
  };

  const walls: Wall[] = extracted.walls.map((wall, index) => ({
    id: toStringValue(wall.id, `rev-wall-${index + 1}`),
    start: mmPointToSyntheticPx(toVec2(wall.startMm, [0, 0]), offset),
    end: mmPointToSyntheticPx(toVec2(wall.endMm, [0, 0]), offset),
    thickness: Math.max(6, toNumberValue(wall.thicknessMm, 180) * SYNTHETIC_PX_PER_MM),
    height: DEFAULT_WALL_HEIGHT_METERS,
    type: toWallType(wall.type),
    isPartOfBalcony: Boolean(wall.isPartOfBalcony),
    confidence: typeof wall.confidence === "number" ? wall.confidence : undefined
  }));

  const openings: Opening[] = extracted.openings.map((opening, index) => ({
    id: toStringValue(opening.id, `rev-opening-${index + 1}`),
    wallId: toStringValue(opening.wallId, ""),
    type: opening.type === "window" ? "window" : "door",
    offset: Math.max(0, toNumberValue(opening.offsetMm, 0) * SYNTHETIC_PX_PER_MM),
    width: Math.max(12, toNumberValue(opening.widthMm, opening.type === "window" ? 1200 : 900) * SYNTHETIC_PX_PER_MM),
    height: Math.max(60, toNumberValue(opening.heightMm, opening.type === "window" ? 1200 : 2100) * SYNTHETIC_PX_PER_MM),
    isEntrance: Boolean(opening.isEntrance),
    detectConfidence: typeof opening.detectConfidence === "number" ? opening.detectConfidence : undefined,
    attachConfidence: typeof opening.attachConfidence === "number" ? opening.attachConfidence : undefined,
    typeConfidence: typeof opening.typeConfidence === "number" ? opening.typeConfidence : undefined
  }));

  const floors: Floor[] = extracted.rooms
    .map((room, index) => {
      const polygonMm = getPolygonPoints(room.polygonMm ?? room.polygon);
      if (polygonMm.length < 3) return null;
      return {
        id: toStringValue(room.id, `rev-floor-${index + 1}`),
        outline: polygonMm.map((point) => mmPointToSyntheticPx(point, offset)),
        materialId: null
      };
    })
    .filter((room): room is Floor => Boolean(room));

  return {
    walls,
    openings,
    floors,
    scale: SYNTHETIC_SCALE_METERS_PER_PIXEL,
    scaleInfo: {
      value: SYNTHETIC_SCALE_METERS_PER_PIXEL,
      source:
        extracted.scale.source === "ocr_dimension" ||
        extracted.scale.source === "door_heuristic" ||
        extracted.scale.source === "user_measure"
          ? extracted.scale.source
          : "unknown",
      confidence: extracted.scale.confidence,
      evidence: {
        notes: `Imported from layout revision ${revision.id} geometry in millimeters.`
      }
    },
    diagnostics: {
      layoutRevisionId: revision.id,
      geometryHash: revision.geometry_hash,
      topologyHash: revision.topology_hash ?? null,
      roomGraphHash: revision.room_graph_hash ?? null
    }
  };
}

function measureSceneBounds(walls: Wall[], floors: Floor[]) {
  const points: Array<[number, number]> = [
    ...walls.flatMap((wall) => [wall.start, wall.end]),
    ...floors.flatMap((floor) => floor.outline)
  ];
  return measureBounds(points);
}

export function buildSyntheticFloorplanPreview(scene: Pick<MappedSceneResult, "walls" | "openings" | "floors">) {
  if (typeof document === "undefined") return null;

  const bounds = measureSceneBounds(scene.walls, scene.floors);
  const width = Math.max(640, Math.ceil(bounds.maxX - bounds.minX + SYNTHETIC_CANVAS_PADDING * 2));
  const height = Math.max(480, Math.ceil(bounds.maxY - bounds.minY + SYNTHETIC_CANVAS_PADDING * 2));
  const offsetX = SYNTHETIC_CANVAS_PADDING - bounds.minX;
  const offsetY = SYNTHETIC_CANVAS_PADDING - bounds.minY;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#f7f6f1";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  scene.floors.forEach((floor) => {
    if (floor.outline.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(floor.outline[0]![0] + offsetX, floor.outline[0]![1] + offsetY);
    for (let index = 1; index < floor.outline.length; index += 1) {
      ctx.lineTo(floor.outline[index]![0] + offsetX, floor.outline[index]![1] + offsetY);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(197, 160, 76, 0.18)";
    ctx.fill();
  });

  scene.walls.forEach((wall) => {
    ctx.beginPath();
    ctx.moveTo(wall.start[0] + offsetX, wall.start[1] + offsetY);
    ctx.lineTo(wall.end[0] + offsetX, wall.end[1] + offsetY);
    ctx.strokeStyle = wall.type === "exterior" ? "#111111" : wall.type === "balcony" ? "#7c5a1f" : "#2f2f2f";
    ctx.lineWidth = Math.max(2, wall.thickness);
    ctx.lineCap = "round";
    ctx.stroke();
  });

  scene.openings.forEach((opening) => {
    const wall = scene.walls.find((candidate) => candidate.id === opening.wallId);
    if (!wall) return;
    const dx = wall.end[0] - wall.start[0];
    const dy = wall.end[1] - wall.start[1];
    const length = Math.hypot(dx, dy) || 1;
    const startX = wall.start[0] + (dx / length) * opening.offset;
    const startY = wall.start[1] + (dy / length) * opening.offset;
    const endX = startX + (dx / length) * opening.width;
    const endY = startY + (dy / length) * opening.width;

    ctx.beginPath();
    ctx.moveTo(startX + offsetX, startY + offsetY);
    ctx.lineTo(endX + offsetX, endY + offsetY);
    ctx.strokeStyle = opening.type === "window" ? "#4c8cf0" : opening.isEntrance ? "#0f766e" : "#ffffff";
    ctx.lineWidth = Math.max(4, wall.thickness * 0.6);
    ctx.stroke();
  });

  return canvas.toDataURL("image/png");
}
