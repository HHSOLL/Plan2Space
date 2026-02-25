"use client";

export default function Lights() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight intensity={0.4} color="#ffffff" groundColor="#d6d2c8" />
      <directionalLight
        position={[10, 16, 8]}
        intensity={1.05}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
      />
    </>
  );
}
