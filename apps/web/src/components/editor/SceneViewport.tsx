"use client";

import "../../lib/polyfills/progress-event";
import { Canvas } from "@react-three/fiber";
import type { ReactNode, ComponentProps } from "react";
import { Suspense, useMemo } from "react";
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
import AssetTransformControls from "../canvas/interaction/AssetTransformControls";
import EditorHotkeys from "../canvas/interaction/EditorHotkeys";
import InteractionManager from "../canvas/interaction/InteractionManager";
import ViewerProductHotspots from "../canvas/interaction/ViewerProductHotspots";
import Crosshair from "../overlay/hud/Crosshair";
import MobileControls from "../overlay/hud/MobileControls";
import MobileTouchHint from "../overlay/hud/MobileTouchHint";
import { resolveSceneRenderQuality, type SceneInteractionMode } from "../../lib/scene/render-quality";
import { useEditorStore } from "../../lib/stores/useEditorStore";

type SceneViewportProps = {
  className?: string;
  gl?: ComponentProps<typeof Canvas>["gl"];
  camera: ComponentProps<typeof Canvas>["camera"];
  interactionMode?: SceneInteractionMode;
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
  const viewMode = useEditorStore((state) => state.viewMode);
  const topMode = useEditorStore((state) => state.topMode);
  const resolvedInteractionMode = interactionMode ?? "viewer-showcase";
  const renderViewerHotspots = resolvedInteractionMode === "viewer-shared";
  const renderInteractiveShellControls =
    resolvedInteractionMode === "editor" || resolvedInteractionMode === "preview";
  const renderOpeningDecor = renderInteractiveShellControls && viewMode !== "top";
  const renderLightingDecor = renderInteractiveShellControls && viewMode !== "top";
  const isLightTone = chromeTone === "light";
  const quality = useMemo(() => {
    const coarsePointer =
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(pointer: coarse)")?.matches || navigator.maxTouchPoints > 0);

    return resolveSceneRenderQuality({
      interactionMode: resolvedInteractionMode,
      viewMode,
      topMode,
      coarsePointer,
      devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      hardwareConcurrency:
        typeof navigator !== "undefined" && typeof navigator.hardwareConcurrency === "number"
          ? navigator.hardwareConcurrency
          : 8,
      viewportWidth: typeof window !== "undefined" ? window.innerWidth : 1440
    });
  }, [resolvedInteractionMode, topMode, viewMode]);

  const sceneContent = (
    <>
      <Lights quality={quality} />
      <SceneEnvironment quality={quality} />
      <CameraRig />
      <InteractionManager>
        <ProceduralFloor />
        <ProceduralCeiling />
        <ProceduralWall />
        {renderOpeningDecor ? <InteractiveDoors /> : null}
        {renderLightingDecor ? <InteractiveLights /> : null}
        <Furniture allowDynamicLights={quality.allowDynamicLights} />
        {resolvedInteractionMode === "editor" ? <AssetTransformControls /> : null}
        {resolvedInteractionMode === "editor" ? <EditorHotkeys /> : null}
        {renderViewerHotspots ? <ViewerProductHotspots /> : null}
      </InteractionManager>
    </>
  );

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-[28px] ${
        isLightTone ? "border border-black/10 bg-[#d7d7d5] shadow-[0_18px_48px_rgba(16,18,22,0.18)]" : "border border-white/10 bg-[#050505] shadow-2xl"
      } ${className}`.trim()}
    >
      <Canvas
        shadows={quality.enableShadows}
        dpr={quality.dpr}
        gl={gl}
        camera={camera}
        className="h-full w-full"
        onCreated={({ gl: rendererContext }) => {
          const renderer = rendererContext as THREE.WebGLRenderer & { physicallyCorrectLights?: boolean };
          renderer.shadowMap.enabled = quality.enableShadows;
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
          {viewMode === "walk" ? <PhysicsWorld>{sceneContent}</PhysicsWorld> : sceneContent}
          <PostEffects quality={quality} />
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
