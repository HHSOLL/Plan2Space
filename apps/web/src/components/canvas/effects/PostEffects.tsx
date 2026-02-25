"use client";

import { Bloom, DepthOfField, EffectComposer, Noise, Vignette, SSAO } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import { Suspense, useMemo } from "react";

export default function PostEffects() {
  const { size, gl, scene, camera } = useThree();

  // Robust guards to ensure all required objects and context are available
  const isReady = useMemo(() => {
    return (
      gl &&
      scene &&
      camera &&
      size &&
      size.width > 0 &&
      size.height > 0 &&
      !(gl as any).isContextLost?.()
    );
  }, [gl, scene, camera, size]);

  if (!isReady) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <EffectComposer
        key={`${size.width}-${size.height}`} // Force recreation when size changes significantly
        multisampling={0}
        enableNormalPass={true} // Required for SSAO
        stencilBuffer={false}
        autoClear={false}
      >
        {/* <SSAO
          intensity={10}
          radius={0.05}
          luminanceInfluence={0.5}
          bias={0.02}
        /> */}
        <Bloom intensity={0.5} luminanceThreshold={1.0} luminanceSmoothing={0.15} />
        {/* <DepthOfField focusDistance={0.02} focalLength={0.02} bokehScale={1.4} height={480} /> */}
        <Vignette offset={0.3} darkness={0.48} />
        <Noise opacity={0.012} />
      </EffectComposer>
    </Suspense>
  );
}
