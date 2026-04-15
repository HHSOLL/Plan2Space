"use client";

import { TransformControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import { constrainPlacementToAnchor } from "../../../lib/scene/anchors";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import {
  useAssetSelector,
  usePublishSelector,
  useSelectionSelector,
  useShellSelector
} from "../../../lib/stores/scene-slices";

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
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const assets = useAssetSelector((slice) => slice.assets);
  const updateFurniture = useAssetSelector((slice) => slice.updateFurniture);
  const walls = useShellSelector((slice) => slice.walls);
  const ceilings = useShellSelector((slice) => slice.ceilings);
  const scale = useShellSelector((slice) => slice.scale);
  const recordSnapshot = usePublishSelector((slice) => slice.recordSnapshot);

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
    const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
    if (!selectedAsset) return;
    const scaleLocked = selectedAsset.product?.scaleLocked === true;
    const anchoredPlacement = constrainPlacementToAnchor(
      {
        position: vector3ToTuple(target.position),
        rotation: eulerToTuple(target.rotation),
        anchorType: selectedAsset.anchorType,
        supportAssetId: selectedAsset.supportAssetId
      },
      {
        walls,
        ceilings,
        scale,
        sceneAssets: assets,
        activeAssetId: selectedAsset.id
      }
    );

    target.position.set(...anchoredPlacement.position);
    target.rotation.set(...anchoredPlacement.rotation);
    if (scaleLocked) {
      target.scale.set(...selectedAsset.scale);
    }

    const updates = {
      anchorType: anchoredPlacement.anchorType,
      supportAssetId: anchoredPlacement.supportAssetId,
      position: anchoredPlacement.position,
      rotation: anchoredPlacement.rotation
    } as const;

    updateFurniture(
      selectedAssetId,
      scaleLocked
        ? updates
        : {
            ...updates,
            scale: vector3ToTuple(target.scale)
          }
    );
  }, [assets, ceilings, scale, selectedAssetId, target, updateFurniture, walls]);

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
