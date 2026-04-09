import type {
  CameraAnchor,
  Ceiling,
  Floor,
  LightingSettings,
  NavGraph,
  RoomType,
  RoomZone,
  SceneAsset,
  ScaleInfo,
  Wall,
  Opening
} from "../../lib/stores/useSceneStore";
import { normalizeSceneAnchorType } from "../../lib/scene/anchor-types";

const SYNTHETIC_PX_PER_MM = 0.1;
const SYNTHETIC_SCALE_METERS_PER_PIXEL = 0.001 / SYNTHETIC_PX_PER_MM;
const DEFAULT_WALL_HEIGHT_METERS = 2.8;
const SYNTHETIC_CANVAS_PADDING = 72;
const DEFAULT_LIGHTING: LightingSettings = {
  ambientIntensity: 0.35,
  hemisphereIntensity: 0.4,
  directionalIntensity: 1.05,
  environmentBlur: 0.2
};

export type MappedSceneResult = {
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
  ceilings: Ceiling[];
  rooms: RoomZone[];
  cameraAnchors: CameraAnchor[];
  navGraph: NavGraph;
  assets: SceneAsset[];
  scale: number;
  scaleInfo: ScaleInfo;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  lighting: LightingSettings;
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

function mapSceneAssets(value: unknown): SceneAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map<SceneAsset | null>((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const record = entry as Record<string, unknown>;
      return {
        id: toStringValue(record.id, `asset-${index + 1}`),
        assetId: toStringValue(record.assetId ?? record.modelId, "placeholder:chair"),
        catalogItemId: (() => {
          const catalogItemId =
            typeof record.catalogItemId === "string"
              ? record.catalogItemId
              : record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
                ? toStringValue((record.metadata as Record<string, unknown>).catalogItemId, "")
                : "";
          return catalogItemId.length > 0 ? catalogItemId : null;
        })(),
        anchorType:
          typeof record.anchorType === "string"
            ? normalizeSceneAnchorType(record.anchorType)
            : record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
              ? normalizeSceneAnchorType((record.metadata as Record<string, unknown>).anchorType)
              : normalizeSceneAnchorType(null),
        position:
          Array.isArray(record.position) && record.position.length >= 3
            ? [
                toNumberValue(record.position[0], 0),
                toNumberValue(record.position[1], 0),
                toNumberValue(record.position[2], 0)
              ]
            : [0, 0, 0],
        rotation:
          Array.isArray(record.rotation) && record.rotation.length >= 3
            ? [
                toNumberValue(record.rotation[0], 0),
                toNumberValue(record.rotation[1], 0),
                toNumberValue(record.rotation[2], 0)
              ]
            : [0, 0, 0],
        scale:
          Array.isArray(record.scale) && record.scale.length >= 3
            ? [
                toNumberValue(record.scale[0], 1),
                toNumberValue(record.scale[1], 1),
                toNumberValue(record.scale[2], 1)
              ]
            : [1, 1, 1],
        materialId: typeof record.materialId === "string" ? record.materialId : null
      } satisfies SceneAsset;
    })
    .filter((entry): entry is SceneAsset => Boolean(entry));
}

function parseMaterialIndex(value: unknown, fallback: number) {
  if (typeof value !== "string") return fallback;
  const match = value.match(/:(\d+)$/);
  return match ? Number(match[1]) : fallback;
}

function parseLightingDefaults(defaults: Record<string, unknown>) {
  const lightingDefaults =
    defaults.lighting && typeof defaults.lighting === "object" && !Array.isArray(defaults.lighting)
      ? (defaults.lighting as Record<string, unknown>)
      : {};
  return {
    ambientIntensity: toNumberValue(lightingDefaults.ambientIntensity, DEFAULT_LIGHTING.ambientIntensity),
    hemisphereIntensity: toNumberValue(
      lightingDefaults.hemisphereIntensity,
      DEFAULT_LIGHTING.hemisphereIntensity
    ),
    directionalIntensity: toNumberValue(
      lightingDefaults.directionalIntensity,
      DEFAULT_LIGHTING.directionalIntensity
    ),
    environmentBlur: toNumberValue(lightingDefaults.environmentBlur, DEFAULT_LIGHTING.environmentBlur)
  } satisfies LightingSettings;
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
    assets: [],
    scale,
    scaleInfo,
    wallMaterialIndex: 0,
    floorMaterialIndex: 0,
    lighting: DEFAULT_LIGHTING,
    entranceId,
    diagnostics: fallback.diagnostics
  };
}

export function mapProjectVersionToScene(version: Record<string, unknown>): MappedSceneResult | null {
  const floorPlan =
    version.floor_plan && typeof version.floor_plan === "object" && !Array.isArray(version.floor_plan)
      ? (version.floor_plan as Record<string, unknown>)
      : null;
  const customization =
    version.customization && typeof version.customization === "object" && !Array.isArray(version.customization)
      ? (version.customization as Record<string, unknown>)
      : null;

  if (!floorPlan) return null;

  const floorPlanWalls = getArrayRecords(floorPlan.walls).map((wall, index) => ({
    id: toStringValue(wall.id, `saved-wall-${index + 1}`),
    start: toVec2(wall.a ?? wall.start, [0, 0]),
    end: toVec2(wall.b ?? wall.end, [0, 0]),
    thickness: toNumberValue(wall.thickness, 0.12),
    height: toNumberValue(wall.height, DEFAULT_WALL_HEIGHT_METERS),
    type: "exterior" as const
  }));

  const floorPlanOpenings: Opening[] = getArrayRecords(floorPlan.openings).map((opening, index) => ({
    id: toStringValue(opening.id, `saved-opening-${index + 1}`),
    wallId: toStringValue(opening.wallId, ""),
    type: opening.type === "window" ? "window" : "door",
    offset: toNumberValue(opening.offset, 0),
    width: toNumberValue(opening.width, opening.type === "window" ? 1.6 : 0.9),
    height: toNumberValue(opening.height, opening.type === "window" ? 1.2 : 2.1),
    verticalOffset: typeof opening.verticalOffset === "number" ? opening.verticalOffset : undefined,
    sillHeight: typeof opening.sillHeight === "number" ? opening.sillHeight : undefined,
    isEntrance: Boolean(opening.isEntrance)
  }));

  const floorPlanFloors = getArrayRecords(floorPlan.floors).map((floor, index) => ({
    id: toStringValue(floor.id, `saved-floor-${index + 1}`),
    outline: getPolygonPoints(floor.outline),
    materialId: typeof floor.materialId === "string" ? floor.materialId : null
  }));

  const fallbackOutline =
    floorPlanFloors.find((floor) => floor.outline.length >= 3)?.outline ??
    floorPlanWalls.map((wall) => wall.start);
  if (fallbackOutline.length < 3) return null;

  const bounds = measureBounds(fallbackOutline);
  const roomCenter: [number, number] = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
  const ceilingHeight = toNumberValue(
    (floorPlan.params as Record<string, unknown> | undefined)?.ceilingHeight,
    DEFAULT_WALL_HEIGHT_METERS
  );
  const roomArea =
    Math.abs(
      fallbackOutline.reduce((sum, point, index) => {
        const next = fallbackOutline[(index + 1) % fallbackOutline.length]!;
        return sum + point[0] * next[1] - next[0] * point[1];
      }, 0)
    ) / 2;

  const rooms: RoomZone[] = [
    {
      id: "saved-room-main",
      roomType: "living_room",
      label: "Saved Room",
      polygon: fallbackOutline,
      area: roomArea,
      center: roomCenter,
      openingIds: floorPlanOpenings.map((opening) => opening.id),
      connectedRoomIds: [],
      estimatedCeilingHeight: ceilingHeight,
      estimatedUsage: "primary",
      isExteriorFacing: true
    }
  ];

  const floors: Floor[] =
    floorPlanFloors.length > 0
      ? floorPlanFloors.map((floor) => ({
          ...floor,
          roomId: "saved-room-main",
          roomType: "living_room" as const,
          label: "Saved Room"
        }))
      : [
          {
            id: "saved-floor-main",
            outline: fallbackOutline,
            materialId: null,
            roomId: "saved-room-main",
            roomType: "living_room",
            label: "Saved Room"
          }
        ];

  const ceilings: Ceiling[] = floors.map((floor) => ({
    id: `ceiling-${floor.id}`,
    outline: floor.outline,
    materialId: null,
    roomId: floor.roomId,
    roomType: floor.roomType,
    height: ceilingHeight
  }));

  const entranceId =
    floorPlanOpenings.find((opening) => opening.isEntrance)?.id ??
    floorPlanOpenings.find((opening) => opening.type === "door")?.id ??
    null;

  const assets = mapSceneAssets(
    getArrayRecords(customization?.furniture).map((asset) => ({
      id: asset.id,
      assetId: asset.modelId,
      catalogItemId: (() => {
        const catalogItemId =
          asset.metadata && typeof asset.metadata === "object" && !Array.isArray(asset.metadata)
            ? toStringValue((asset.metadata as Record<string, unknown>).catalogItemId, "")
            : "";
        return catalogItemId.length > 0 ? catalogItemId : null;
      })(),
      anchorType:
        asset.metadata && typeof asset.metadata === "object" && !Array.isArray(asset.metadata)
          ? normalizeSceneAnchorType((asset.metadata as Record<string, unknown>).anchorType)
          : normalizeSceneAnchorType(asset.anchor),
      position: asset.position,
      rotation: asset.rotation,
      scale: asset.scale,
      materialId: null
    }))
  );

  const defaults =
    customization?.defaults && typeof customization.defaults === "object" && !Array.isArray(customization.defaults)
      ? (customization.defaults as Record<string, unknown>)
      : {};
  const floorDefaults =
    defaults.floor && typeof defaults.floor === "object" && !Array.isArray(defaults.floor)
      ? (defaults.floor as Record<string, unknown>)
      : {};
  const wallDefaults =
    defaults.wall && typeof defaults.wall === "object" && !Array.isArray(defaults.wall)
      ? (defaults.wall as Record<string, unknown>)
      : {};
  const lighting = parseLightingDefaults(defaults);

  return {
    walls: floorPlanWalls,
    openings: floorPlanOpenings,
    floors,
    ceilings,
    rooms,
    cameraAnchors: [],
    navGraph: { nodes: [], edges: [] },
    assets,
    scale: 1,
    scaleInfo: {
      value: 1,
      source: "user_measure",
      confidence: 0.95,
      evidence: {
        notes: `Loaded from saved project version ${toStringValue(version.id, "draft")}.`
      }
    },
    wallMaterialIndex: parseMaterialIndex(wallDefaults.materialSkuId, 0),
    floorMaterialIndex: parseMaterialIndex(floorDefaults.materialSkuId, 0),
    lighting,
    entranceId,
    diagnostics: {
      projectVersionId: toStringValue(version.id, "draft"),
      message: toStringValue(version.message, "Saved project version")
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
