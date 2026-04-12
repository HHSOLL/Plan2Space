"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Mesh } from "three";
import { normalizeSceneAnchorType } from "../../../lib/scene/anchor-types";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useAssetSelector, useSelectionSelector } from "../../../lib/stores/scene-slices";
import type { SceneAsset } from "../../../lib/stores/useSceneStore";

type HotspotMarker = {
  id: string;
  position: [number, number, number];
  isActive: boolean;
  index: number;
};

function getHotspotOffset(asset: SceneAsset, viewMode: "top" | "walk") {
  const anchorType = normalizeSceneAnchorType(asset.anchorType);
  if (anchorType === "ceiling") return viewMode === "walk" ? -0.18 : -0.24;
  if (anchorType === "wall") return viewMode === "walk" ? 0.44 : 0.4;
  if (anchorType === "desk_surface" || anchorType === "furniture_surface" || anchorType === "shelf_surface") {
    return viewMode === "walk" ? 0.22 : 0.18;
  }
  return viewMode === "walk" ? 0.32 : 0.26;
}

function toHotspotMarkers(
  assets: SceneAsset[],
  selectedAssetId: string | null,
  viewMode: "top" | "walk"
): HotspotMarker[] {
  return assets.map((asset, index) => ({
    id: asset.id,
    index,
    isActive: selectedAssetId === asset.id,
    position: [asset.position[0], asset.position[1] + getHotspotOffset(asset, viewMode), asset.position[2]]
  }));
}

function ViewerHotspotPin({
  marker,
  viewMode,
  onSelect
}: {
  marker: HotspotMarker;
  viewMode: "top" | "walk";
  onSelect: (id: string) => void;
}) {
  const pulseRef = useRef<Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);
  const interactive = marker.isActive || isHovered;

  useFrame(({ clock }) => {
    const pulse = interactive
      ? 1.03 + Math.sin(clock.elapsedTime * 4.4) * 0.07
      : 0.98 + Math.sin(clock.elapsedTime * 2.4 + marker.index) * 0.04;
    if (pulseRef.current) {
      pulseRef.current.scale.set(pulse, pulse, 1);
    }
  });

  const badgeHeight = viewMode === "walk" ? 0.12 : 0.1;

  return (
    <group position={marker.position}>
      <mesh
        renderOrder={2}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect(marker.id);
        }}
        onPointerOver={() => {
          setIsHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setIsHovered(false);
          document.body.style.cursor = "default";
        }}
      >
        <circleGeometry args={[0.24, 36]} />
        <meshBasicMaterial color="#ffffff" opacity={0} transparent depthTest={false} />
      </mesh>
      <mesh renderOrder={3} position={[0, 0, -0.002]}>
        <circleGeometry args={[interactive ? 0.24 : 0.2, 40]} />
        <meshBasicMaterial
          color={interactive ? "#d8c6a8" : "#17130f"}
          opacity={interactive ? 0.24 : 0.08}
          transparent
          depthTest={false}
        />
      </mesh>
      <mesh
        renderOrder={4}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect(marker.id);
        }}
        onPointerOver={() => {
          setIsHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setIsHovered(false);
          document.body.style.cursor = "default";
        }}
      >
        <circleGeometry args={[interactive ? 0.122 : 0.104, 36]} />
        <meshBasicMaterial
          color={interactive ? "#17130f" : "#f7f2e8"}
          opacity={interactive ? 0.97 : 0.9}
          transparent
          depthTest={false}
        />
      </mesh>
      <mesh ref={pulseRef} renderOrder={5} position={[0, 0, 0.002]}>
        <ringGeometry args={[0.118, interactive ? 0.194 : 0.165, 40]} />
        <meshBasicMaterial
          color={interactive ? "#f1e5d2" : "#241f19"}
          opacity={interactive ? 0.96 : 0.58}
          transparent
          depthTest={false}
        />
      </mesh>
      <mesh renderOrder={6} position={[0, badgeHeight, 0.004]}>
        <planeGeometry args={[0.11, 0.062]} />
        <meshBasicMaterial
          color={interactive ? "#17130f" : "#f7f2e8"}
          opacity={0.92}
          transparent
          depthTest={false}
        />
      </mesh>
      <Text
        position={[0, badgeHeight, 0.007]}
        fontSize={0.03}
        color={interactive ? "#f7f2e8" : "#17130f"}
        anchorX="center"
        anchorY="middle"
        outlineColor={interactive ? "#17130f" : "#f7f2e8"}
        outlineWidth={0.001}
        renderOrder={7}
      >
        {String(marker.index + 1)}
      </Text>
    </group>
  );
}

export default function ViewerProductHotspots() {
  const readOnly = useEditorStore((state) => state.readOnly);
  const viewMode = useEditorStore((state) => state.viewMode);
  const assets = useAssetSelector((slice) => slice.assets);
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const setSelectedAssetId = useSelectionSelector((slice) => slice.setSelectedAssetId);
  const viewerMode = viewMode === "walk" ? "walk" : "top";
  const markers = useMemo(
    () => toHotspotMarkers(assets, selectedAssetId, viewerMode),
    [assets, selectedAssetId, viewerMode]
  );

  useEffect(
    () => () => {
      document.body.style.cursor = "default";
    },
    []
  );

  if (!readOnly || markers.length === 0) return null;

  return (
    <group name="viewer-product-hotspots">
      {markers.map((marker) => (
        <ViewerHotspotPin
          key={marker.id}
          marker={marker}
          viewMode={viewerMode}
          onSelect={setSelectedAssetId}
        />
      ))}
    </group>
  );
}
