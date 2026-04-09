"use client";

import { useSceneStore } from "../../../lib/stores/useSceneStore";

export default function Lights() {
  const lighting = useSceneStore((state) => state.lighting);

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
