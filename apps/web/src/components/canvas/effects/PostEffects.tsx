"use client";

import { Bloom, EffectComposer, Noise, Vignette, SSAO } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import type { SceneRenderQuality } from "../../../lib/scene/render-quality";

export default function PostEffects({ quality }: { quality: SceneRenderQuality }) {
  const { size, gl, scene, camera } = useThree();

  const isReady = useMemo(() => {
    return (
      gl &&
      scene &&
      camera &&
      size &&
      size.width > 0 &&
      size.height > 0 &&
      !(gl as { isContextLost?: () => boolean }).isContextLost?.()
    );
  }, [gl, scene, camera, size]);

  if (!isReady || !quality.enablePostEffects) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <EffectComposer
        key={`${size.width}-${size.height}`}
        multisampling={quality.composerMultisampling}
        enableNormalPass={quality.enableSsao}
        stencilBuffer={false}
        autoClear={false}
      >
        {quality.enableSsao ? (
          <SSAO
            intensity={6.5}
            radius={0.05}
            luminanceInfluence={0.42}
            bias={0.02}
            worldDistanceThreshold={1}
            worldDistanceFalloff={0.2}
            worldProximityThreshold={0.8}
            worldProximityFalloff={0.2}
            samples={10}
            rings={3}
          />
        ) : null}
        <Bloom intensity={0.35} luminanceThreshold={0.9} luminanceSmoothing={0.2} />
        <Vignette offset={0.22} darkness={0.28} />
        <Noise opacity={0.006} />
      </EffectComposer>
    </Suspense>
  );
}
