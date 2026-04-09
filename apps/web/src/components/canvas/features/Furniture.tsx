"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";
import type { ThreeEvent } from "@react-three/fiber";
import { useGLBAsset } from "../../../lib/loaders/AssetLoader";
import { constrainPlacementToAnchor } from "../../../lib/scene/anchors";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useSceneStore, type SceneAsset } from "../../../lib/stores/useSceneStore";

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const GRID_SNAP = 0.25;

function isPlaceholderAsset(assetId: string) {
  return assetId.startsWith("placeholder:");
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

function FurnitureItem({ asset }: { asset: SceneAsset }) {
  const viewMode = useEditorStore((state) => state.viewMode);
  const isTransforming = useEditorStore((state) => state.isTransforming);
  const readOnly = useEditorStore((state) => state.readOnly);
  const selectedAssetId = useSceneStore((state) => state.selectedAssetId);
  const walls = useSceneStore((state) => state.walls);
  const ceilings = useSceneStore((state) => state.ceilings);
  const scale = useSceneStore((state) => state.scale);
  const sceneAssets = useSceneStore((state) => state.assets);
  const updateFurniture = useSceneStore((state) => state.updateFurniture);
  const recordSnapshot = useSceneStore((state) => state.recordSnapshot);
  const setSelectedAssetId = useSceneStore((state) => state.setSelectedAssetId);
  const [isDragging, setIsDragging] = useState(false);
  const isSelected = selectedAssetId === asset.id;

  const position = useMemo(() => new THREE.Vector3(...asset.position), [asset.position]);

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
        anchorType: asset.anchorType
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
    viewMode === "top" && !readOnly
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
  const assets = useSceneStore((state) => state.assets);

  return (
    <group>
      {assets.map((asset) => (
        <FurnitureItem key={asset.id} asset={asset} />
      ))}
    </group>
  );
}
