"use client";

import { useShellSelector } from "../../../lib/stores/scene-slices";

export default function Lights() {
  const lighting = useShellSelector((slice) => slice.lighting);

  return (
    <>
      <ambientLight intensity={lighting.ambientIntensity} />
      <hemisphereLight intensity={lighting.hemisphereIntensity} color="#ffffff" groundColor="#d6d2c8" />
      <directionalLight
        position={[10, 16, 8]}
        intensity={lighting.directionalIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
      />
    </>
  );
}
