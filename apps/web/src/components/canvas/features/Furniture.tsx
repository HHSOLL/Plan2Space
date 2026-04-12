"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";
import type { ThreeEvent } from "@react-three/fiber";
import { useGLBAsset } from "../../../lib/loaders/AssetLoader";
import { constrainPlacementToAnchor } from "../../../lib/scene/anchors";
import { normalizeSceneAnchorType } from "../../../lib/scene/anchor-types";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import {
  useAssetSelector,
  usePublishSelector,
  useSelectionSelector,
  useShellSelector
} from "../../../lib/stores/scene-slices";
import type { SceneAsset } from "../../../lib/stores/useSceneStore";

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const GRID_SNAP = 0.25;
const MAX_DYNAMIC_EMITTERS = 6;
const LIGHT_EMITTER_HINT_IDS = new Set([
  "p2s_desk_lamp_glow",
  "desk_lamp_arm_01",
  "modern_ceiling_lamp_01",
  "hanging_industrial_lamp",
  "industrial_wall_lamp"
]);
const LIGHT_KEYWORDS = ["lamp", "light", "lighting", "조명", "light-emitter"];

type AssetLightProfile = {
  offset: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
};

function isPlaceholderAsset(assetId: string) {
  return assetId.startsWith("placeholder:");
}

function isLightingAsset(asset: SceneAsset) {
  if (asset.catalogItemId && LIGHT_EMITTER_HINT_IDS.has(asset.catalogItemId)) {
    return true;
  }
  const haystack = [
    asset.catalogItemId ?? "",
    asset.assetId,
    asset.product?.name ?? "",
    asset.product?.category ?? "",
    asset.product?.options ?? ""
  ]
    .join(" ")
    .toLowerCase();
  return LIGHT_KEYWORDS.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function resolveAssetLightProfile(asset: SceneAsset): AssetLightProfile | null {
  if (!isLightingAsset(asset)) return null;

  const anchorType = normalizeSceneAnchorType(asset.anchorType);
  const normalizedText = [
    asset.assetId,
    asset.catalogItemId ?? "",
    asset.product?.name ?? "",
    asset.product?.options ?? ""
  ]
    .join(" ")
    .toLowerCase();
  const warm = normalizedText.includes("3000k") || normalizedText.includes("warm");
  const cool = normalizedText.includes("4000k") || normalizedText.includes("cool");
  const color = warm ? "#ffd29a" : cool ? "#d9ecff" : "#ffe6bf";

  if (anchorType === "ceiling") {
    return {
      offset: [0, -0.16, 0],
      color,
      intensity: 1.2,
      distance: 4.4
    };
  }

  if (anchorType === "wall") {
    return {
      offset: [0.06, 0.24, 0],
      color,
      intensity: 0.9,
      distance: 3.2
    };
  }

  return {
    offset: [0, 0.3, 0],
    color,
    intensity: 0.82,
    distance: 2.6
  };
}

function PlaceholderFurniture() {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[0.8, 0.6, 0.8]} />
      <meshStandardMaterial color="#c4b59d" roughness={0.8} />
    </mesh>
  );
}

function ModelInstance({ assetId }: { assetId: string }) {
  const gltf = useGLBAsset(assetId);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const lod = useMemo(() => {
    const root = new THREE.LOD();
    const high = scene.clone(true);
    const bbox = new THREE.Box3().setFromObject(high);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bbox.getSize(size);
    bbox.getCenter(center);
    const lowGeometry = new THREE.BoxGeometry(
      Math.max(0.2, size.x),
      Math.max(0.2, size.y),
      Math.max(0.2, size.z)
    );
    lowGeometry.translate(center.x, center.y, center.z);
    const lowMaterial = new THREE.MeshStandardMaterial({ color: "#d8d2c4", roughness: 0.9 });
    const low = new THREE.Mesh(lowGeometry, lowMaterial);
    root.addLevel(high, 0);
    root.addLevel(low, 8);
    return root;
  }, [scene]);

  useEffect(() => {
    lod.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return () => {
      lod.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          const material = child.material;
          if (Array.isArray(material)) {
            material.forEach((mat) => mat.dispose());
          } else {
            material?.dispose();
          }
        }
      });
    };
  }, [lod]);

  return <primitive object={lod} />;
}

function FurnitureItem({ asset, enableDynamicLight }: { asset: SceneAsset; enableDynamicLight: boolean }) {
  const viewMode = useEditorStore((state) => state.viewMode);
  const isTransforming = useEditorStore((state) => state.isTransforming);
  const readOnly = useEditorStore((state) => state.readOnly);
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const setSelectedAssetId = useSelectionSelector((slice) => slice.setSelectedAssetId);
  const walls = useShellSelector((slice) => slice.walls);
  const ceilings = useShellSelector((slice) => slice.ceilings);
  const scale = useShellSelector((slice) => slice.scale);
  const sceneAssets = useAssetSelector((slice) => slice.assets);
  const updateFurniture = useAssetSelector((slice) => slice.updateFurniture);
  const recordSnapshot = usePublishSelector((slice) => slice.recordSnapshot);
  const [isDragging, setIsDragging] = useState(false);
  const isSelected = selectedAssetId === asset.id;
  const lightProfile = useMemo(
    () => (enableDynamicLight ? resolveAssetLightProfile(asset) : null),
    [asset, enableDynamicLight]
  );

  const position = useMemo(() => new THREE.Vector3(...asset.position), [asset.position]);

  const handleReadOnlySelect = (event: ThreeEvent<PointerEvent>) => {
    if (!readOnly) return;
    event.stopPropagation();
    setSelectedAssetId(asset.id);
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (viewMode !== "top" || isTransforming || readOnly) return;
    event.stopPropagation();
    setSelectedAssetId(asset.id);
    setIsDragging(true);
    const target = event.nativeEvent.target as HTMLElement | null;
    target?.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (viewMode !== "top" || readOnly) return;
    event.stopPropagation();
    if (isDragging) {
      recordSnapshot("Move asset");
    }
    setIsDragging(false);
    const target = event.nativeEvent.target as HTMLElement | null;
    target?.releasePointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (viewMode !== "top" || !isDragging || readOnly) return;
    event.stopPropagation();
    const intersection = new THREE.Vector3();
    if (!event.ray.intersectPlane(groundPlane, intersection)) return;
    const snap = (value: number) => Math.round(value / GRID_SNAP) * GRID_SNAP;
    const anchoredPlacement = constrainPlacementToAnchor(
      {
        position: [snap(intersection.x), asset.position[1], snap(intersection.z)],
        rotation: asset.rotation,
        anchorType: asset.anchorType,
        supportAssetId: asset.supportAssetId
      },
      {
        walls,
        ceilings,
        scale,
        sceneAssets,
        activeAssetId: asset.id
      }
    );
    updateFurniture(asset.id, {
      anchorType: anchoredPlacement.anchorType,
      supportAssetId: anchoredPlacement.supportAssetId,
      position: anchoredPlacement.position,
      rotation: anchoredPlacement.rotation
    });
  };

  const content = isPlaceholderAsset(asset.assetId) ? (
    <PlaceholderFurniture />
  ) : (
    <Suspense fallback={<PlaceholderFurniture />}>
      <ModelInstance assetId={asset.assetId} />
    </Suspense>
  );

  const groupProps =
    readOnly
      ? {
          onPointerDown: handleReadOnlySelect
        }
      : viewMode === "top"
      ? {
          onPointerDown: handlePointerDown,
          onPointerUp: handlePointerUp,
          onPointerMove: handlePointerMove,
          onPointerLeave: handlePointerUp
        }
      : {};

  if (viewMode === "walk") {
    return (
      <RigidBody type="fixed" colliders="cuboid" position={asset.position} rotation={asset.rotation}>
        <group name={`furniture:${asset.id}`} scale={asset.scale} {...groupProps}>
          {content}
          {lightProfile ? (
            <pointLight
              position={lightProfile.offset}
              color={lightProfile.color}
              intensity={lightProfile.intensity}
              distance={lightProfile.distance}
              decay={2}
            />
          ) : null}
        </group>
      </RigidBody>
    );
  }

  return (
    <group
      name={`furniture:${asset.id}`}
      position={position.toArray()}
      rotation={asset.rotation}
      scale={asset.scale}
      {...groupProps}
    >
      {content}
      {lightProfile ? (
        <pointLight
          position={lightProfile.offset}
          color={lightProfile.color}
          intensity={lightProfile.intensity}
          distance={lightProfile.distance}
          decay={2}
        />
      ) : null}
      {isSelected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.45, 0.62, 48]} />
          <meshBasicMaterial color={readOnly ? "#f2e8d9" : "#cde7ff"} transparent opacity={0.7} />
        </mesh>
      ) : null}
    </group>
  );
}

export default function Furniture() {
  const assets = useAssetSelector((slice) => slice.assets);
  const emitterAssetIds = useMemo(() => {
    const ids = new Set<string>();
    let count = 0;
    for (const asset of assets) {
      if (count >= MAX_DYNAMIC_EMITTERS) break;
      if (!isLightingAsset(asset)) continue;
      ids.add(asset.id);
      count += 1;
    }
    return ids;
  }, [assets]);

  return (
    <group>
      {assets.map((asset) => (
        <FurnitureItem key={asset.id} asset={asset} enableDynamicLight={emitterAssetIds.has(asset.id)} />
      ))}
    </group>
  );
}
