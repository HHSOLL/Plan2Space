"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useSceneStore } from "../../../lib/stores/useSceneStore";
import { useInteractionRegistry } from "../interaction/InteractionManager";

type LightSpec = {
  id: string;
  position: [number, number, number];
  intensity: number;
};

function LightFixture({ spec }: { spec: LightSpec }) {
  const registry = useInteractionRegistry();
  const rootRef = useRef<THREE.Group | null>(null);
  const bulbRef = useRef<THREE.Mesh | null>(null);
  const lightRef = useRef<THREE.PointLight | null>(null);
  const [isOn, setIsOn] = useState(true);

  useEffect(() => {
    if (!lightRef.current) return;
    gsap.to(lightRef.current, {
      intensity: isOn ? spec.intensity : 0,
      duration: 0.5,
      ease: "power2.out"
    });
    if (bulbRef.current?.material instanceof THREE.MeshStandardMaterial) {
      gsap.to(bulbRef.current.material, {
        emissiveIntensity: isOn ? 1.2 : 0.1,
        duration: 0.4,
        ease: "power2.out"
      });
    }
  }, [isOn, spec.intensity]);

  useEffect(() => {
    const group = rootRef.current;
    if (!group) return;
    group.userData.interactive = true;
    group.userData.interactionLabel = "Light";
    group.userData.onInteract = () => setIsOn((prev) => !prev);
    if (bulbRef.current) {
      group.userData.highlightMesh = bulbRef.current;
    }
    registry?.register(group);
    return () => registry?.unregister(group);
  }, [registry]);

  return (
    <group ref={rootRef} position={spec.position}>
      <mesh ref={bulbRef} castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#fff5d6" emissive="#fff1c2" emissiveIntensity={1.2} roughness={0.25} />
      </mesh>
      <pointLight ref={lightRef} intensity={spec.intensity} distance={6} decay={2.2} color="#fff1c2" />
    </group>
  );
}

function computeBounds(walls: { start: [number, number]; end: [number, number] }[], scale: number) {
  if (walls.length === 0) {
    return { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  walls.forEach((wall) => {
    [wall.start, wall.end].forEach(([x, z]) => {
      const scaledX = x * scale;
      const scaledZ = z * scale;
      minX = Math.min(minX, scaledX);
      maxX = Math.max(maxX, scaledX);
      minZ = Math.min(minZ, scaledZ);
      maxZ = Math.max(maxZ, scaledZ);
    });
  });
  return { minX, maxX, minZ, maxZ };
}

export default function InteractiveLights() {
  const walls = useSceneStore((state) => state.walls);
  const scale = useSceneStore((state) => state.scale);

  const fixtures = useMemo(() => {
    const bounds = computeBounds(walls, scale);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const width = Math.max(2, bounds.maxX - bounds.minX);
    const depth = Math.max(2, bounds.maxZ - bounds.minZ);
    const height = 2.35;
    const specs: LightSpec[] = [
      { id: "light-center", position: [centerX, height, centerZ], intensity: 1.1 }
    ];
    if (width > 5) {
      specs.push({ id: "light-east", position: [centerX + width * 0.2, height, centerZ], intensity: 0.9 });
      specs.push({ id: "light-west", position: [centerX - width * 0.2, height, centerZ], intensity: 0.9 });
    }
    if (depth > 5) {
      specs.push({ id: "light-north", position: [centerX, height, centerZ - depth * 0.2], intensity: 0.8 });
      specs.push({ id: "light-south", position: [centerX, height, centerZ + depth * 0.2], intensity: 0.8 });
    }
    return specs;
  }, [scale, walls]);

  if (fixtures.length === 0) return null;

  return (
    <group>
      {fixtures.map((spec) => (
        <LightFixture key={spec.id} spec={spec} />
      ))}
    </group>
  );
}
