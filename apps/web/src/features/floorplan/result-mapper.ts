import type {
  CameraAnchor,
  Ceiling,
  Floor,
  NavGraph,
  RoomType,
  RoomZone,
  ScaleInfo,
  Wall,
  Opening
} from "../../lib/stores/useSceneStore";
import type { FloorplanResultResponse, LayoutRevisionResponse } from "./upload";

const SYNTHETIC_PX_PER_MM = 0.1;
const SYNTHETIC_SCALE_METERS_PER_PIXEL = 0.001 / SYNTHETIC_PX_PER_MM;
const DEFAULT_WALL_HEIGHT_METERS = 2.8;
const SYNTHETIC_CANVAS_PADDING = 72;

export type MappedSceneResult = {
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
  ceilings: Ceiling[];
  rooms: RoomZone[];
  cameraAnchors: CameraAnchor[];
  navGraph: NavGraph;
  scale: number;
  scaleInfo: ScaleInfo;
  entranceId: string | null;
  diagnostics?: Record<string, unknown>;
};

const ROOM_TYPES: RoomType[] = [
  "living_room",
  "bedroom",
  "kitchen",
  "dining",
  "bathroom",
  "foyer",
  "corridor",
  "balcony",
  "utility",
  "pantry",
  "dress_room",
  "alpha_room",
  "service_area",
  "evacuation_space",
  "other"
];

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

const toRoomType = (value: unknown): RoomType =>
  typeof value === "string" && ROOM_TYPES.includes(value as RoomType) ? (value as RoomType) : "other";

const toUsage = (value: unknown): RoomZone["estimatedUsage"] =>
  value === "primary" || value === "secondary" || value === "service" ? value : "secondary";

function getArrayRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function getPolygonPoints(value: unknown): [number, number][] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((point) => toVec2(point, [Number.NaN, Number.NaN]))
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return getPolygonPoints(record.polygon ?? record.points ?? record.outline ?? record.vertices);
  }
  return [];
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

function measureSceneBounds(walls: Wall[], floors: Floor[], rooms: RoomZone[]) {
  const points: Array<[number, number]> = [
    ...walls.flatMap((wall) => [wall.start, wall.end]),
    ...floors.flatMap((floor) => floor.outline),
    ...rooms.flatMap((room) => room.polygon)
  ];
  return measureBounds(points);
}

function toRoomLabel(roomType: RoomType, label?: unknown) {
  if (typeof label === "string" && label.trim().length > 0) return label;
  switch (roomType) {
    case "living_room":
      return "Living Room";
    case "bedroom":
      return "Bedroom";
    case "kitchen":
      return "Kitchen";
    case "dining":
      return "Dining";
    case "bathroom":
      return "Bathroom";
    case "foyer":
      return "Foyer";
    case "corridor":
      return "Corridor";
    case "balcony":
      return "Balcony";
    case "utility":
      return "Utility";
    case "pantry":
      return "Pantry";
    case "dress_room":
      return "Dress Room";
    case "alpha_room":
      return "Alpha Room";
    case "service_area":
      return "Service Area";
    case "evacuation_space":
      return "Evacuation Space";
    default:
      return "Room";
  }
}

function mapSceneWalls(sceneWalls: Record<string, unknown>[]): Wall[] {
  return sceneWalls.map((wall, index) => ({
    id: toStringValue(wall.id, `w${index + 1}`),
    start: toVec2(wall.start ?? wall.a, [0, 0]),
    end: toVec2(wall.end ?? wall.b, [0, 0]),
    thickness: toNumberValue(wall.thickness, 12),
    height: toNumberValue(wall.height, DEFAULT_WALL_HEIGHT_METERS),
    type: toWallType(wall.type),
    isPartOfBalcony: Boolean(wall.isPartOfBalcony),
    confidence: typeof wall.confidence === "number" ? wall.confidence : undefined
  }));
}

function mapSceneOpenings(sceneOpenings: Record<string, unknown>[]): Opening[] {
  return sceneOpenings.map((opening, index) => ({
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
}

function mapSceneRooms(sceneRooms: Record<string, unknown>[]): RoomZone[] {
  return sceneRooms
    .map((room, index) => {
      const polygon = getPolygonPoints(room.polygon ?? room.polygonMm);
      if (polygon.length < 3) return null;
      const roomType = toRoomType(room.roomType ?? room.type);
      return {
        id: toStringValue(room.id, `room-${index + 1}`),
        roomType,
        label: toRoomLabel(roomType, room.label),
        polygon,
        area: toNumberValue(room.area, toNumberValue(room.areaSqMm, 0)),
        center: toVec2(room.centroid ?? room.centroidMm, polygon[0]!),
        openingIds: Array.isArray(room.openingIds) ? room.openingIds.filter((value): value is string => typeof value === "string") : [],
        connectedRoomIds: Array.isArray(room.connectedRoomIds)
          ? room.connectedRoomIds.filter((value): value is string => typeof value === "string")
          : [],
        estimatedCeilingHeight: toNumberValue(room.estimatedCeilingHeight, toNumberValue(room.estimatedCeilingHeightMm, 2800) / 1000),
        estimatedUsage: toUsage(room.estimatedUsage),
        isExteriorFacing: Boolean(room.isExteriorFacing)
      } satisfies RoomZone;
    })
    .filter((room): room is RoomZone => Boolean(room));
}

function mapSceneFloors(sceneFloors: Record<string, unknown>[], rooms: RoomZone[]): Floor[] {
  if (sceneFloors.length > 0) {
    return sceneFloors
      .map((floor, index) => {
        const outline = getPolygonPoints(floor.outline ?? floor.polygon);
        if (outline.length < 3) return null;
        return {
          id: toStringValue(floor.id, `floor-${index + 1}`),
          outline,
          materialId: typeof floor.materialId === "string" ? floor.materialId : null,
          roomId: typeof floor.roomId === "string" ? floor.roomId : null,
          roomType: toRoomType(floor.roomType),
          label: typeof floor.label === "string" ? floor.label : undefined
        } satisfies Floor;
      })
      .filter(Boolean) as Floor[];
  }

  return rooms.map((room) => ({
    id: `floor-${room.id}`,
    outline: room.polygon,
    materialId: null,
    roomId: room.id,
    roomType: room.roomType,
    label: room.label
  }));
}

function mapSceneCeilings(sceneCeilings: Record<string, unknown>[], rooms: RoomZone[]): Ceiling[] {
  if (sceneCeilings.length > 0) {
    return sceneCeilings
      .map((ceiling, index) => {
        const outline = getPolygonPoints(ceiling.outline ?? ceiling.polygon);
        if (outline.length < 3) return null;
        return {
          id: toStringValue(ceiling.id, `ceiling-${index + 1}`),
          outline,
          materialId: typeof ceiling.materialId === "string" ? ceiling.materialId : null,
          roomId: typeof ceiling.roomId === "string" ? ceiling.roomId : null,
          roomType: toRoomType(ceiling.roomType),
          height: toNumberValue(ceiling.height, DEFAULT_WALL_HEIGHT_METERS)
        } satisfies Ceiling;
      })
      .filter(Boolean) as Ceiling[];
  }

  return rooms.map((room) => ({
    id: `ceiling-${room.id}`,
    outline: room.polygon,
    materialId: null,
    roomId: room.id,
    roomType: room.roomType,
    height: room.estimatedCeilingHeight
  }));
}

function mapSceneCameraAnchors(sceneCameraAnchors: Record<string, unknown>[]): CameraAnchor[] {
  return sceneCameraAnchors
    .map((anchor, index) => {
      const kind: CameraAnchor["kind"] =
        anchor.kind === "entrance" || anchor.kind === "room_center" || anchor.kind === "overview"
          ? anchor.kind
          : "overview";
      return {
        id: toStringValue(anchor.id, `camera-anchor-${index + 1}`),
        kind,
        roomId: typeof anchor.roomId === "string" ? anchor.roomId : null,
        openingId: typeof anchor.openingId === "string" ? anchor.openingId : null,
        planPosition: toVec2(anchor.planPosition ?? anchor.position, [0, 0]),
        targetPlanPosition: toVec2(anchor.targetPlanPosition ?? anchor.target, [0, 0]),
        height: toNumberValue(anchor.height, 1.6)
      } satisfies CameraAnchor;
    })
    .filter((anchor) => Number.isFinite(anchor.planPosition[0]) && Number.isFinite(anchor.planPosition[1]));
}

function mapSceneNavGraph(value: unknown): NavGraph {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { nodes: [], edges: [] };
  }

  const record = value as Record<string, unknown>;
  const nodes: NavGraph["nodes"] = getArrayRecords(record.nodes).map((node, index) => ({
    id: toStringValue(node.id, `nav-node-${index + 1}`),
    roomId: typeof node.roomId === "string" ? node.roomId : null,
    kind: node.kind === "entrance" ? "entrance" : "room_center",
    planPosition: toVec2(node.planPosition, [0, 0])
  }));

  const edges: NavGraph["edges"] = getArrayRecords(record.edges)
    .map((edge, index) => {
      const relation: NavGraph["edges"][number]["relation"] =
        edge.relation === "passage" ? "passage" : edge.relation === "entrance" ? "entrance" : "door";
      return {
        id: toStringValue(edge.id, `nav-edge-${index + 1}`),
        fromNodeId: toStringValue(edge.fromNodeId, ""),
        toNodeId: toStringValue(edge.toNodeId, ""),
        relation,
        openingId: toStringValue(edge.openingId, "")
      };
    })
    .filter((edge) => edge.fromNodeId.length > 0 && edge.toNodeId.length > 0);

  return { nodes, edges };
}

function mapScenePayloadToScene(
  sceneJson: Record<string, unknown>,
  fallback: {
    wallCoordinates?: unknown[];
    roomPolygons?: unknown[];
    scale?: number;
    diagnostics?: Record<string, unknown>;
  }
): MappedSceneResult {
  const sceneWalls = getArrayRecords(sceneJson.walls);
  const sceneOpenings = getArrayRecords(sceneJson.openings);
  const sceneRooms = getArrayRecords(sceneJson.rooms);
  const sceneFloors = getArrayRecords(sceneJson.floors);
  const sceneCeilings = getArrayRecords(sceneJson.ceilings);
  const sceneCameraAnchors = getArrayRecords(sceneJson.cameraAnchors);
  const walls =
    sceneWalls.length > 0
      ? mapSceneWalls(sceneWalls)
      : mapSceneWalls(getArrayRecords(fallback.wallCoordinates).map((wall) => ({ ...wall, start: wall.start, end: wall.end })));
  const openings = mapSceneOpenings(sceneOpenings);
  const rooms = sceneRooms.length > 0 ? mapSceneRooms(sceneRooms) : mapSceneRooms(getArrayRecords(fallback.roomPolygons));
  const floors = mapSceneFloors(sceneFloors, rooms);
  const ceilings = mapSceneCeilings(sceneCeilings, rooms);
  const cameraAnchors = mapSceneCameraAnchors(sceneCameraAnchors);
  const navGraph = mapSceneNavGraph(sceneJson.navGraph);
  const entranceRecord =
    sceneJson.entrance && typeof sceneJson.entrance === "object" && !Array.isArray(sceneJson.entrance)
      ? (sceneJson.entrance as Record<string, unknown>)
      : null;
  const entranceId =
    (entranceRecord && typeof entranceRecord.openingId === "string" ? entranceRecord.openingId : null) ??
    openings.find((opening) => opening.isEntrance)?.id ??
    null;

  const scale = toNumberValue(sceneJson.scale, fallback.scale ?? 1);
  const sceneScaleInfo = sceneJson.scaleInfo;
  const scaleInfo = ((sceneScaleInfo ??
    ({
      value: scale,
      source: "unknown",
      confidence: 0,
      evidence: {
        notes: "Scale source not provided by worker."
      }
    } as const)) as ScaleInfo);

  return {
    walls,
    openings,
    floors,
    ceilings,
    rooms,
    cameraAnchors,
    navGraph,
    scale,
    scaleInfo,
    entranceId,
    diagnostics: fallback.diagnostics
  };
}

export function mapFloorplanResultToScene(result: FloorplanResultResponse): MappedSceneResult {
  const sceneJson = result.sceneJson ?? {};
  return mapScenePayloadToScene(sceneJson, {
    wallCoordinates: result.wallCoordinates,
    roomPolygons: result.roomPolygons,
    scale: result.scale,
    diagnostics: result.diagnostics
  });
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

function mapMmRoomsToSceneRooms(
  rooms: Record<string, unknown>[],
  offset: { x: number; y: number }
): RoomZone[] {
  return rooms
    .map((room, index) => {
      const polygonMm = getPolygonPoints(room.polygonMm ?? room.polygon);
      if (polygonMm.length < 3) return null;
      const roomType = toRoomType(room.roomType);
      return {
        id: toStringValue(room.id, `rev-room-${index + 1}`),
        roomType,
        label: toRoomLabel(roomType, room.label),
        polygon: polygonMm.map((point) => mmPointToSyntheticPx(point, offset)),
        area: toNumberValue(room.areaSqMm, 0) / 1_000_000,
        center: mmPointToSyntheticPx(toVec2(room.centroidMm, polygonMm[0]!), offset),
        openingIds: Array.isArray(room.openingIds) ? room.openingIds.filter((value): value is string => typeof value === "string") : [],
        connectedRoomIds: Array.isArray(room.connectedRoomIds)
          ? room.connectedRoomIds.filter((value): value is string => typeof value === "string")
          : [],
        estimatedCeilingHeight: toNumberValue(room.estimatedCeilingHeightMm, 2800) / 1000,
        estimatedUsage: toUsage(room.estimatedUsage),
        isExteriorFacing: Boolean(room.isExteriorFacing)
      } satisfies RoomZone;
    })
    .filter((room): room is RoomZone => Boolean(room));
}

function mapMmFloorsFromRooms(rooms: RoomZone[]): Floor[] {
  return rooms.map((room) => ({
    id: `floor-${room.id}`,
    outline: room.polygon,
    materialId: null,
    roomId: room.id,
    roomType: room.roomType,
    label: room.label
  }));
}

function mapMmCeilingsFromRooms(rooms: RoomZone[]): Ceiling[] {
  return rooms.map((room) => ({
    id: `ceiling-${room.id}`,
    outline: room.polygon,
    materialId: null,
    roomId: room.id,
    roomType: room.roomType,
    height: room.estimatedCeilingHeight
  }));
}

function mapDerivedCameraFromRevision(value: unknown, offset: { x: number; y: number }): CameraAnchor[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return getArrayRecords(record.anchors).map((anchor, index) => ({
    id: toStringValue(anchor.id, `camera-anchor-${index + 1}`),
    kind:
      anchor.kind === "entrance" || anchor.kind === "room_center" || anchor.kind === "overview"
        ? anchor.kind
        : "overview",
    roomId: typeof anchor.roomId === "string" ? anchor.roomId : null,
    openingId: typeof anchor.openingId === "string" ? anchor.openingId : null,
    planPosition: mmPointToSyntheticPx(toVec2(anchor.planPositionMm, [0, 0]), offset),
    targetPlanPosition: mmPointToSyntheticPx(toVec2(anchor.targetPlanPositionMm, [0, 0]), offset),
    height: toNumberValue(anchor.heightMm, 1600) / 1000
  }));
}

function mapDerivedNavFromRevision(value: unknown, offset: { x: number; y: number }): NavGraph {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { nodes: [], edges: [] };
  }
  const record = value as Record<string, unknown>;
  return {
    nodes: getArrayRecords(record.nodes).map((node, index) => ({
      id: toStringValue(node.id, `nav-node-${index + 1}`),
      roomId: typeof node.roomId === "string" ? node.roomId : null,
      kind: node.kind === "entrance" ? "entrance" : "room_center",
      planPosition: mmPointToSyntheticPx(toVec2(node.planPositionMm, [0, 0]), offset)
    })) as NavGraph["nodes"],
    edges: getArrayRecords(record.edges)
      .map((edge, index) => ({
        id: toStringValue(edge.id, `nav-edge-${index + 1}`),
        fromNodeId: toStringValue(edge.fromNodeId, ""),
        toNodeId: toStringValue(edge.toNodeId, ""),
        relation:
          edge.relation === "passage"
            ? ("passage" as const)
            : edge.relation === "entrance"
              ? ("entrance" as const)
              : ("door" as const),
        openingId: toStringValue(edge.openingId, "")
      }))
      .filter((edge) => edge.fromNodeId.length > 0 && edge.toNodeId.length > 0) as NavGraph["edges"]
  };
}

export function mapLayoutRevisionToScene(revision: LayoutRevisionResponse): MappedSceneResult {
  if (revision.derived_scene_json && Object.keys(revision.derived_scene_json).length > 0) {
    return mapScenePayloadToScene(revision.derived_scene_json, {
      scale: SYNTHETIC_SCALE_METERS_PER_PIXEL,
      diagnostics: {
        layoutRevisionId: revision.id,
        geometryHash: revision.geometry_hash,
        topologyHash: revision.topology_hash ?? null,
        roomGraphHash: revision.room_graph_hash ?? null
      }
    });
  }

  const geometry = revision.geometry_json ?? {};
  const scaleRecord = (geometry.scale ?? {}) as Record<string, unknown>;
  const walls = getArrayRecords(geometry.walls);
  const openings = getArrayRecords(geometry.openings);
  const rooms = getArrayRecords(geometry.rooms);
  const pointCloud: Array<[number, number]> = [
    ...walls.flatMap((wall) => [toVec2(wall.startMm, [0, 0]), toVec2(wall.endMm, [0, 0])]),
    ...rooms.flatMap((room) => getPolygonPoints(room.polygonMm ?? room.polygon))
  ];

  const bounds = measureBounds(pointCloud);
  const offset = {
    x: SYNTHETIC_CANVAS_PADDING - bounds.minX * SYNTHETIC_PX_PER_MM,
    y: SYNTHETIC_CANVAS_PADDING - bounds.minY * SYNTHETIC_PX_PER_MM
  };

  const mappedWalls: Wall[] = walls.map((wall, index) => ({
    id: toStringValue(wall.id, `rev-wall-${index + 1}`),
    start: mmPointToSyntheticPx(toVec2(wall.startMm, [0, 0]), offset),
    end: mmPointToSyntheticPx(toVec2(wall.endMm, [0, 0]), offset),
    thickness: Math.max(6, toNumberValue(wall.thicknessMm, 180) * SYNTHETIC_PX_PER_MM),
    height: DEFAULT_WALL_HEIGHT_METERS,
    type: toWallType(wall.type),
    isPartOfBalcony: Boolean(wall.isPartOfBalcony),
    confidence: typeof wall.confidence === "number" ? wall.confidence : undefined
  }));

  const mappedOpenings: Opening[] = openings.map((opening, index) => ({
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

  const mappedRooms = mapMmRoomsToSceneRooms(rooms, offset);
  const mappedFloors = mapMmFloorsFromRooms(mappedRooms);
  const mappedCeilings = mapMmCeilingsFromRooms(mappedRooms);
  const cameraAnchors = mapDerivedCameraFromRevision(revision.derived_camera_json, offset);
  const navGraph = mapDerivedNavFromRevision(revision.derived_nav_json, offset);
  const entranceId = mappedOpenings.find((opening) => opening.isEntrance)?.id ?? null;

  return {
    walls: mappedWalls,
    openings: mappedOpenings,
    floors: mappedFloors,
    ceilings: mappedCeilings,
    rooms: mappedRooms,
    cameraAnchors,
    navGraph,
    scale: SYNTHETIC_SCALE_METERS_PER_PIXEL,
    scaleInfo: {
      value: SYNTHETIC_SCALE_METERS_PER_PIXEL,
      source:
        scaleRecord.source === "ocr_dimension" ||
        scaleRecord.source === "door_heuristic" ||
        scaleRecord.source === "user_measure"
          ? scaleRecord.source
          : "unknown",
      confidence: toNumberValue(scaleRecord.confidence, 0),
      evidence: {
        notes: `Imported from layout revision ${revision.id} geometry in millimeters.`
      }
    },
    entranceId,
    diagnostics: {
      layoutRevisionId: revision.id,
      geometryHash: revision.geometry_hash,
      topologyHash: revision.topology_hash ?? null,
      roomGraphHash: revision.room_graph_hash ?? null
    }
  };
}

export function buildSyntheticFloorplanPreview(
  scene: Pick<MappedSceneResult, "walls" | "openings" | "floors" | "rooms">
) {
  if (typeof document === "undefined") return null;

  const bounds = measureSceneBounds(scene.walls, scene.floors, scene.rooms);
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

  scene.rooms.forEach((room) => {
    ctx.save();
    ctx.fillStyle = "rgba(17,17,17,0.72)";
    ctx.font = "600 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(room.label, room.center[0] + offsetX, room.center[1] + offsetY);
    ctx.restore();
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
