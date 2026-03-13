"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useSceneStore, type SceneAsset } from "../../../lib/stores/useSceneStore";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import type { FloorPlanData, FurnitureItem } from "../../../../../../types/database";
import CameraRig from "../../../components/canvas/core/CameraRig";
import PhysicsWorld from "../../../components/canvas/core/PhysicsWorld";
import Lights from "../../../components/canvas/effects/Lights";
import PostEffects from "../../../components/canvas/effects/PostEffects";
import ProceduralCeiling from "../../../components/canvas/features/ProceduralCeiling";
import ProceduralFloor from "../../../components/canvas/features/ProceduralFloor";
import ProceduralWall from "../../../components/canvas/features/ProceduralWall";
import Furniture from "../../../components/canvas/features/Furniture";
import InteractionManager from "../../../components/canvas/interaction/InteractionManager";
import SceneEnvironment from "../../../components/canvas/core/SceneEnvironment";
import Crosshair from "../../../components/overlay/hud/Crosshair";
import MobileTouchHint from "../../../components/overlay/hud/MobileTouchHint";
import MobileControls from "../../../components/overlay/hud/MobileControls";

type SharedProjectClientProps = {
  initialFurniture: FurnitureItem[];
  floorPlan: FloorPlanData | null;
  readOnly: boolean;
};

const toSceneAsset = (item: FurnitureItem): SceneAsset => ({
  id: item.id,
  assetId: item.modelId,
  position: item.position as [number, number, number],
  rotation: item.rotation as [number, number, number],
  scale: item.scale as [number, number, number],
  materialId: null
});

export function SharedProjectClient({
  initialFurniture,
  floorPlan,
  readOnly
}: SharedProjectClientProps) {
  const setScene = useSceneStore((state) => state.setScene);
  const setViewMode = useEditorStore((state) => state.setViewMode);
  const setReadOnly = useEditorStore((state) => state.setReadOnly);

  const { walls, openings } = useMemo(() => {
    if (!floorPlan) return { walls: [], openings: [] };
    const defaultHeight = floorPlan.params?.wallHeight ?? 2.8;
    const defaultThickness = floorPlan.params?.wallThickness ?? 0.12;
    return {
      walls: floorPlan.walls.map((wall) => ({
        id: wall.id,
        start: [wall.a[0], wall.a[1]] as [number, number],
        end: [wall.b[0], wall.b[1]] as [number, number],
        thickness: wall.thickness ?? defaultThickness,
        height: wall.height ?? defaultHeight
      })),
      openings: floorPlan.openings.map((opening) => ({
        id: opening.id,
        wallId: opening.wallId,
        type: opening.type,
        offset: opening.offset,
        width: opening.width,
        height: opening.height,
        verticalOffset: opening.verticalOffset,
        sillHeight: opening.sillHeight
      }))
    };
  }, [floorPlan]);

  useEffect(() => {
    const assets = initialFurniture.map(toSceneAsset);
    setScene({
      walls,
      openings,
      floors: [],
      ceilings: [],
      rooms: [],
      cameraAnchors: [],
      navGraph: { nodes: [], edges: [] },
      assets,
      scale: 1
    });
    const entrance = openings.find((opening) => opening.type === "door");
    if (entrance) {
      useSceneStore.setState({ entranceId: entrance.id });
    }
    setViewMode("walk");
    setReadOnly(readOnly);
  }, [initialFurniture, openings, readOnly, setReadOnly, setScene, setViewMode, walls]);

  return (
    <div className="relative h-[80vh] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#050505] shadow-2xl">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          stencil: false,
          depth: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false
        }}
        camera={{ fov: 45, position: [0, 8, 14] }}
        className="h-full w-full"
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <color attach="background" args={["#0a0a0b"]} />
        <Suspense fallback={null}>
          <PhysicsWorld>
            <Lights />
            <SceneEnvironment />
            <CameraRig />
            <InteractionManager>
              <ProceduralFloor />
              <ProceduralCeiling />
              <ProceduralWall />
              <Furniture />
            </InteractionManager>
          </PhysicsWorld>
          <PostEffects />
        </Suspense>
      </Canvas>
      <Crosshair />
      <MobileTouchHint />
      <MobileControls />
      <div className="pointer-events-none absolute left-6 top-6 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[9px] uppercase tracking-[0.4em] text-white/60">
        Shared Walkthrough
      </div>
    </div>
  );
}
