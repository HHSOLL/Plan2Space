"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

type ModelPreviewProps = {
  modelPath: string;
};

function Model({ path }: { path: string }) {
  const gltf = useGLTF(path);

  return <primitive object={gltf.scene} position={[0, 0, 0]} scale={1} />;
}

class ModelErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#d1d5db" />
        </mesh>
      );
    }
    return this.props.children;
  }
}

export function ModelPreview({ modelPath }: ModelPreviewProps) {
  return (
    <Canvas
      camera={{ position: [2, 2, 3], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
      onCreated={(state) => {
        state.gl.setClearColor(new THREE.Color("#f3f4f6"));
      }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />

      <Suspense fallback={null}>
        <ModelErrorBoundary key={modelPath}>
          <Model path={modelPath} />
        </ModelErrorBoundary>
      </Suspense>

      <OrbitControls autoRotate autoRotateSpeed={4} enableZoom enablePan />

      <gridHelper args={[10, 10, "#e5e7eb", "#f3f4f6"]} position={[0, -0.5, 0]} />
    </Canvas>
  );
}

useGLTF.preload("/models/placeholder.glb");
