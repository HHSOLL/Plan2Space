"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useGLBAsset } from "../../../lib/loaders/AssetLoader";
import { useShellSelector } from "../../../lib/stores/scene-slices";
import { getWallRenderPlacement } from "../../../lib/geometry/wall-placement";
import { useInteractionRegistry } from "../interaction/InteractionManager";

type DoorSpec = {
  id: string;
  position: [number, number, number];
  angle: number;
  width: number;
  height: number;
  thickness: number;
};

type WindowSpec = {
  id: string;
  position: [number, number, number];
  angle: number;
  width: number;
  height: number;
  thickness: number;
};

type DoorVariant = "single" | "double" | "french";
type WindowVariant = "single" | "wide";

type DoorAssetConfig = {
  path: string;
  baseSize: [number, number, number];
  pivotNames: string[];
  openRotations: number[];
};

type WindowAssetConfig = {
  path: string;
  baseSize: [number, number, number];
};

const DOOR_ASSETS: Record<DoorVariant, DoorAssetConfig> = {
  single: {
    path: "/assets/models/p2s_opening_door_single/p2s_opening_door_single.glb",
    baseSize: [0.92, 2.1, 0.09],
    pivotNames: ["DoorLeafPivot"],
    openRotations: [-Math.PI / 2.35]
  },
  double: {
    path: "/assets/models/p2s_opening_door_double/p2s_opening_door_double.glb",
    baseSize: [1.4, 2.1, 0.09],
    pivotNames: ["DoorLeafLeftPivot", "DoorLeafRightPivot"],
    openRotations: [-Math.PI / 2.5, Math.PI / 2.5]
  },
  french: {
    path: "/assets/models/p2s_opening_door_french/p2s_opening_door_french.glb",
    baseSize: [1.6, 2.1, 0.09],
    pivotNames: ["DoorLeafLeftPivot", "DoorLeafRightPivot"],
    openRotations: [-Math.PI / 2.7, Math.PI / 2.7]
  }
};

const WINDOW_ASSETS: Record<WindowVariant, WindowAssetConfig> = {
  single: {
    path: "/assets/models/p2s_opening_window_single/p2s_opening_window_single.glb",
    baseSize: [1.8, 1.3, 0.12]
  },
  wide: {
    path: "/assets/models/p2s_opening_window_wide/p2s_opening_window_wide.glb",
    baseSize: [2.4, 1.3, 0.12]
  }
};

function resolveDoorVariant(width: number): DoorVariant {
  if (width >= 1.52) return "french";
  if (width >= 1.16) return "double";
  return "single";
}

function resolveWindowVariant(width: number): WindowVariant {
  return width >= 2.08 ? "wide" : "single";
}

function prepareRuntimeAsset(root: THREE.Object3D) {
  let highlightMesh: THREE.Mesh | null = null;

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;

    const material = child.material;
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((entry) => {
      if (entry instanceof THREE.MeshStandardMaterial && entry.transparent) {
        entry.depthWrite = false;
      }
    });

    if (!highlightMesh && child.name.toLowerCase().includes("doorleaf")) {
      highlightMesh = child;
    }
  });

  return highlightMesh;
}

function DoorAssetModel({ door }: { door: DoorSpec }) {
  const registry = useInteractionRegistry();
  const rootRef = useRef<THREE.Group | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const variant = resolveDoorVariant(door.width);
  const config = DOOR_ASSETS[variant];
  const gltf = useGLBAsset(config.path);

  const runtimeAsset = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const highlightMesh = prepareRuntimeAsset(clone);
    return {
      root: clone,
      highlightMesh
    };
  }, [gltf.scene]);

  const leafPivots = useMemo(
    () =>
      config.pivotNames
        .map((name) => runtimeAsset.root.getObjectByName(name))
        .filter((entry): entry is THREE.Object3D => Boolean(entry)),
    [config.pivotNames, runtimeAsset.root]
  );

  useEffect(() => {
    leafPivots.forEach((pivot, index) => {
      gsap.to(pivot.rotation, {
        y: isOpen ? config.openRotations[index] ?? 0 : 0,
        duration: 0.55,
        ease: "power2.out"
      });
    });
  }, [config.openRotations, isOpen, leafPivots]);

  useEffect(() => {
    const group = rootRef.current;
    if (!group) return;

    group.userData.interactive = true;
    group.userData.interactionLabel = "Door";
    group.userData.onInteract = () => setIsOpen((prev) => !prev);
    if (runtimeAsset.highlightMesh) {
      group.userData.highlightMesh = runtimeAsset.highlightMesh;
    }

    registry?.register(group);
    return () => registry?.unregister(group);
  }, [registry, runtimeAsset.highlightMesh]);

  return (
    <group
      ref={rootRef}
      name={`door:${door.id}`}
      position={door.position}
      rotation={[0, door.angle, 0]}
      scale={[
        door.width / config.baseSize[0],
        door.height / config.baseSize[1],
        door.thickness / config.baseSize[2]
      ]}
    >
      <primitive object={runtimeAsset.root} />
    </group>
  );
}

function WindowAssetModel({ window }: { window: WindowSpec }) {
  const variant = resolveWindowVariant(window.width);
  const config = WINDOW_ASSETS[variant];
  const gltf = useGLBAsset(config.path);

  const runtimeAsset = useMemo(() => {
    const clone = gltf.scene.clone(true);
    prepareRuntimeAsset(clone);
    return clone;
  }, [gltf.scene]);

  return (
    <group
      name={`window:${window.id}`}
      position={window.position}
      rotation={[0, window.angle, 0]}
      scale={[
        window.width / config.baseSize[0],
        window.height / config.baseSize[1],
        window.thickness / config.baseSize[2]
      ]}
    >
      <primitive object={runtimeAsset} />
    </group>
  );
}

export default function InteractiveDoors() {
  const walls = useShellSelector((slice) => slice.walls);
  const openings = useShellSelector((slice) => slice.openings);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);

  const doorSpecs = useMemo(() => {
    return openings
      .filter((opening) => opening.type === "door")
      .map((opening) => {
        const wall = walls.find((item) => item.id === opening.wallId);
        if (!wall) return null;

        const placement = getWallRenderPlacement(wall, floors, scale);
        const length = placement.length;
        if (!Number.isFinite(length) || length <= 0) return null;

        const width = Math.max(0.72, opening.width * scale);
        const height = Math.max(1.95, opening.height * scale);
        const thickness = Math.max(0.06, wall.thickness * scale * 0.72);
        const offset = Math.min(Math.max(0, opening.offset * scale + placement.startInset), Math.max(0, length - width));
        const startX = placement.start[0] + placement.direction[0] * offset;
        const startZ = placement.start[1] + placement.direction[1] * offset;
        const bottomOffset = typeof opening.verticalOffset === "number" ? opening.verticalOffset * scale : 0;

        return {
          id: opening.id,
          position: [startX, bottomOffset, startZ] as [number, number, number],
          angle: -placement.angle,
          width,
          height,
          thickness
        } satisfies DoorSpec;
      })
      .filter((entry): entry is DoorSpec => Boolean(entry));
  }, [floors, openings, scale, walls]);

  const windowSpecs = useMemo(() => {
    return openings
      .filter((opening) => opening.type === "window")
      .map((opening) => {
        const wall = walls.find((item) => item.id === opening.wallId);
        if (!wall) return null;

        const placement = getWallRenderPlacement(wall, floors, scale);
        const length = placement.length;
        if (!Number.isFinite(length) || length <= 0) return null;

        const width = Math.max(0.92, opening.width * scale);
        const height = Math.max(0.88, opening.height * scale);
        const thickness = Math.max(0.08, wall.thickness * scale * 0.82);
        const offset = Math.min(Math.max(0, opening.offset * scale + placement.startInset), Math.max(0, length - width));
        const startX = placement.start[0] + placement.direction[0] * offset;
        const startZ = placement.start[1] + placement.direction[1] * offset;
        const sillHeight = typeof opening.sillHeight === "number" ? opening.sillHeight * scale : 0.9;

        return {
          id: opening.id,
          position: [startX, sillHeight, startZ] as [number, number, number],
          angle: -placement.angle,
          width,
          height,
          thickness
        } satisfies WindowSpec;
      })
      .filter((entry): entry is WindowSpec => Boolean(entry));
  }, [floors, openings, scale, walls]);

  if (doorSpecs.length === 0 && windowSpecs.length === 0) return null;

  return (
    <group>
      {doorSpecs.map((door) => (
        <DoorAssetModel key={door.id} door={door} />
      ))}
      {windowSpecs.map((window) => (
        <WindowAssetModel key={window.id} window={window} />
      ))}
    </group>
  );
}
