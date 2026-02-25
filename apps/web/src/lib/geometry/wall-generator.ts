import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

export type WallInput = {
  id: string;
  start: [number, number];
  end: [number, number];
  thickness: number;
  height: number;
};

export type OpeningInput = {
  id: string;
  wallId: string;
  type: "door" | "window";
  offset: number;
  width: number;
  height: number;
};

export type WallMeshData = {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  rotation: [number, number, number];
  dispose: () => void;
};

type WallGeneratorOptions = {
  wall: WallInput;
  openings: OpeningInput[];
  scale?: number;
  wallHeightFallback?: number;
};

const MIN_THICKNESS = 0.02;
const MIN_WALL_LENGTH = 0.05;
const MIN_OPENING_SIZE = 0.05;

export function buildWallMeshData(options: WallGeneratorOptions): WallMeshData | null {
  const { wall, openings, scale = 1, wallHeightFallback = 2.8 } = options;

  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const lengthPx = Math.hypot(dx, dy);
  if (!Number.isFinite(lengthPx) || lengthPx * scale < MIN_WALL_LENGTH) return null;

  const length = lengthPx * scale;
  const thickness = Math.max(MIN_THICKNESS, wall.thickness * scale);
  const height = Number.isFinite(wall.height) && wall.height > 0 ? wall.height : wallHeightFallback;
  const angle = Math.atan2(dy, dx);

  const baseGeometry = new THREE.BoxGeometry(length, height, thickness);
  baseGeometry.translate(length / 2, height / 2, 0);

  const baseBrush = new Brush(baseGeometry);
  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  let current = baseBrush;
  const geometries = new Set<THREE.BufferGeometry>([baseGeometry]);

  openings
    .filter((opening) => opening.wallId === wall.id)
    .forEach((opening) => {
      const offset = opening.offset * scale;
      const width = opening.width * scale;
      const openingHeight = opening.height * scale;

      if (width < MIN_OPENING_SIZE || openingHeight < MIN_OPENING_SIZE) return;
      if (offset < 0 || offset >= length) return;

      const usableWidth = Math.min(width, length - offset);
      if (usableWidth < MIN_OPENING_SIZE) return;

      const bottom = 0;
      const holeHeight = Math.min(openingHeight, height - bottom);
      if (holeHeight < MIN_OPENING_SIZE) return;

      const depth = thickness + 0.05;
      const holeGeometry = new THREE.BoxGeometry(usableWidth, holeHeight, depth);
      holeGeometry.translate(offset + usableWidth / 2, bottom + holeHeight / 2, 0);
      geometries.add(holeGeometry);

      const holeBrush = new Brush(holeGeometry);
      current = evaluator.evaluate(current, holeBrush, SUBTRACTION);
      geometries.add(current.geometry as THREE.BufferGeometry);
    });

  const resultGeometry = current.geometry as THREE.BufferGeometry;
  resultGeometry.computeVertexNormals();

  const position: [number, number, number] = [wall.start[0] * scale, 0, wall.start[1] * scale];
  const rotation: [number, number, number] = [0, angle, 0];

  return {
    geometry: resultGeometry,
    position,
    rotation,
    dispose: () => {
      geometries.forEach((geometry) => geometry.dispose());
    }
  };
}
