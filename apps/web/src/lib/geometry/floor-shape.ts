"use client";

import * as THREE from "three";
import type { Wall } from "../stores/useSceneStore";

type Point = { key: string; x: number; y: number };

type LoopResult = {
  points: [number, number][];
  area: number;
};

type PolygonResult = {
  shape: THREE.Shape;
  points: [number, number][];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

function getSnapTolerance(walls: Wall[]) {
  const thicknesses = walls
    .map((wall) => wall.thickness)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (thicknesses.length === 0) return 2;
  const sorted = [...thicknesses].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 2;
  return Math.max(2, Math.min(8, median * 0.4));
}

function snapValue(value: number, tolerance: number) {
  return Math.round(value / tolerance) * tolerance;
}

function pointKey(x: number, y: number) {
  return `${x},${y}`;
}

function buildLoop(points: Map<string, Point>, adjacency: Map<string, string[]>) {
  const edgeUsed = new Set<string>();
  const loops: LoopResult[] = [];

  const edges = Array.from(adjacency.entries()).flatMap(([from, neighbors]) =>
    neighbors.map((to) => ({ from, to }))
  );

  const edgeKey = (from: string, to: string) => `${from}->${to}`;

  const pickNext = (prev: Point, current: Point, candidates: string[]) => {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    const dirX = current.x - prev.x;
    const dirY = current.y - prev.y;
    let best: string | null = null;
    let bestAngle = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const next = points.get(candidate);
      if (!next) continue;
      const vx = next.x - current.x;
      const vy = next.y - current.y;
      const cross = dirX * vy - dirY * vx;
      const dot = dirX * vx + dirY * vy;
      const angle = Math.atan2(cross, dot);
      const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
      if (normalized < bestAngle) {
        bestAngle = normalized;
        best = candidate;
      }
    }

    return best;
  };

  for (const edge of edges) {
    const startPoint = points.get(edge.from);
    const nextPoint = points.get(edge.to);
    if (!startPoint || !nextPoint) continue;
    const key = edgeKey(edge.from, edge.to);
    if (edgeUsed.has(key)) continue;

    const loop: [number, number][] = [[startPoint.x, startPoint.y]];
    let prev = startPoint;
    let current = nextPoint;
    edgeUsed.add(key);
    edgeUsed.add(edgeKey(edge.to, edge.from));

    const maxSteps = edges.length + 5;
    let steps = 0;

    while (steps < maxSteps) {
      loop.push([current.x, current.y]);
      if (current.key === startPoint.key) {
        break;
      }
      const neighbors = adjacency.get(current.key) ?? [];
      const candidates = neighbors.filter((neighbor) => neighbor !== prev.key);
      const nextKey = pickNext(prev, current, candidates);
      if (!nextKey) break;
      edgeUsed.add(edgeKey(current.key, nextKey));
      edgeUsed.add(edgeKey(nextKey, current.key));
      prev = current;
      const nextPointCandidate = points.get(nextKey);
      if (!nextPointCandidate) break;
      current = nextPointCandidate;
      steps += 1;
    }

    if (loop.length > 3 && loop[0][0] === loop[loop.length - 1]?.[0] && loop[0][1] === loop[loop.length - 1]?.[1]) {
      const area = polygonArea(loop.slice(0, -1));
      loops.push({ points: loop.slice(0, -1), area });
    }
  }

  return loops;
}

function polygonArea(points: [number, number][]) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function buildExteriorPolygon(walls: Wall[], scale: number): PolygonResult | null {
  const exteriorWalls =
    walls.filter((wall) => wall.type === "exterior" || wall.type === "balcony" || wall.isPartOfBalcony) || [];
  const candidateWalls = exteriorWalls.length >= 3 ? exteriorWalls : walls;

  if (candidateWalls.length < 3) return null;

  const points = new Map<string, Point>();
  const adjacency = new Map<string, string[]>();
  const snapTolerance = getSnapTolerance(candidateWalls);

  const registerPoint = (x: number, y: number) => {
    const sx = snapValue(x, snapTolerance);
    const sy = snapValue(y, snapTolerance);
    const key = pointKey(sx, sy);
    if (!points.has(key)) {
      points.set(key, { key, x: sx, y: sy });
    }
    return key;
  };

  const addNeighbor = (from: string, to: string) => {
    const list = adjacency.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    adjacency.set(from, list);
  };

  candidateWalls.forEach((wall) => {
    const startKey = registerPoint(wall.start[0], wall.start[1]);
    const endKey = registerPoint(wall.end[0], wall.end[1]);
    addNeighbor(startKey, endKey);
    addNeighbor(endKey, startKey);
  });

  const loops = buildLoop(points, adjacency);
  if (loops.length === 0) return null;
  const best = loops.reduce((acc, loop) => (Math.abs(loop.area) > Math.abs(acc.area) ? loop : acc));
  const scaledPoints = best.points.map(([x, y]) => [x * scale, y * scale] as [number, number]);

  const shape = new THREE.Shape();
  shape.moveTo(scaledPoints[0][0], scaledPoints[0][1]);
  for (let i = 1; i < scaledPoints.length; i += 1) {
    shape.lineTo(scaledPoints[i][0], scaledPoints[i][1]);
  }
  shape.closePath();

  const bounds = scaledPoints.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      maxX: Math.max(acc.maxX, x),
      minY: Math.min(acc.minY, y),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY }
  );

  return { shape, points: scaledPoints, bounds };
}

export function buildFallbackShape(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  const shape = new THREE.Shape();
  shape.moveTo(bounds.minX, bounds.minZ);
  shape.lineTo(bounds.maxX, bounds.minZ);
  shape.lineTo(bounds.maxX, bounds.maxZ);
  shape.lineTo(bounds.minX, bounds.maxZ);
  shape.closePath();
  return shape;
}
