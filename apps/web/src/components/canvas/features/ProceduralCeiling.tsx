"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useSceneStore } from "../../../lib/stores/useSceneStore";
import { buildExteriorPolygon, buildFallbackShape } from "../../../lib/geometry/floor-shape";

const DEFAULT_HEIGHT = 2.8;

function computeBounds(walls: { start: [number, number]; end: [number, number] }[], scale: number) {
  if (walls.length === 0) {
    return { minX: -2.5, maxX: 2.5, minZ: -2.5, maxZ: 2.5 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  walls.forEach((wall) => {
    [wall.start, wall.end].forEach(([x, z]) => {
      const scaledX = x * scale;
      const scaledZ = z * scale;
      minX = Math.min(minX, scaledX);
      maxX = Math.max(maxX, scaledX);
      minZ = Math.min(minZ, scaledZ);
      maxZ = Math.max(maxZ, scaledZ);
    });
  });

  return { minX, maxX, minZ, maxZ };
}

export default function ProceduralCeiling() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const walls = useSceneStore((state) => state.walls);
  const scale = useSceneStore((state) => state.scale);

  const bounds = useMemo(() => computeBounds(walls, scale), [walls, scale]);
  const exterior = useMemo(() => buildExteriorPolygon(walls, scale), [walls, scale]);
  const fallbackShape = useMemo(() => buildFallbackShape(bounds), [bounds]);
  const shape = exterior?.shape ?? fallbackShape;
  const wallHeight = useMemo(() => {
    if (walls.length === 0) return DEFAULT_HEIGHT;
    return walls.reduce((max, wall) => Math.max(max, wall.height || DEFAULT_HEIGHT), DEFAULT_HEIGHT);
  }, [walls]);
  const geometry = useMemo(() => {
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);
    return geo;
  }, [shape]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[0, wallHeight, 0]}
      visible={viewMode === "walk"}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color="#1f1f1f" roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}
