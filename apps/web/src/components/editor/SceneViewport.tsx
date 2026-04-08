"use client";

import { Canvas } from "@react-three/fiber";
import type { ReactNode, ComponentProps } from "react";
import { Suspense } from "react";
import * as THREE from "three";
import CameraRig from "../canvas/core/CameraRig";
import PhysicsWorld from "../canvas/core/PhysicsWorld";
import SceneEnvironment from "../canvas/core/SceneEnvironment";
import Lights from "../canvas/effects/Lights";
import PostEffects from "../canvas/effects/PostEffects";
import ProceduralCeiling from "../canvas/features/ProceduralCeiling";
import ProceduralFloor from "../canvas/features/ProceduralFloor";
import ProceduralWall from "../canvas/features/ProceduralWall";
import Furniture from "../canvas/features/Furniture";
import InteractiveDoors from "../canvas/features/InteractiveDoors";
import InteractiveLights from "../canvas/features/InteractiveLights";
import InteractionManager from "../canvas/interaction/InteractionManager";
import AssetTransformControls from "../canvas/interaction/AssetTransformControls";
import EditorHotkeys from "../canvas/interaction/EditorHotkeys";
import Crosshair from "../overlay/hud/Crosshair";
import MobileControls from "../overlay/hud/MobileControls";
import MobileTouchHint from "../overlay/hud/MobileTouchHint";

type SceneViewportProps = {
  className?: string;
  gl?: ComponentProps<typeof Canvas>["gl"];
  camera: ComponentProps<typeof Canvas>["camera"];
  includeEditorTools?: boolean;
  toneMappingExposure?: number;
  modeBadge?: ReactNode;
  bottomNotice?: ReactNode;
};

export function SceneViewport({
  className = "",
  gl = {
    antialias: true,
    alpha: false,
    stencil: false,
    depth: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false
  },
  camera,
  includeEditorTools = false,
  toneMappingExposure = 1.08,
  modeBadge,
  bottomNotice
}: SceneViewportProps) {
  return (
    <div className={`relative h-full w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#050505] shadow-2xl ${className}`.trim()}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={gl}
        camera={camera}
        className="h-full w-full"
        onCreated={({ gl: rendererContext }) => {
          const renderer = rendererContext as THREE.WebGLRenderer & { physicallyCorrectLights?: boolean };
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = toneMappingExposure;
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          if ("physicallyCorrectLights" in renderer) {
            renderer.physicallyCorrectLights = true;
          }
        }}
      >
        <color attach="background" args={["#0a0a0b"]} />
        <Suspense fallback={null}>
          <PhysicsWorld>
            <Lights />
            <SceneEnvironment />
            <CameraRig />
            {includeEditorTools ? (
              <>
                <EditorHotkeys />
                <AssetTransformControls />
              </>
            ) : null}
            <InteractionManager>
              <ProceduralFloor />
              <ProceduralCeiling />
              <ProceduralWall />
              <InteractiveDoors />
              <InteractiveLights />
              <Furniture />
            </InteractionManager>
          </PhysicsWorld>
          <PostEffects />
        </Suspense>
      </Canvas>

      <Crosshair />
      <MobileTouchHint />
      <MobileControls />

      {modeBadge ? (
        <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/70 backdrop-blur-xl">
          {modeBadge}
        </div>
      ) : null}

      {bottomNotice ? (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-[20px] border border-amber-300/25 bg-amber-200/10 px-4 py-3 text-sm text-amber-50 backdrop-blur-xl sm:right-auto sm:max-w-md">
          {bottomNotice}
        </div>
      ) : null}
    </div>
  );
}
