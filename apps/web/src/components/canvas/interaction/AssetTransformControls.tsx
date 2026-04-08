"use client";

import { TransformControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useSceneStore } from "../../../lib/stores/useSceneStore";

const GRID_SNAP = 0.25;
const ROTATION_SNAP = Math.PI / 2;

function vector3ToTuple(v: THREE.Vector3): [number, number, number] {
  return [v.x, v.y, v.z];
}

function eulerToTuple(e: THREE.Euler): [number, number, number] {
  return [e.x, e.y, e.z];
}

export default function AssetTransformControls() {
  const { scene } = useThree();
  const viewMode = useEditorStore((state) => state.viewMode);
  const transformMode = useEditorStore((state) => state.transformMode);
  const setIsTransforming = useEditorStore((state) => state.setIsTransforming);
  const readOnly = useEditorStore((state) => state.readOnly);
  const selectedAssetId = useSceneStore((state) => state.selectedAssetId);
  const assets = useSceneStore((state) => state.assets);
  const updateFurniture = useSceneStore((state) => state.updateFurniture);
  const recordSnapshot = useSceneStore((state) => state.recordSnapshot);

  const [target, setTarget] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    if (!selectedAssetId || viewMode !== "top" || readOnly) {
      setTarget(null);
      setIsTransforming(false);
      return;
    }
    const object = scene.getObjectByName(`furniture:${selectedAssetId}`) ?? null;
    setTarget(object);
  }, [assets, readOnly, scene, selectedAssetId, setIsTransforming, viewMode]);

  const syncTarget = useCallback(() => {
    if (!selectedAssetId || !target) return;
    updateFurniture(selectedAssetId, {
      position: vector3ToTuple(target.position),
      rotation: eulerToTuple(target.rotation),
      scale: vector3ToTuple(target.scale)
    });
  }, [selectedAssetId, target, updateFurniture]);

  if (viewMode !== "top" || readOnly || !target) return null;

  return (
    <TransformControls
      object={target}
      mode={transformMode}
      showY={false}
      space="world"
      translationSnap={GRID_SNAP}
      rotationSnap={ROTATION_SNAP}
      onMouseDown={() => setIsTransforming(true)}
      onMouseUp={() => {
        setIsTransforming(false);
        syncTarget();
        recordSnapshot("Transform asset");
      }}
    />
  );
}
