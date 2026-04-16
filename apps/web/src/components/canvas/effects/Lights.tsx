"use client";

import { useShellSelector } from "../../../lib/stores/scene-slices";

export default function Lights() {
  const lighting = useShellSelector((slice) => slice.lighting);

  return (
    <>
      <ambientLight intensity={lighting.ambientIntensity * 1.06} color="#fff2e6" />
      <hemisphereLight
        intensity={lighting.hemisphereIntensity * 1.08}
        color="#fff7ef"
        groundColor="#c7b6a2"
      />
      <directionalLight
        position={[8, 14, 6]}
        intensity={lighting.directionalIntensity * 1.08}
        color="#fff0de"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={48}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <directionalLight
        position={[-9, 10, -7]}
        intensity={Math.max(0.16, lighting.directionalIntensity * 0.24)}
        color="#d7e4ff"
      />
    </>
  );
}
