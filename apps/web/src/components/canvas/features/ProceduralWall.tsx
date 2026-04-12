"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { Geometry, Base, Subtraction } from "@react-three/csg";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useShellSelector } from "../../../lib/stores/scene-slices";

type TextureManifestEntry = {
  id: string;
  maps: Record<string, string>;
};

function WallMesh({
  wallId,
  materialTemplate,
  onToggle
}: {
  wallId: string;
  materialTemplate: THREE.Material;
  onToggle: () => void;
}) {
  const walls = useShellSelector((slice) => slice.walls);
  const openings = useShellSelector((slice) => slice.openings);
  const scale = useShellSelector((slice) => slice.scale);
  const wall = useMemo(() => walls.find((item) => item.id === wallId), [wallId, walls]);
  const material = useMemo(() => materialTemplate.clone(), [materialTemplate]);

  const wallOpenings = useMemo(() => openings.filter((opening) => opening.wallId === wallId), [openings, wallId]);

  const { baseGeometry, holeGeometries, position, rotation } = useMemo(() => {
    if (!wall) {
      return { baseGeometry: null, holeGeometries: [], position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };
    }
    const dx = wall.end[0] - wall.start[0];
    const dy = wall.end[1] - wall.start[1];
    const lengthPx = Math.hypot(dx, dy);
    const length = Math.max(0.05, lengthPx * scale);
    const thickness = Math.max(0.02, wall.thickness * scale);
    const height = wall.height > 0 ? wall.height : 2.8;
    const angle = Math.atan2(dy, dx);

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(length, 0);
    shape.lineTo(length, thickness);
    shape.lineTo(0, thickness);
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, height, -thickness / 2);
    geometry.computeVertexNormals();

    const holes = wallOpenings
      .map((opening) => {
        const offset = opening.offset * scale;
        const width = opening.width * scale;
        const baseHeight = opening.height * scale;
        if (width <= 0.05 || baseHeight <= 0.05) return null;
        const usableWidth = Math.min(width, length - offset);
        if (usableWidth <= 0.05) return null;
        const bottomOffset =
          typeof opening.verticalOffset === "number"
            ? opening.verticalOffset * scale
            : typeof opening.sillHeight === "number"
              ? opening.sillHeight * scale
              : opening.type === "window"
                ? 0.9
                : 0;
        const holeHeight = Math.min(baseHeight, height - bottomOffset);
        if (holeHeight <= 0.05) return null;
        const depth = thickness + 0.1;
        const holeGeometry = new THREE.BoxGeometry(usableWidth, holeHeight, depth);
        holeGeometry.translate(offset + usableWidth / 2, bottomOffset + holeHeight / 2, 0);
        return holeGeometry;
      })
      .filter((entry): entry is THREE.BoxGeometry => Boolean(entry));

    return {
      baseGeometry: geometry,
      holeGeometries: holes,
      position: [wall.start[0] * scale, 0, wall.start[1] * scale] as [number, number, number],
      rotation: [0, angle, 0] as [number, number, number]
    };
  }, [scale, wall, wallOpenings]);

  useEffect(() => {
    return () => {
      baseGeometry?.dispose();
      holeGeometries.forEach((geometry) => geometry.dispose());
      material.dispose();
    };
  }, [baseGeometry, holeGeometries, material]);

  if (!wall || !baseGeometry) return null;

  return (
    <mesh
      name={`wall:${wall.id}`}
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
      onPointerDown={onToggle}
    >
      <Geometry computeVertexNormals>
        <Base geometry={baseGeometry} />
        {holeGeometries.map((geometry, index) => (
          <Subtraction key={`${wall.id}-hole-${index}`} geometry={geometry} />
        ))}
      </Geometry>
      <primitive object={material} attach="material" />
    </mesh>
  );
}

export default function ProceduralWall() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const wallMaterialIndex = useShellSelector((slice) => slice.wallMaterialIndex);
  const setWallMaterialIndex = useShellSelector((slice) => slice.setWallMaterialIndex);
  const walls = useShellSelector((slice) => slice.walls);

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

  const textureSources = useMemo(() => {
    const pickTexture = (id: string) => manifest.find((entry) => entry.id === id)?.maps ?? {};
    const plaster = pickTexture("white_plaster_02");
    const painted = pickTexture("painted_plaster_wall");
    const concrete = pickTexture("concrete_wall_007");
    return {
      plasterDiffuse: plaster.diffuse ?? "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_diff_2k.jpg",
      plasterRough: plaster.roughness ?? "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_rough_2k.jpg",
      plasterNormal: plaster.normal ?? "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_disp_2k.png",
      plasterBump: plaster.displacement ?? "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_disp_2k.png",
      paintedDiffuse: painted.diffuse ?? "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_diff_2k.jpg",
      paintedRough: painted.roughness ?? "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
      paintedNormal: painted.normal ?? "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
      paintedBump: painted.displacement ?? "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
      concreteDiffuse: concrete.diffuse ?? "/assets/textures/concrete_wall_007_2k.blend/textures/concrete_wall_007_diff_2k.jpg",
      concreteRough: concrete.roughness ?? "/assets/textures/concrete_wall_007_2k.blend/textures/concrete_wall_007_disp_2k.png",
      concreteNormal: concrete.normal ?? "/assets/textures/concrete_wall_007_2k.blend/textures/concrete_wall_007_disp_2k.png",
      concreteBump: concrete.displacement ?? "/assets/textures/concrete_wall_007_2k.blend/textures/concrete_wall_007_disp_2k.png"
    };
  }, [manifest]);

  const textures = useTexture(textureSources);

  useEffect(() => {
    Object.values(textures).forEach((texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      texture.anisotropy = 4;
    });
    textures.plasterDiffuse.colorSpace = THREE.SRGBColorSpace;
    textures.paintedDiffuse.colorSpace = THREE.SRGBColorSpace;
    textures.concreteDiffuse.colorSpace = THREE.SRGBColorSpace;
    textures.plasterRough.colorSpace = THREE.NoColorSpace;
    textures.paintedRough.colorSpace = THREE.NoColorSpace;
    textures.concreteRough.colorSpace = THREE.NoColorSpace;
    textures.plasterNormal.colorSpace = THREE.NoColorSpace;
    textures.paintedNormal.colorSpace = THREE.NoColorSpace;
    textures.concreteNormal.colorSpace = THREE.NoColorSpace;
    textures.plasterBump.colorSpace = THREE.NoColorSpace;
    textures.paintedBump.colorSpace = THREE.NoColorSpace;
    textures.concreteBump.colorSpace = THREE.NoColorSpace;
  }, [textures]);

  const materials = useMemo(() => {
    return [
      new THREE.MeshStandardMaterial({
        color: "#f3f2ef",
        map: textures.plasterDiffuse,
        roughnessMap: textures.plasterRough,
        normalMap: textures.plasterNormal,
        bumpMap: textures.plasterBump,
        bumpScale: 0.012,
        roughness: 0.85,
        normalScale: new THREE.Vector2(0.3, 0.3),
        envMapIntensity: 0.5
      }),
      new THREE.MeshStandardMaterial({
        color: "#e0e0e0",
        map: textures.paintedDiffuse,
        roughnessMap: textures.paintedRough,
        normalMap: textures.paintedNormal,
        bumpMap: textures.paintedBump,
        bumpScale: 0.012,
        roughness: 0.7,
        normalScale: new THREE.Vector2(0.3, 0.3),
        envMapIntensity: 0.4
      }),
      new THREE.MeshStandardMaterial({
        color: "#333333",
        map: textures.concreteDiffuse,
        roughnessMap: textures.concreteRough,
        normalMap: textures.concreteNormal,
        bumpMap: textures.concreteBump,
        bumpScale: 0.015,
        roughness: 0.92,
        normalScale: new THREE.Vector2(0.35, 0.35),
        envMapIntensity: 0.25
      })
    ];
  }, [textures]);

  useEffect(() => {
    return () => {
      materials.forEach((material) => material.dispose());
    };
  }, [materials]);

  const activeMaterial = materials[wallMaterialIndex % materials.length] ?? materials[0];

  return (
    <group>
      {walls.map((wall) => {
        return (
          <WallMesh
            key={wall.id}
            wallId={wall.id}
            materialTemplate={activeMaterial}
            onToggle={() => {
              if (viewMode !== "top") return;
              setWallMaterialIndex((wallMaterialIndex + 1) % materials.length);
            }}
          />
        );
      })}
    </group>
  );
}
