import type { TopologyOpening, TopologyWall, Vec2 } from "@plan2space/floorplan-core";

type PointNode = { key: string; x: number; y: number };

export type RoomType =
  | "living_room"
  | "bedroom"
  | "kitchen"
  | "dining"
  | "bathroom"
  | "foyer"
  | "corridor"
  | "balcony"
  | "utility"
  | "pantry"
  | "dress_room"
  | "alpha_room"
  | "service_area"
  | "evacuation_space"
  | "other";

type RoomUsage = "primary" | "secondary" | "service";

type LoopResult = {
  points: Vec2[];
  area: number;
  centroid: Vec2;
};

export type RoomAdjacency = {
  id: string;
  fromRoomId: string | null;
  toRoomId: string | null;
  openingId: string;
  relation: "door" | "window" | "passage" | "entrance";
};

export type RoomPolygon = {
  id: string;
  polygon: Vec2[];
  area: number;
  type: "room";
  roomType: RoomType;
  label: string;
  centroid: Vec2;
  openingIds: string[];
  connectedRoomIds: string[];
  estimatedCeilingHeight: number;
  estimatedUsage: RoomUsage;
  isExteriorFacing: boolean;
};

export type FloorZone = {
  id: string;
  roomId: string;
  outline: Vec2[];
  materialId: string | null;
  roomType: RoomType;
};

export type CeilingZone = {
  id: string;
  roomId: string;
  outline: Vec2[];
  materialId: string | null;
  roomType: RoomType;
  height: number;
};

export type CameraAnchor = {
  id: string;
  kind: "entrance" | "room_center" | "overview";
  roomId: string | null;
  openingId: string | null;
  planPosition: Vec2;
  targetPlanPosition: Vec2;
  height: number;
};

export type NavNode = {
  id: string;
  roomId: string | null;
  kind: "entrance" | "room_center";
  planPosition: Vec2;
};

export type NavEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: "door" | "passage" | "entrance";
  openingId: string;
};

export type GeometryBuildResult = {
  wallCoordinates: Array<{
    id: string;
    start: Vec2;
    end: Vec2;
    thickness: number;
    type: TopologyWall["type"];
    length: number;
    confidence?: number;
  }>;
  roomPolygons: RoomPolygon[];
  exteriorShell: Vec2[];
  roomAdjacency: RoomAdjacency[];
  floorZones: FloorZone[];
  ceilingZones: CeilingZone[];
  cameraAnchors: CameraAnchor[];
  navGraph: {
    nodes: NavNode[];
    edges: NavEdge[];
  };
  scale: number;
};

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function getSnapTolerance(walls: TopologyWall[]) {
  const thicknessMedian = median(
    walls
      .map((wall) => wall.thickness)
      .filter((value) => Number.isFinite(value) && value > 0)
  );
  return Math.max(2, Math.min(10, thicknessMedian > 0 ? thicknessMedian * 0.4 : 4));
}

function snapValue(value: number, tolerance: number) {
  return Math.round(value / tolerance) * tolerance;
}

function pointKey(x: number, y: number) {
  return `${x},${y}`;
}

function polygonArea(points: Vec2[]) {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index]!;
    const [x2, y2] = points[(index + 1) % points.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function polygonCentroid(points: Vec2[]): Vec2 {
  const area = polygonArea(points);
  if (Math.abs(area) < 1e-6) {
    const avgX = points.reduce((sum, point) => sum + point[0], 0) / Math.max(points.length, 1);
    const avgY = points.reduce((sum, point) => sum + point[1], 0) / Math.max(points.length, 1);
    return [avgX, avgY];
  }

  let cx = 0;
  let cy = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index]!;
    const [x2, y2] = points[(index + 1) % points.length]!;
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  const factor = 1 / (6 * area);
  return [cx * factor, cy * factor];
}

function pointInPolygon(point: Vec2, polygon: Vec2[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [xi, yi] = polygon[index]!;
    const [xj, yj] = polygon[previous]!;
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / Math.max(yj - yi, 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function canonicalizeLoop(points: Vec2[]) {
  const keys = points.map(([x, y]) => `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`);
  const rotations = (values: string[]) =>
    values.map((_, index) => values.slice(index).concat(values.slice(0, index)).join("|"));
  const forward = rotations(keys);
  const backward = rotations([...keys].reverse());
  return [...forward, ...backward].sort()[0]!;
}

function buildLoops(points: Map<string, PointNode>, adjacency: Map<string, string[]>) {
  const edgeUsed = new Set<string>();
  const loops: LoopResult[] = [];
  const edgeKey = (from: string, to: string) => `${from}->${to}`;

  const edges = Array.from(adjacency.entries()).flatMap(([from, neighbors]) => neighbors.map((to) => ({ from, to })));

  const pickNext = (previous: PointNode, current: PointNode, candidates: string[]) => {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0]!;

    const dirX = current.x - previous.x;
    const dirY = current.y - previous.y;
    let best: string | null = null;
    let bestAngle = Number.POSITIVE_INFINITY;

    for (const candidateKey of candidates) {
      const next = points.get(candidateKey);
      if (!next) continue;
      const vx = next.x - current.x;
      const vy = next.y - current.y;
      const cross = dirX * vy - dirY * vx;
      const dot = dirX * vx + dirY * vy;
      const angle = Math.atan2(cross, dot);
      const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
      if (normalized < bestAngle) {
        bestAngle = normalized;
        best = candidateKey;
      }
    }

    return best;
  };

  for (const edge of edges) {
    const startPoint = points.get(edge.from);
    const nextPoint = points.get(edge.to);
    if (!startPoint || !nextPoint) continue;
    if (edgeUsed.has(edgeKey(edge.from, edge.to))) continue;

    const loop: Vec2[] = [[startPoint.x, startPoint.y]];
    let previous = startPoint;
    let current = nextPoint;
    edgeUsed.add(edgeKey(edge.from, edge.to));

    const maxSteps = edges.length + 8;
    let steps = 0;

    while (steps < maxSteps) {
      loop.push([current.x, current.y]);
      if (current.key === startPoint.key) break;

      const neighbors = adjacency.get(current.key) ?? [];
      const candidates = neighbors.filter((neighbor) => neighbor !== previous.key);
      const nextKey = pickNext(previous, current, candidates);
      if (!nextKey) break;

      edgeUsed.add(edgeKey(current.key, nextKey));
      previous = current;
      const nextPointCandidate = points.get(nextKey);
      if (!nextPointCandidate) break;
      current = nextPointCandidate;
      steps += 1;
    }

    if (
      loop.length > 3 &&
      loop[0]![0] === loop[loop.length - 1]![0] &&
      loop[0]![1] === loop[loop.length - 1]![1]
    ) {
      const closed = loop.slice(0, -1);
      loops.push({
        points: closed,
        area: polygonArea(closed),
        centroid: polygonCentroid(closed)
      });
    }
  }

  return loops;
}

function buildAdjacencyGraph(walls: TopologyWall[]) {
  const points = new Map<string, PointNode>();
  const adjacency = new Map<string, string[]>();
  const snapTolerance = getSnapTolerance(walls);

  const registerPoint = (point: Vec2) => {
    const x = snapValue(point[0], snapTolerance);
    const y = snapValue(point[1], snapTolerance);
    const key = pointKey(x, y);
    if (!points.has(key)) {
      points.set(key, { key, x, y });
    }
    return key;
  };

  const addNeighbor = (from: string, to: string) => {
    const current = adjacency.get(from) ?? [];
    if (!current.includes(to)) current.push(to);
    adjacency.set(from, current);
  };

  walls.forEach((wall) => {
    const startKey = registerPoint(wall.start);
    const endKey = registerPoint(wall.end);
    if (startKey === endKey) return;
    addNeighbor(startKey, endKey);
    addNeighbor(endKey, startKey);
  });

  return { points, adjacency };
}

function dedupeAndFilterLoops(loops: LoopResult[]) {
  if (loops.length === 0) return [];
  const largestArea = Math.max(...loops.map((loop) => Math.abs(loop.area)));
  const minArea = Math.max(400, largestArea * 0.015);
  const seen = new Set<string>();
  return loops
    .filter((loop) => loop.points.length >= 3 && Math.abs(loop.area) >= minArea)
    .filter((loop) => {
      const key = canonicalizeLoop(loop.points);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => Math.abs(right.area) - Math.abs(left.area));
}

function deriveRoomPolygons(loops: LoopResult[]) {
  if (loops.length === 0) {
    return {
      exteriorShell: [] as Vec2[],
      roomPolygons: [] as Array<Pick<RoomPolygon, "id" | "polygon" | "area" | "type" | "centroid">>
    };
  }

  const exterior = loops[0]!;
  const innerLoops = loops.slice(1).filter((loop) => pointInPolygon(loop.centroid, exterior.points));
  const roomLoops = innerLoops.length > 0 ? innerLoops : [exterior];

  return {
    exteriorShell: exterior.points,
    roomPolygons: roomLoops.map((loop, index) => ({
      id: `room-${index + 1}`,
      polygon: loop.points,
      area: Math.abs(loop.area),
      type: "room" as const,
      centroid: loop.centroid
    }))
  };
}

function wallDirection(wall: TopologyWall) {
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dy) || 1;
  return { dx: dx / length, dy: dy / length, length };
}

function findRoomAtPoint(point: Vec2, rooms: RoomPolygon[]) {
  return rooms.find((room) => pointInPolygon(point, room.polygon)) ?? null;
}

function buildRoomAdjacency(rooms: RoomPolygon[], walls: TopologyWall[], openings: TopologyOpening[]): RoomAdjacency[] {
  if (rooms.length === 0) return [];

  return openings
    .map((opening) => {
      const wall = walls.find((candidate) => candidate.id === opening.wallId);
      if (!wall) return null;

      const direction = wallDirection(wall);
      const normal: Vec2 = [-direction.dy, direction.dx];
      const probe = Math.max(8, wall.thickness * 0.8);
      const leftPoint: Vec2 = [opening.position[0] + normal[0] * probe, opening.position[1] + normal[1] * probe];
      const rightPoint: Vec2 = [opening.position[0] - normal[0] * probe, opening.position[1] - normal[1] * probe];

      const leftRoom = findRoomAtPoint(leftPoint, rooms);
      const rightRoom = findRoomAtPoint(rightPoint, rooms);
      const relation =
        opening.isEntrance === true ? "entrance" : opening.type === "window" ? "window" : opening.type === "passage" ? "passage" : "door";

      if (!leftRoom && !rightRoom) return null;
      if (leftRoom?.id === rightRoom?.id) {
        return {
          id: `adj-${opening.id}`,
          fromRoomId: leftRoom?.id ?? null,
          toRoomId: null,
          openingId: opening.id,
          relation
        };
      }

      return {
        id: `adj-${opening.id}`,
        fromRoomId: leftRoom?.id ?? null,
        toRoomId: rightRoom?.id ?? null,
        openingId: opening.id,
        relation
      };
    })
    .filter((entry): entry is RoomAdjacency => Boolean(entry));
}

function humanizeRoomType(roomType: RoomType) {
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

function buildRoomExposureStats(walls: TopologyWall[], rooms: Array<Pick<RoomPolygon, "id" | "polygon">>) {
  const exposure = new Map<
    string,
    {
      exteriorWalls: number;
      balconyWalls: number;
    }
  >();

  rooms.forEach((room) => {
    exposure.set(room.id, {
      exteriorWalls: 0,
      balconyWalls: 0
    });
  });

  walls.forEach((wall) => {
    if (wall.type !== "exterior" && wall.type !== "balcony") return;

    const direction = wallDirection(wall);
    const normal: Vec2 = [-direction.dy, direction.dx];
    const probe = Math.max(8, wall.thickness * 0.8);
    const midpoint: Vec2 = [(wall.start[0] + wall.end[0]) / 2, (wall.start[1] + wall.end[1]) / 2];
    const room =
      findRoomAtPoint([midpoint[0] + normal[0] * probe, midpoint[1] + normal[1] * probe], rooms as RoomPolygon[]) ??
      findRoomAtPoint([midpoint[0] - normal[0] * probe, midpoint[1] - normal[1] * probe], rooms as RoomPolygon[]);

    if (!room) return;
    const current = exposure.get(room.id);
    if (!current) return;
    if (wall.type === "balcony") {
      current.balconyWalls += 1;
    } else {
      current.exteriorWalls += 1;
    }
  });

  return exposure;
}

type RoomClassificationFeature = {
  roomId: string;
  area: number;
  areaRatio: number;
  aspectRatio: number;
  isElongated: boolean;
  entranceCount: number;
  windowCount: number;
  exteriorWindowCount: number;
  adjacencyCount: number;
  connectedRoomIds: Set<string>;
  openingIds: Set<string>;
  exteriorWalls: number;
  balconyWalls: number;
  isExteriorFacing: boolean;
};

function getPolygonBounds(points: Vec2[]) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

export function classifyRooms(
  baseRooms: Array<Pick<RoomPolygon, "id" | "polygon" | "area" | "type" | "centroid">>,
  roomAdjacency: RoomAdjacency[],
  walls: TopologyWall[]
): RoomPolygon[] {
  if (baseRooms.length === 0) return [];

  const largestArea = Math.max(...baseRooms.map((room) => room.area));
  const exposure = buildRoomExposureStats(walls, baseRooms);
  const stats = new Map<
    string,
    {
      roomId: string;
      entranceCount: number;
      windowCount: number;
      exteriorWindowCount: number;
      adjacencyCount: number;
      connectedRoomIds: Set<string>;
      openingIds: Set<string>;
      exteriorWalls: number;
      balconyWalls: number;
    }
  >();

  baseRooms.forEach((room) => {
    const roomExposure = exposure.get(room.id);
    stats.set(room.id, {
      roomId: room.id,
      entranceCount: 0,
      windowCount: 0,
      exteriorWindowCount: 0,
      adjacencyCount: 0,
      connectedRoomIds: new Set<string>(),
      openingIds: new Set<string>(),
      exteriorWalls: roomExposure?.exteriorWalls ?? 0,
      balconyWalls: roomExposure?.balconyWalls ?? 0
    });
  });

  roomAdjacency.forEach((adjacency) => {
    const roomIds = [adjacency.fromRoomId, adjacency.toRoomId].filter((value): value is string => Boolean(value));
    roomIds.forEach((roomId) => {
      const entry = stats.get(roomId);
      if (!entry) return;
      entry.openingIds.add(adjacency.openingId);
      if (adjacency.relation === "entrance") {
        entry.entranceCount += 1;
      }
      if (adjacency.relation === "window" && (adjacency.fromRoomId === null || adjacency.toRoomId === null)) {
        entry.exteriorWindowCount += 1;
      }
      if (adjacency.relation === "window") {
        entry.windowCount += 1;
      }
      const opposite = adjacency.fromRoomId === roomId ? adjacency.toRoomId : adjacency.fromRoomId;
      if (opposite) {
        entry.connectedRoomIds.add(opposite);
      }
    });
  });

  stats.forEach((entry) => {
    entry.adjacencyCount = entry.connectedRoomIds.size;
  });

  const features = baseRooms.map((room) => {
    const roomStats = stats.get(room.id)!;
    const areaRatio = largestArea > 0 ? room.area / largestArea : 0;
    const bounds = getPolygonBounds(room.polygon);
    const aspectRatio = bounds.width >= bounds.height ? bounds.width / bounds.height : bounds.height / bounds.width;
    const isExteriorFacing =
      roomStats.exteriorWalls > 0 || roomStats.balconyWalls > 0 || roomStats.exteriorWindowCount > 0;

    return {
      roomId: room.id,
      area: room.area,
      areaRatio,
      aspectRatio,
      isElongated: aspectRatio >= 2.2,
      entranceCount: roomStats.entranceCount,
      windowCount: roomStats.windowCount,
      exteriorWindowCount: roomStats.exteriorWindowCount,
      adjacencyCount: roomStats.adjacencyCount,
      connectedRoomIds: roomStats.connectedRoomIds,
      openingIds: roomStats.openingIds,
      exteriorWalls: roomStats.exteriorWalls,
      balconyWalls: roomStats.balconyWalls,
      isExteriorFacing
    } satisfies RoomClassificationFeature;
  });

  const assignments = new Map<string, RoomType>();
  const assign = (roomId: string, roomType: RoomType) => {
    if (!assignments.has(roomId)) {
      assignments.set(roomId, roomType);
    }
  };
  const getAssignedType = (roomId: string | null | undefined) => (roomId ? assignments.get(roomId) : undefined);
  const unassigned = () => features.filter((feature) => !assignments.has(feature.roomId));

  features
    .filter(
      (feature) =>
        feature.isExteriorFacing &&
        feature.balconyWalls >= 1 &&
        (feature.areaRatio <= 0.32 || feature.isElongated || feature.exteriorWalls === 0)
    )
    .sort((left, right) => left.area - right.area)
    .forEach((feature) => assign(feature.roomId, "balcony"));

  features
    .filter((feature) => feature.entranceCount > 0 && feature.areaRatio <= 0.35)
    .sort((left, right) => left.area - right.area)
    .forEach((feature) => assign(feature.roomId, "foyer"));

  features
    .filter(
      (feature) =>
        feature.areaRatio <= 0.22 &&
        !feature.isExteriorFacing &&
        feature.adjacencyCount <= 2 &&
        feature.entranceCount === 0
    )
    .sort((left, right) => left.area - right.area)
    .forEach((feature) => assign(feature.roomId, "bathroom"));

  features
    .filter(
      (feature) =>
        feature.areaRatio <= 0.36 &&
        feature.isElongated &&
        feature.adjacencyCount >= 2 &&
        feature.entranceCount === 0 &&
        !feature.isExteriorFacing
    )
    .sort((left, right) => right.adjacencyCount - left.adjacencyCount || left.area - right.area)
    .forEach((feature) => assign(feature.roomId, "corridor"));

  const livingCandidate = unassigned()
    .sort((left, right) => {
      const leftScore =
        left.areaRatio * 12 +
        left.adjacencyCount * 1.8 +
        (left.entranceCount > 0 ? 1.5 : 0) +
        (left.isExteriorFacing ? 1.2 : 0) -
        (left.isElongated ? 1.5 : 0);
      const rightScore =
        right.areaRatio * 12 +
        right.adjacencyCount * 1.8 +
        (right.entranceCount > 0 ? 1.5 : 0) +
        (right.isExteriorFacing ? 1.2 : 0) -
        (right.isElongated ? 1.5 : 0);
      return rightScore - leftScore;
    })[0];
  if (livingCandidate) {
    assign(livingCandidate.roomId, "living_room");
  }

  const livingRoomId = [...assignments.entries()].find(([, roomType]) => roomType === "living_room")?.[0] ?? null;
  const kitchenCandidate = livingRoomId
    ? unassigned()
        .filter(
          (feature) =>
            feature.connectedRoomIds.has(livingRoomId) &&
            feature.areaRatio >= 0.18 &&
            feature.areaRatio <= 0.75 &&
            (feature.isExteriorFacing || feature.balconyWalls > 0 || feature.exteriorWalls > 0)
        )
        .sort((left, right) => {
          const leftScore =
            left.areaRatio * 8 +
            (left.isExteriorFacing ? 2 : 0) +
            (left.balconyWalls > 0 ? 1.5 : 0) +
            left.adjacencyCount -
            (left.entranceCount > 0 ? 2 : 0);
          const rightScore =
            right.areaRatio * 8 +
            (right.isExteriorFacing ? 2 : 0) +
            (right.balconyWalls > 0 ? 1.5 : 0) +
            right.adjacencyCount -
            (right.entranceCount > 0 ? 2 : 0);
          return rightScore - leftScore;
        })[0]
    : null;
  if (kitchenCandidate) {
    assign(kitchenCandidate.roomId, "kitchen");
  }

  const kitchenRoomId = [...assignments.entries()].find(([, roomType]) => roomType === "kitchen")?.[0] ?? null;
  if (kitchenRoomId) {
    unassigned()
      .filter(
        (feature) =>
          feature.connectedRoomIds.has(kitchenRoomId) &&
          feature.areaRatio <= 0.26 &&
          feature.isExteriorFacing &&
          !feature.isElongated &&
          feature.adjacencyCount <= 1 &&
          feature.entranceCount === 0
      )
      .sort((left, right) => left.area - right.area)
      .forEach((feature) => assign(feature.roomId, "utility"));

    unassigned()
      .filter(
        (feature) =>
          feature.connectedRoomIds.has(kitchenRoomId) &&
          feature.areaRatio <= 0.14 &&
          !feature.isExteriorFacing &&
          feature.adjacencyCount <= 1
      )
      .sort((left, right) => left.area - right.area)
      .forEach((feature) => assign(feature.roomId, "pantry"));
  }

  unassigned()
    .filter(
      (feature) =>
        feature.areaRatio >= 0.2 &&
        feature.areaRatio <= 0.72 &&
        (feature.isExteriorFacing || feature.adjacencyCount <= 2)
    )
    .sort((left, right) => right.area - left.area)
    .forEach((feature) => assign(feature.roomId, "bedroom"));

  const bedroomIds = [...assignments.entries()]
    .filter(([, roomType]) => roomType === "bedroom")
    .map(([roomId]) => roomId);

  unassigned()
    .filter(
      (feature) =>
        feature.areaRatio <= 0.16 &&
        !feature.isExteriorFacing &&
        [...feature.connectedRoomIds].some((roomId) => bedroomIds.includes(roomId))
    )
    .sort((left, right) => left.area - right.area)
    .forEach((feature) => assign(feature.roomId, "dress_room"));

  unassigned()
    .filter((feature) => feature.areaRatio <= 0.18 && feature.isExteriorFacing)
    .sort((left, right) => left.area - right.area)
    .forEach((feature) => assign(feature.roomId, "service_area"));

  return baseRooms.map((room) => {
    const feature = features.find((entry) => entry.roomId === room.id)!;
    const roomType = assignments.get(room.id) ?? "other";
    const connectedTypes = [...feature.connectedRoomIds]
      .map((roomId) => getAssignedType(roomId))
      .filter((value): value is RoomType => Boolean(value));

    const refinedRoomType =
      roomType === "other" && connectedTypes.includes("living_room") && feature.areaRatio >= 0.16 && feature.areaRatio <= 0.42
        ? "dining"
        : roomType === "other" && connectedTypes.includes("kitchen") && feature.areaRatio <= 0.16 && !feature.isExteriorFacing
          ? "pantry"
          : roomType === "other" && connectedTypes.includes("bedroom") && feature.areaRatio <= 0.16
            ? "dress_room"
            : roomType;

    const estimatedUsage: RoomUsage = ["living_room", "kitchen", "dining"].includes(refinedRoomType)
      ? "primary"
      : ["bathroom", "utility", "service_area"].includes(refinedRoomType)
        ? "service"
        : "secondary";

    const estimatedCeilingHeight =
      refinedRoomType === "bathroom"
        ? 2.55
        : refinedRoomType === "balcony"
          ? 2.45
          : ["foyer", "corridor", "utility", "service_area"].includes(refinedRoomType)
            ? 2.65
            : 2.8;

    return {
      ...room,
      roomType: refinedRoomType,
      label: humanizeRoomType(refinedRoomType),
      centroid: room.centroid,
      openingIds: [...feature.openingIds].sort(),
      connectedRoomIds: [...feature.connectedRoomIds].sort(),
      estimatedCeilingHeight,
      estimatedUsage,
      isExteriorFacing: feature.isExteriorFacing
    };
  });
}

function buildFloorZones(rooms: RoomPolygon[]): FloorZone[] {
  return rooms.map((room) => ({
    id: `floor-${room.id}`,
    roomId: room.id,
    outline: room.polygon,
    materialId: null,
    roomType: room.roomType
  }));
}

function buildCeilingZones(rooms: RoomPolygon[]): CeilingZone[] {
  return rooms.map((room) => ({
    id: `ceiling-${room.id}`,
    roomId: room.id,
    outline: room.polygon,
    materialId: null,
    roomType: room.roomType,
    height: room.estimatedCeilingHeight
  }));
}

function lerpPoint(from: Vec2, to: Vec2, ratio: number): Vec2 {
  return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
}

function buildCameraAnchors(rooms: RoomPolygon[], roomAdjacency: RoomAdjacency[], openings: TopologyOpening[], exteriorShell: Vec2[]) {
  const largestRoom = [...rooms].sort((left, right) => right.area - left.area)[0] ?? null;
  const anchors: CameraAnchor[] = rooms.map((room) => ({
    id: `anchor-room-${room.id}`,
    kind: "room_center",
    roomId: room.id,
    openingId: null,
    planPosition: room.centroid,
    targetPlanPosition: room.centroid,
    height: Math.min(room.estimatedCeilingHeight * 0.68, 1.65)
  }));

  const entranceAdjacency = roomAdjacency.find((entry) => entry.relation === "entrance");
  const entranceOpening =
    (entranceAdjacency ? openings.find((opening) => opening.id === entranceAdjacency.openingId) : null) ??
    openings.find((opening) => opening.isEntrance);
  const entranceRoomId = entranceAdjacency?.fromRoomId ?? entranceAdjacency?.toRoomId ?? null;
  const entranceRoom = entranceRoomId ? rooms.find((room) => room.id === entranceRoomId) ?? null : null;
  if (entranceOpening) {
    const fallbackTarget = entranceRoom?.centroid ?? polygonCentroid(exteriorShell.length >= 3 ? exteriorShell : rooms.map((room) => room.centroid));
    anchors.unshift({
      id: "anchor-entrance",
      kind: "entrance",
      roomId: entranceRoom?.id ?? null,
      openingId: entranceOpening.id,
      planPosition: entranceRoom ? lerpPoint(entranceOpening.position, entranceRoom.centroid, 0.2) : entranceOpening.position,
      targetPlanPosition: fallbackTarget,
      height: 1.6
    });
  }

  const overviewCenter =
    largestRoom?.centroid ??
    (exteriorShell.length >= 3 ? polygonCentroid(exteriorShell) : ([0, 0] as Vec2));
  anchors.push({
    id: "anchor-overview",
    kind: "overview",
    roomId: largestRoom?.id ?? null,
    openingId: null,
    planPosition: overviewCenter,
    targetPlanPosition: overviewCenter,
    height: 1.75
  });

  return anchors;
}

function buildNavGraph(rooms: RoomPolygon[], roomAdjacency: RoomAdjacency[], cameraAnchors: CameraAnchor[]) {
  const roomNodes: NavNode[] = rooms.map((room) => ({
    id: `nav-room-${room.id}`,
    roomId: room.id,
    kind: "room_center",
    planPosition: room.centroid
  }));

  const entranceAnchor = cameraAnchors.find((anchor) => anchor.kind === "entrance");
  const entranceNode: NavNode[] = entranceAnchor
    ? [
        {
          id: "nav-entrance",
          roomId: entranceAnchor.roomId,
          kind: "entrance",
          planPosition: entranceAnchor.planPosition
        }
      ]
    : [];

  const roomNodeIds = new Map(roomNodes.map((node) => [node.roomId, node.id] as const));
  const edges = roomAdjacency.reduce<NavEdge[]>((accumulator, adjacency) => {
    if (adjacency.relation === "window") {
      return accumulator;
    }

    if (adjacency.relation === "entrance" && entranceAnchor) {
      const roomId = adjacency.fromRoomId ?? adjacency.toRoomId;
      const roomNodeId = roomId ? roomNodeIds.get(roomId) : null;
      if (roomNodeId) {
        accumulator.push({
          id: `edge-${adjacency.id}`,
          fromNodeId: "nav-entrance",
          toNodeId: roomNodeId,
          relation: "entrance",
          openingId: adjacency.openingId
        });
      }
      return accumulator;
    }

    if (!adjacency.fromRoomId || !adjacency.toRoomId) {
      return accumulator;
    }

    const fromNodeId = roomNodeIds.get(adjacency.fromRoomId);
    const toNodeId = roomNodeIds.get(adjacency.toRoomId);
    if (!fromNodeId || !toNodeId) {
      return accumulator;
    }

    accumulator.push({
      id: `edge-${adjacency.id}`,
      fromNodeId,
      toNodeId,
      relation: adjacency.relation === "passage" ? "passage" : "door",
      openingId: adjacency.openingId
    });
    return accumulator;
  }, []);

  const dedupedEdges = edges.filter(
    (edge, index, collection) => collection.findIndex((candidate) => candidate.id === edge.id) === index
  );

  return {
    nodes: [...entranceNode, ...roomNodes],
    edges: dedupedEdges
  };
}

export function buildGeometry(topology: { walls: TopologyWall[]; openings: TopologyOpening[]; scale: number }): GeometryBuildResult {
  const wallCoordinates = topology.walls.map((wall) => ({
    id: wall.id,
    start: wall.start,
    end: wall.end,
    thickness: wall.thickness,
    type: wall.type,
    length: wall.length,
    confidence: wall.confidence
  }));

  const { points, adjacency } = buildAdjacencyGraph(topology.walls);
  const loops = dedupeAndFilterLoops(buildLoops(points, adjacency));
  const { exteriorShell, roomPolygons: baseRoomPolygons } = deriveRoomPolygons(loops);
  const roomAdjacency = buildRoomAdjacency(baseRoomPolygons as RoomPolygon[], topology.walls, topology.openings);
  const roomPolygons = classifyRooms(baseRoomPolygons, roomAdjacency, topology.walls);
  const floorZones = buildFloorZones(roomPolygons);
  const ceilingZones = buildCeilingZones(roomPolygons);
  const cameraAnchors = buildCameraAnchors(roomPolygons, roomAdjacency, topology.openings, exteriorShell);
  const navGraph = buildNavGraph(roomPolygons, roomAdjacency, cameraAnchors);

  return {
    wallCoordinates,
    roomPolygons,
    exteriorShell,
    roomAdjacency,
    floorZones,
    ceilingZones,
    cameraAnchors,
    navGraph,
    scale: topology.scale
  };
}
