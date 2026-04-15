"use client";

import "../../lib/polyfills/progress-event";
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
import ViewerProductHotspots from "../canvas/interaction/ViewerProductHotspots";
import Crosshair from "../overlay/hud/Crosshair";
import MobileControls from "../overlay/hud/MobileControls";
import MobileTouchHint from "../overlay/hud/MobileTouchHint";

type SceneViewportProps = {
  className?: string;
  gl?: ComponentProps<typeof Canvas>["gl"];
  camera: ComponentProps<typeof Canvas>["camera"];
  interactionMode?: "editor" | "viewer" | "preview";
  toneMappingExposure?: number;
  modeBadge?: ReactNode;
  bottomNotice?: ReactNode;
  chromeTone?: "dark" | "light";
  showHud?: boolean;
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
  interactionMode,
  toneMappingExposure = 1.12,
  modeBadge,
  bottomNotice,
  chromeTone = "dark",
  showHud = true
}: SceneViewportProps) {
  const resolvedInteractionMode = interactionMode ?? "viewer";
  const renderEditorTools = resolvedInteractionMode === "editor";
  const renderViewerHotspots = resolvedInteractionMode === "viewer";
  const renderInteractiveShellControls = resolvedInteractionMode !== "viewer";
  const isLightTone = chromeTone === "light";
  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-[28px] ${
        isLightTone ? "border border-black/10 bg-[#d7d7d5] shadow-[0_18px_48px_rgba(16,18,22,0.18)]" : "border border-white/10 bg-[#050505] shadow-2xl"
      } ${className}`.trim()}
    >
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
        <color attach="background" args={[isLightTone ? "#d0d0ce" : "#0a0a0b"]} />
        <Suspense fallback={null}>
          <PhysicsWorld>
            <Lights />
            <SceneEnvironment />
            <CameraRig />
            {renderEditorTools ? (
              <>
                <EditorHotkeys />
                <AssetTransformControls />
              </>
            ) : null}
            <InteractionManager>
              <ProceduralFloor />
              <ProceduralCeiling />
              <ProceduralWall />
              {renderInteractiveShellControls ? <InteractiveDoors /> : null}
              {renderInteractiveShellControls ? <InteractiveLights /> : null}
              <Furniture />
              {renderViewerHotspots ? <ViewerProductHotspots /> : null}
            </InteractionManager>
          </PhysicsWorld>
          <PostEffects />
        </Suspense>
      </Canvas>

      {showHud ? (
        <>
          <Crosshair />
          <MobileTouchHint />
          <MobileControls />
        </>
      ) : null}

      {modeBadge ? (
        <div
          className={`pointer-events-none absolute left-4 top-4 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] backdrop-blur-xl ${
            isLightTone
              ? "border border-black/10 bg-white/85 text-[#4e463d]"
              : "border border-white/10 bg-black/45 text-white/70"
          }`}
        >
          {modeBadge}
        </div>
      ) : null}

      {bottomNotice ? (
        <div
          className={`pointer-events-none absolute bottom-4 left-4 right-4 rounded-[20px] px-4 py-3 text-sm backdrop-blur-xl sm:right-auto sm:max-w-md ${
            isLightTone
              ? "border border-amber-500/30 bg-amber-50/90 text-[#6c4b1f]"
              : "border border-amber-300/25 bg-amber-200/10 text-amber-50"
          }`}
        >
          {bottomNotice}
        </div>
      ) : null}
    </div>
  );
}
