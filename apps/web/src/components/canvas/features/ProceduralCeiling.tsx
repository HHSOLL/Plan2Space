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
  const floors = useSceneStore((state) => state.floors);
  const ceilings = useSceneStore((state) => state.ceilings);
  const scale = useSceneStore((state) => state.scale);

  const bounds = useMemo(() => computeBounds(walls, scale), [walls, scale]);
  const exterior = useMemo(() => buildExteriorPolygon(walls, scale), [walls, scale]);
  const fallbackShape = useMemo(() => buildFallbackShape(bounds), [bounds]);
  const shape = exterior?.shape ?? fallbackShape;
  const wallHeight = useMemo(() => {
    if (ceilings.length > 0) {
      return ceilings.reduce((max, ceiling) => Math.max(max, ceiling.height || DEFAULT_HEIGHT), DEFAULT_HEIGHT);
    }
    if (walls.length === 0) return DEFAULT_HEIGHT;
    return walls.reduce((max, wall) => Math.max(max, wall.height || DEFAULT_HEIGHT), DEFAULT_HEIGHT);
  }, [ceilings, walls]);
  const geometries = useMemo(() => {
    if (ceilings.length > 0) {
      return ceilings
        .map((ceiling) => {
          if (!Array.isArray(ceiling.outline) || ceiling.outline.length < 3) return null;
          const floorShape = new THREE.Shape();
          floorShape.moveTo(ceiling.outline[0]![0] * scale, ceiling.outline[0]![1] * scale);
          for (let index = 1; index < ceiling.outline.length; index += 1) {
            floorShape.lineTo(ceiling.outline[index]![0] * scale, ceiling.outline[index]![1] * scale);
          }
          floorShape.closePath();
          const geometry = new THREE.ShapeGeometry(floorShape);
          geometry.rotateX(Math.PI / 2);
          return {
            id: ceiling.id,
            geometry
          };
        })
        .filter((entry): entry is { id: string; geometry: THREE.ShapeGeometry } => Boolean(entry));
    }

    if (floors.length > 0) {
      return floors
        .map((floor) => {
          if (!Array.isArray(floor.outline) || floor.outline.length < 3) return null;
          const floorShape = new THREE.Shape();
          floorShape.moveTo(floor.outline[0]![0] * scale, floor.outline[0]![1] * scale);
          for (let index = 1; index < floor.outline.length; index += 1) {
            floorShape.lineTo(floor.outline[index]![0] * scale, floor.outline[index]![1] * scale);
          }
          floorShape.closePath();
          const geometry = new THREE.ShapeGeometry(floorShape);
          geometry.rotateX(Math.PI / 2);
          return {
            id: floor.id,
            geometry
          };
        })
        .filter((entry): entry is { id: string; geometry: THREE.ShapeGeometry } => Boolean(entry));
    }

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);
    return [{ id: "fallback-ceiling", geometry: geo }];
  }, [ceilings, floors, scale, shape]);

  useEffect(() => {
    return () => {
      geometries.forEach((entry) => entry.geometry.dispose());
    };
  }, [geometries]);

  return (
    <group position={[0, wallHeight, 0]} visible={viewMode === "walk"}>
      {geometries.map((entry) => (
        <mesh key={entry.id} geometry={entry.geometry} castShadow receiveShadow>
          <meshStandardMaterial color="#1f1f1f" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
