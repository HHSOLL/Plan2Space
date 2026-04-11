import type {
  CameraAnchor,
  Ceiling,
  Floor,
  NavGraph,
  Opening,
  RoomZone,
  ScaleInfo,
  Vector2,
  Wall
} from "../stores/useSceneStore";

const DEFAULT_WALL_HEIGHT = 2.8;

function polygonArea(points: Vector2[]) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function polygonCentroid(points: Vector2[]): Vector2 {
  if (points.length === 0) return [0, 0];
  const twiceArea = polygonArea(points) * 2;
  if (!Number.isFinite(twiceArea) || Math.abs(twiceArea) < 1e-6) {
    const fallback = points.reduce<[number, number]>(
      (accumulator, point) => [accumulator[0] + point[0], accumulator[1] + point[1]],
      [0, 0]
    );
    return [fallback[0] / points.length, fallback[1] / points.length];
  }

  let centroidX = 0;
  let centroidY = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    const cross = x1 * y2 - x2 * y1;
    centroidX += (x1 + x2) * cross;
    centroidY += (y1 + y2) * cross;
  }

  return [centroidX / (3 * twiceArea), centroidY / (3 * twiceArea)];
}

function resolvePrimaryOutline(floors: Floor[], walls: Wall[]) {
  const floorWithOutline = [...floors]
    .filter((floor) => Array.isArray(floor.outline) && floor.outline.length >= 3)
    .sort((left, right) => Math.abs(polygonArea(right.outline)) - Math.abs(polygonArea(left.outline)))[0];

  if (floorWithOutline) {
    return floorWithOutline.outline;
  }

  const wallOutline = walls.map((wall) => wall.start);
  return wallOutline.length >= 3 ? wallOutline : [];
}

function pointAlongWall(wall: Wall, distanceFromStart: number): Vector2 {
  const deltaX = wall.end[0] - wall.start[0];
  const deltaY = wall.end[1] - wall.start[1];
  const length = Math.hypot(deltaX, deltaY);
  if (length <= 1e-6) return wall.start;
  const ratio = Math.min(1, Math.max(0, distanceFromStart / length));
  return [wall.start[0] + deltaX * ratio, wall.start[1] + deltaY * ratio];
}

function resolveEntranceOpening(openings: Opening[]) {
  return openings.find((opening) => opening.type === "door" && opening.isEntrance) ??
    openings.find((opening) => opening.type === "door") ??
    null;
}

type DeriveBlankRoomShellInput = {
  scale: number;
  scaleInfo: ScaleInfo;
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
};

export type DerivedRoomShell = {
  scale: number;
  scaleInfo: ScaleInfo;
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
  ceilings: Ceiling[];
  rooms: RoomZone[];
  cameraAnchors: CameraAnchor[];
  navGraph: NavGraph;
  entranceId: string | null;
};

export function deriveBlankRoomShell(input: DeriveBlankRoomShellInput): DerivedRoomShell {
  const wallHeight =
    input.walls.reduce((maxHeight, wall) => Math.max(maxHeight, Number(wall.height) || DEFAULT_WALL_HEIGHT), DEFAULT_WALL_HEIGHT) ||
    DEFAULT_WALL_HEIGHT;
  const primaryOutline = resolvePrimaryOutline(input.floors, input.walls);
  const roomsFromFloors = input.floors
    .filter((floor) => floor.outline.length >= 3)
    .map((floor, index) => {
      const polygon = floor.outline;
      return {
        id: floor.roomId ?? `room-${index + 1}`,
        roomType: floor.roomType ?? "other",
        label: floor.label ?? `Room ${index + 1}`,
        polygon,
        area: Math.abs(polygonArea(polygon)),
        center: polygonCentroid(polygon),
        openingIds: [],
        connectedRoomIds: [],
        estimatedCeilingHeight: wallHeight,
        estimatedUsage: index === 0 ? "primary" : "secondary",
        isExteriorFacing: true
      } satisfies RoomZone;
    });

  const rooms =
    roomsFromFloors.length > 0
      ? roomsFromFloors
      : primaryOutline.length >= 3
        ? [
            {
              id: "room-1",
              roomType: "other",
              label: "Main Room",
              polygon: primaryOutline,
              area: Math.abs(polygonArea(primaryOutline)),
              center: polygonCentroid(primaryOutline),
              openingIds: [],
              connectedRoomIds: [],
              estimatedCeilingHeight: wallHeight,
              estimatedUsage: "primary",
              isExteriorFacing: true
            } satisfies RoomZone
          ]
        : [];

  const ceilings =
    input.floors.filter((floor) => floor.outline.length >= 3).map((floor, index) => ({
      id: `ceiling-${floor.id || index + 1}`,
      outline: floor.outline,
      materialId: null,
      roomId: floor.roomId ?? rooms[index]?.id ?? rooms[0]?.id ?? null,
      roomType: floor.roomType ?? rooms[index]?.roomType ?? rooms[0]?.roomType ?? "other",
      height: wallHeight
    })) ||
    [];

  const entranceOpening = resolveEntranceOpening(input.openings);
  const primaryRoom = rooms[0] ?? null;
  const roomCenter = primaryRoom?.center ?? polygonCentroid(primaryOutline);
  const entranceAnchorPosition =
    entranceOpening && input.walls.length > 0
      ? pointAlongWall(
          input.walls.find((wall) => wall.id === entranceOpening.wallId) ?? input.walls[0],
          entranceOpening.offset + entranceOpening.width / 2
        )
      : null;

  const cameraAnchors: CameraAnchor[] = [
    ...(entranceOpening && entranceAnchorPosition
      ? [
          {
            id: "anchor-entrance",
            kind: "entrance",
            roomId: primaryRoom?.id ?? null,
            openingId: entranceOpening.id,
            planPosition: entranceAnchorPosition,
            targetPlanPosition: roomCenter,
            height: 1.62
          } satisfies CameraAnchor
        ]
      : []),
    {
      id: "anchor-room-center",
      kind: "room_center",
      roomId: primaryRoom?.id ?? null,
      openingId: null,
      planPosition: roomCenter,
      targetPlanPosition: roomCenter,
      height: 1.58
    },
    {
      id: "anchor-overview",
      kind: "overview",
      roomId: primaryRoom?.id ?? null,
      openingId: null,
      planPosition: roomCenter,
      targetPlanPosition: roomCenter,
      height: Math.max(2.2, wallHeight * 0.75)
    }
  ];

  const navNodes: NavGraph["nodes"] = [
    ...(entranceOpening && entranceAnchorPosition
      ? [
          {
            id: "nav-entrance",
            roomId: primaryRoom?.id ?? null,
            kind: "entrance",
            planPosition: entranceAnchorPosition
          } satisfies NavGraph["nodes"][number]
        ]
      : []),
    {
      id: "nav-room-center",
      roomId: primaryRoom?.id ?? null,
      kind: "room_center",
      planPosition: roomCenter
    } satisfies NavGraph["nodes"][number]
  ];

  const navEdges: NavGraph["edges"] =
    entranceOpening && navNodes.length > 1
      ? [
          {
            id: "edge-entrance-room",
            fromNodeId: "nav-entrance",
            toNodeId: "nav-room-center",
            relation: "entrance",
            openingId: entranceOpening.id
          }
        ]
      : [];

  return {
    scale: input.scale,
    scaleInfo: input.scaleInfo,
    walls: input.walls,
    openings: input.openings,
    floors: input.floors,
    ceilings,
    rooms,
    cameraAnchors,
    navGraph: {
      nodes: navNodes,
      edges: navEdges
    },
    entranceId: entranceOpening?.id ?? null
  };
}
