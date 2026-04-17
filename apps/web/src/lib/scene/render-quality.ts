import type { EditorViewMode } from "../stores/useEditorStore";

export type SceneInteractionMode = "editor" | "viewer" | "preview";

export type SceneRenderQuality = {
  dpr: [number, number];
  enableShadows: boolean;
  shadowMapSize: number;
  enablePostEffects: boolean;
  enableSsao: boolean;
  composerMultisampling: number;
  enableContactShadows: boolean;
  contactShadowResolution: number;
  contactShadowBlur: number;
  contactShadowOpacity: number;
  allowDynamicLights: boolean;
};

type SceneRenderQualityInput = {
  interactionMode: SceneInteractionMode;
  viewMode: EditorViewMode;
  coarsePointer: boolean;
  devicePixelRatio: number;
  hardwareConcurrency: number;
  viewportWidth: number;
};

function clampRange(min: number, max: number): [number, number] {
  return [min, Math.max(min, max)];
}

export function resolveSceneRenderQuality({
  interactionMode,
  viewMode,
  coarsePointer,
  devicePixelRatio,
  hardwareConcurrency,
  viewportWidth
}: SceneRenderQualityInput): SceneRenderQuality {
  const isTopView = viewMode === "top";
  const isBuilderPreview = interactionMode === "preview" || viewMode === "builder-preview";
  const constrainedDevice =
    coarsePointer ||
    viewportWidth < 1280 ||
    devicePixelRatio > 1.5 ||
    (hardwareConcurrency > 0 && hardwareConcurrency <= 6);

  if (isTopView) {
    return {
      dpr: constrainedDevice ? clampRange(0.75, 1) : clampRange(0.85, 1.15),
      enableShadows: false,
      shadowMapSize: 512,
      enablePostEffects: false,
      enableSsao: false,
      composerMultisampling: 0,
      enableContactShadows: false,
      contactShadowResolution: 0,
      contactShadowBlur: 0,
      contactShadowOpacity: 0,
      allowDynamicLights: false
    };
  }

  if (isBuilderPreview) {
    return {
      dpr: constrainedDevice ? clampRange(0.85, 1.15) : clampRange(0.95, 1.35),
      enableShadows: true,
      shadowMapSize: constrainedDevice ? 768 : 1024,
      enablePostEffects: true,
      enableSsao: false,
      composerMultisampling: 0,
      enableContactShadows: true,
      contactShadowResolution: constrainedDevice ? 256 : 384,
      contactShadowBlur: 1.6,
      contactShadowOpacity: 0.34,
      allowDynamicLights: true
    };
  }

  return {
    dpr: constrainedDevice ? clampRange(0.95, 1.3) : clampRange(1, 1.5),
    enableShadows: true,
    shadowMapSize: constrainedDevice ? 1024 : 1536,
    enablePostEffects: true,
    enableSsao: !constrainedDevice,
    composerMultisampling: constrainedDevice ? 0 : 2,
    enableContactShadows: true,
    contactShadowResolution: constrainedDevice ? 384 : 640,
    contactShadowBlur: constrainedDevice ? 1.8 : 2,
    contactShadowOpacity: constrainedDevice ? 0.34 : 0.4,
    allowDynamicLights: true
  };
}
