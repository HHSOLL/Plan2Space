"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { Geometry, Base, Subtraction } from "@react-three/csg";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useShellSelector } from "../../../lib/stores/scene-slices";
import type { Wall } from "../../../lib/stores/useSceneStore";
import { getWallRenderPlacement } from "../../../lib/geometry/wall-placement";

type WallTextureConfig = {
  topColor: string;
  map: string;
  roughnessMap: string;
  normalMap: string;
  bumpMap: string;
  color: string;
  roughness: number;
  bumpScale: number;
  normalScale: number;
  envMapIntensity: number;
};

const WALL_TEXTURES: WallTextureConfig[] = [
  {
    topColor: "#d8d1c8",
    map: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_rough_2k.jpg",
    normalMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_disp_2k.png",
    bumpMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_disp_2k.png",
    color: "#f3f2ef",
    roughness: 0.85,
    bumpScale: 0.012,
    normalScale: 0.3,
    envMapIntensity: 0.5
  },
  {
    topColor: "#babcc0",
    map: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_diff_2k.jpg",
    roughnessMap: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
    normalMap: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
    bumpMap: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
    color: "#e0e0e0",
    roughness: 0.7,
    bumpScale: 0.012,
    normalScale: 0.3,
    envMapIntensity: 0.4
  },
  {
    topColor: "#6a6865",
    map: "/assets/textures/concrete_wall_007_2k.blend/textures/concrete_wall_007_diff_2k.jpg",
    roughnessMap: "/assets/textures/concrete_wall_007_2k.blend/textures/concrete_wall_007_disp_2k.png",
    normalMap: "/assets/textures/concrete_wall_007_2k.blend/textures/concrete_wall_007_disp_2k.png",
    bumpMap: "/assets/textures/concrete_wall_007_2k.blend/textures/concrete_wall_007_disp_2k.png",
    color: "#333333",
    roughness: 0.92,
    bumpScale: 0.015,
    normalScale: 0.35,
    envMapIntensity: 0.25
  }
];

function WallMesh({
  wallId,
  materialTemplate
}: {
  wallId: string;
  materialTemplate: THREE.Material;
}) {
  const walls = useShellSelector((slice) => slice.walls);
  const openings = useShellSelector((slice) => slice.openings);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);
  const wall = useMemo(() => walls.find((item) => item.id === wallId), [wallId, walls]);
  const material = useMemo(() => materialTemplate.clone(), [materialTemplate]);

  const wallOpenings = useMemo(() => openings.filter((opening) => opening.wallId === wallId), [openings, wallId]);

  const { baseGeometry, holeGeometries, position, rotation } = useMemo(() => {
    if (!wall) {
      return {
        baseGeometry: null,
        holeGeometries: [],
        position: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number]
      };
    }

    const placement = getWallRenderPlacement(wall, floors, scale);
    const length = Math.max(0.05, placement.length);
    const thickness = Math.max(0.02, wall.thickness * scale);
    const height = (wall.height > 0 ? wall.height : 2.8) * scale;
    const geometry = new THREE.BoxGeometry(length, height, thickness);
    geometry.translate(length / 2, height / 2, 0);
    geometry.computeVertexNormals();

    const holes = wallOpenings
      .map((opening) => {
        const offset = Math.max(0, opening.offset * scale + placement.startInset);
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
                ? 0.9 * scale
                : 0;
        const holeHeight = Math.min(baseHeight, height - bottomOffset);
        if (holeHeight <= 0.05) return null;

        const depth = thickness + 0.12;
        const holeGeometry = new THREE.BoxGeometry(usableWidth, holeHeight, depth);
        holeGeometry.translate(offset + usableWidth / 2, bottomOffset + holeHeight / 2, 0);
        return holeGeometry;
      })
      .filter((entry): entry is THREE.BoxGeometry => Boolean(entry));

    return {
      baseGeometry: geometry,
      holeGeometries: holes,
      position: [placement.start[0], 0, placement.start[1]] as [number, number, number],
      rotation: [0, -placement.angle, 0] as [number, number, number]
    };
  }, [floors, scale, wall, wallOpenings]);

  useEffect(() => {
    return () => {
      baseGeometry?.dispose();
      holeGeometries.forEach((geometry) => geometry.dispose());
      material.dispose();
    };
  }, [baseGeometry, holeGeometries, material]);

  if (!wall || !baseGeometry) return null;

  return (
    <mesh name={`wall:${wall.id}`} position={position} rotation={rotation} castShadow receiveShadow>
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

function TopWallFootprint({
  wallId
}: {
  wallId: string;
}) {
  const walls = useShellSelector((slice) => slice.walls);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);
  const wall = useMemo(() => walls.find((item) => item.id === wallId), [wallId, walls]);

  const strip = useMemo(() => {
    if (!wall) {
      return null;
    }
    const placement = getWallRenderPlacement(wall, floors, scale);
    const thickness = Math.max(0.14, wall.thickness * scale);

    return {
      position: [
        placement.start[0] + placement.direction[0] * (placement.length / 2),
        0.018,
        placement.start[1] + placement.direction[1] * (placement.length / 2)
      ] as [number, number, number],
      rotation: [0, -placement.angle, 0] as [number, number, number],
      length: placement.length,
      thickness
    };
  }, [floors, scale, wall]);

  if (!strip) return null;

  return (
    <mesh
      name={`top-wall:${wallId}`}
      position={strip.position}
      rotation={strip.rotation}
      receiveShadow={false}
      castShadow={false}
    >
      <boxGeometry args={[strip.length, 0.036, strip.thickness]} />
      <meshStandardMaterial color="#cfc9c1" roughness={0.97} metalness={0.02} />
    </mesh>
  );
}

function DetailedWalls({ wallMaterialIndex, walls }: { wallMaterialIndex: number; walls: Wall[] }) {
  const textureConfig = WALL_TEXTURES[wallMaterialIndex % WALL_TEXTURES.length] ?? WALL_TEXTURES[0];
  const textures = useTexture({
    map: textureConfig.map,
    roughnessMap: textureConfig.roughnessMap,
    normalMap: textureConfig.normalMap,
    bumpMap: textureConfig.bumpMap
  });

  useEffect(() => {
    Object.values(textures).forEach((texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      texture.anisotropy = 4;
    });

    textures.map.colorSpace = THREE.SRGBColorSpace;
    textures.roughnessMap.colorSpace = THREE.NoColorSpace;
    textures.normalMap.colorSpace = THREE.NoColorSpace;
    textures.bumpMap.colorSpace = THREE.NoColorSpace;
  }, [textures]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: textureConfig.color,
        map: textures.map,
        roughnessMap: textures.roughnessMap,
        normalMap: textures.normalMap,
        bumpMap: textures.bumpMap,
        bumpScale: textureConfig.bumpScale,
        roughness: textureConfig.roughness,
        normalScale: new THREE.Vector2(textureConfig.normalScale, textureConfig.normalScale),
        envMapIntensity: textureConfig.envMapIntensity
      }),
    [textureConfig, textures]
  );

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <group>
      {walls.map((wall) => (
        <WallMesh key={wall.id} wallId={wall.id} materialTemplate={material} />
      ))}
    </group>
  );
}

export default function ProceduralWall() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const wallMaterialIndex = useShellSelector((slice) => slice.wallMaterialIndex);
  const walls = useShellSelector((slice) => slice.walls);

  if (viewMode === "top") {
    return (
      <group>
        {walls.map((wall) => (
          <TopWallFootprint key={wall.id} wallId={wall.id} />
        ))}
      </group>
    );
  }

  return <DetailedWalls wallMaterialIndex={wallMaterialIndex} walls={walls} />;
}
