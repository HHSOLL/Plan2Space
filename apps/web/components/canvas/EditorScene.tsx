"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl, TransformControls as TransformControlsImpl } from "three-stdlib";
import type { Euler, Vec3 } from "../../../../types/database";
import { useDesignStore } from "../../store/useDesignStore";
import { FurnitureMesh } from "./FurnitureMesh";

type TransformMode = "translate" | "rotate";

function vector3ToVec3(v: THREE.Vector3): Vec3 {
  return [v.x, v.y, v.z];
}

function eulerToTuple(e: THREE.Euler): Euler {
  return [e.x, e.y, e.z];
}

export function EditorScene() {
  const furniture = useDesignStore((s) => s.furniture);
  const selectedItemId = useDesignStore((s) => s.selectedItemId);
  const updateFurnitureTransform = useDesignStore((s) => s.updateFurnitureTransform);
  const clearSelection = useDesignStore((s) => s.clearSelection);

  const [mode, setMode] = useState<TransformMode>("translate");

  const objectRefs = useRef(new Map<string, THREE.Group>());
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const transformRef = useRef<TransformControlsImpl | null>(null);

  const selectedObject = selectedItemId ? objectRefs.current.get(selectedItemId) ?? null : null;

  const setFurnitureRef = useCallback(
    (id: string) => (node: THREE.Group | null) => {
      if (node) objectRefs.current.set(id, node);
      else objectRefs.current.delete(id);
    },
    []
  );

  const syncSelectedTransformToStore = useCallback(() => {
    if (!selectedItemId) return;
    const obj = objectRefs.current.get(selectedItemId);
    if (!obj) return;
    updateFurnitureTransform(selectedItemId, vector3ToVec3(obj.position), eulerToTuple(obj.rotation), vector3ToVec3(obj.scale));
  }, [selectedItemId, updateFurnitureTransform]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "g" || e.key === "G") setMode("translate");
      if (e.key === "r" || e.key === "R") setMode("rotate");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Canvas
      shadows
      camera={{ position: [6, 6, 6], fov: 50 }}
      onPointerMissed={() => clearSelection()}
    >
      <color attach="background" args={["#0b0b0d"]} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 12, 6]} intensity={1.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#1a1a1f" />
      </mesh>
      <gridHelper args={[50, 50, "#2a2a33", "#202028"]} position={[0, 0.001, 0]} />

      <OrbitControls ref={orbitRef} makeDefault enableDamping />

      {selectedObject && (
        <TransformControls
          ref={transformRef}
          object={selectedObject}
          mode={mode}
          onMouseDown={() => {
            if (orbitRef.current) orbitRef.current.enabled = false;
          }}
          onMouseUp={() => {
            if (orbitRef.current) orbitRef.current.enabled = true;
            syncSelectedTransformToStore();
          }}
        />
      )}

      {furniture.map((item) => (
        <FurnitureMesh key={item.id} item={item} ref={setFurnitureRef(item.id)} />
      ))}
    </Canvas>
  );
}
