"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useSceneStore } from "../../../lib/stores/useSceneStore";
import { buildExteriorPolygon, buildFallbackShape } from "../../../lib/geometry/floor-shape";

type TextureManifestEntry = {
  id: string;
  maps: Record<string, string>;
};

function computeBounds(walls: { start: [number, number]; end: [number, number] }[], scale: number) {
  if (walls.length === 0) {
    return { minX: -2.5, maxX: 2.5, minZ: -2.5, maxZ: 2.5 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  walls.forEach((wall) => {
    const points = [wall.start, wall.end];
    points.forEach(([x, z]) => {
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

export default function ProceduralFloor() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const walls = useSceneStore((state) => state.walls);
  const scale = useSceneStore((state) => state.scale);
  const floorMaterialIndex = useSceneStore((state) => state.floorMaterialIndex);
  const setFloorMaterialIndex = useSceneStore((state) => state.setFloorMaterialIndex);

  const [manifest, setManifest] = useState<TextureManifestEntry[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/assets/textures/manifest.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Texture manifest missing"))))
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        setManifest(data as TextureManifestEntry[]);
      })
      .catch(() => {
        if (active) setManifest([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const bounds = useMemo(() => computeBounds(walls, scale), [walls, scale]);
  const exterior = useMemo(() => buildExteriorPolygon(walls, scale), [walls, scale]);
  const fallbackShape = useMemo(() => buildFallbackShape(bounds), [bounds]);
  const shape = exterior?.shape ?? fallbackShape;
  const shapeBounds = exterior?.bounds ?? {
    minX: bounds.minX,
    maxX: bounds.maxX,
    minY: bounds.minZ,
    maxY: bounds.maxZ
  };

  const width = Math.max(1, shapeBounds.maxX - shapeBounds.minX);
  const depth = Math.max(1, shapeBounds.maxY - shapeBounds.minY);

  const geometry = useMemo(() => {
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);
    if (geo.attributes.uv) {
      geo.setAttribute("uv2", geo.attributes.uv.clone());
    }
    return geo;
  }, [shape]);

  const textureSources = useMemo(() => {
    const pickTexture = (id: string) => manifest.find((entry) => entry.id === id)?.maps ?? {};
    const wood = pickTexture("wood_floor");
    const concrete = pickTexture("concrete_floor_worn_001");
    const marble = pickTexture("marble_01");
    return {
      woodDiffuse: wood.diffuse ?? "/assets/textures/weathered_brown_planks_2k.blend/textures/weathered_brown_planks_diff_2k.jpg",
      woodRough: wood.roughness ?? "/assets/textures/weathered_brown_planks_2k.blend/textures/weathered_brown_planks_rough_2k.jpg",
      woodNormal: wood.normal ?? "/assets/textures/weathered_brown_planks_2k.blend/textures/weathered_brown_planks_disp_2k.png",
      woodBump: wood.displacement ?? "/assets/textures/weathered_brown_planks_2k.blend/textures/weathered_brown_planks_disp_2k.png",
      concreteDiffuse: concrete.diffuse ?? "/assets/textures/concrete_floor_worn_001_2k.blend/textures/concrete_floor_worn_001_diff_2k.jpg",
      concreteRough: concrete.roughness ?? "/assets/textures/concrete_floor_worn_001_2k.blend/textures/concrete_floor_worn_001_rough_2k.jpg",
      concreteNormal: concrete.normal ?? "/assets/textures/concrete_floor_worn_001_2k.blend/textures/concrete_floor_worn_001_disp_2k.png",
      concreteBump: concrete.displacement ?? "/assets/textures/concrete_floor_worn_001_2k.blend/textures/concrete_floor_worn_001_disp_2k.png",
      marbleDiffuse: marble.diffuse ?? "/assets/textures/marble_01_2k.blend/textures/marble_01_diff_2k.jpg",
      marbleRough: marble.roughness ?? "/assets/textures/marble_01_2k.blend/textures/marble_01_rough_2k.jpg",
      marbleNormal: marble.normal ?? "/assets/textures/marble_01_2k.blend/textures/marble_01_disp_2k.png",
      marbleBump: marble.displacement ?? "/assets/textures/marble_01_2k.blend/textures/marble_01_disp_2k.png"
    };
  }, [manifest]);

  const textures = useTexture(textureSources);

  useEffect(() => {
    Object.values(textures).forEach((texture) => {
      if (!texture) return;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(width / 2, depth / 2);
      texture.anisotropy = 4;
    });
    textures.woodDiffuse.colorSpace = THREE.SRGBColorSpace;
    textures.concreteDiffuse.colorSpace = THREE.SRGBColorSpace;
    textures.marbleDiffuse.colorSpace = THREE.SRGBColorSpace;
    textures.woodRough.colorSpace = THREE.NoColorSpace;
    textures.concreteRough.colorSpace = THREE.NoColorSpace;
    textures.marbleRough.colorSpace = THREE.NoColorSpace;
    textures.woodNormal.colorSpace = THREE.NoColorSpace;
    textures.concreteNormal.colorSpace = THREE.NoColorSpace;
    textures.marbleNormal.colorSpace = THREE.NoColorSpace;
    textures.woodBump.colorSpace = THREE.NoColorSpace;
    textures.concreteBump.colorSpace = THREE.NoColorSpace;
    textures.marbleBump.colorSpace = THREE.NoColorSpace;
  }, [depth, textures, width]);

  const materials = useMemo(() => {
    return [
      new THREE.MeshStandardMaterial({
        map: textures.woodDiffuse,
        roughnessMap: textures.woodRough,
        normalMap: textures.woodNormal,
        bumpMap: textures.woodBump,
        bumpScale: 0.012,
        roughness: 0.7,
        normalScale: new THREE.Vector2(0.35, 0.35),
        side: THREE.DoubleSide
      }),
      new THREE.MeshStandardMaterial({
        map: textures.concreteDiffuse,
        roughnessMap: textures.concreteRough,
        normalMap: textures.concreteNormal,
        bumpMap: textures.concreteBump,
        bumpScale: 0.015,
        roughness: 0.9,
        normalScale: new THREE.Vector2(0.35, 0.35),
        side: THREE.DoubleSide
      }),
      new THREE.MeshStandardMaterial({
        map: textures.marbleDiffuse,
        roughnessMap: textures.marbleRough,
        normalMap: textures.marbleNormal,
        bumpMap: textures.marbleBump,
        bumpScale: 0.01,
        roughness: 0.5,
        normalScale: new THREE.Vector2(0.3, 0.3),
        side: THREE.DoubleSide
      })
    ];
  }, [textures]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  useEffect(() => {
    return () => {
      materials.forEach((material) => material.dispose());
    };
  }, [materials]);

  const activeMaterial = materials[floorMaterialIndex % materials.length];

  return (
    <mesh
      name="floor"
      geometry={geometry}
      receiveShadow
      onPointerDown={() => {
        if (viewMode !== "top") return;
        setFloorMaterialIndex((floorMaterialIndex + 1) % materials.length);
      }}
    >
      <primitive object={activeMaterial} attach="material" />
    </mesh>
  );
}
