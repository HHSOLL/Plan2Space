import type { TopologyOpening, TopologyWall, Vec2 } from "@plan2space/floorplan-core";

type PointNode = { key: string; x: number; y: number };

type LoopResult = {
  points: Vec2[];
  area: number;
  centroid: Vec2;
};

type RoomAdjacency = {
  id: string;
  fromRoomId: string | null;
  toRoomId: string | null;
  openingId: string;
  relation: "door" | "window" | "passage" | "entrance";
};

type RoomPolygon = {
  id: string;
  polygon: Vec2[];
  area: number;
  type: "room";
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
      roomPolygons: [] as RoomPolygon[]
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
      type: "room" as const
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

export function buildGeometry(topology: { walls: TopologyWall[]; openings: TopologyOpening[]; scale: number }) {
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
  const { exteriorShell, roomPolygons } = deriveRoomPolygons(loops);
  const roomAdjacency = buildRoomAdjacency(roomPolygons, topology.walls, topology.openings);

  return {
    wallCoordinates,
    roomPolygons,
    exteriorShell,
    roomAdjacency,
    scale: topology.scale
  };
}
