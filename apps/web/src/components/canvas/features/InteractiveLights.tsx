"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useShellSelector } from "../../../lib/stores/scene-slices";
import { useInteractionRegistry } from "../interaction/InteractionManager";

type LightSpec = {
  id: string;
  position: [number, number, number];
  intensity: number;
};

function createBeamMaterial(height: number, opacity: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uHeight: { value: height },
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color("#ffe8b2") }
    },
    vertexShader: `
      varying vec3 vLocalPosition;

      void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vLocalPosition;
      uniform float uHeight;
      uniform float uOpacity;
      uniform vec3 uColor;

      void main() {
        float vertical = clamp((uHeight * 0.5 - vLocalPosition.y) / uHeight, 0.0, 1.0);
        float radial = length(vLocalPosition.xz);
        float radialFade = 1.0 - smoothstep(0.12, 0.82, radial);
        float alpha = vertical * vertical * radialFade * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
}

function createFloorGlowMaterial(opacity: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color("#ffe2a3") }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform vec3 uColor;

      void main() {
        float radial = distance(vUv, vec2(0.5));
        float alpha = (1.0 - smoothstep(0.0, 0.5, radial)) * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
}

function createIndirectGlowMaterial(opacity: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color("#fff1cf") }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform vec3 uColor;

      void main() {
        float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float edgeGlow = 1.0 - smoothstep(0.0, 0.22, edge);
        float centerFalloff = 1.0 - smoothstep(0.1, 0.62, distance(vUv, vec2(0.5)));
        float alpha = max(edgeGlow * 0.9, centerFalloff * 0.22) * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
}

function LightFixture({
  spec,
  accentIntensity,
  beamOpacity
}: {
  spec: LightSpec;
  accentIntensity: number;
  beamOpacity: number;
}) {
  const registry = useInteractionRegistry();
  const rootRef = useRef<THREE.Group | null>(null);
  const bulbRef = useRef<THREE.Mesh | null>(null);
  const lightRef = useRef<THREE.PointLight | null>(null);
  const [isOn, setIsOn] = useState(true);
  const beamHeight = Math.max(1.4, spec.position[1] - 0.04);
  const beamMaterial = useMemo(() => createBeamMaterial(beamHeight, 0), [beamHeight]);
  const floorGlowMaterial = useMemo(() => createFloorGlowMaterial(0), []);

  useEffect(() => {
    if (!lightRef.current) return;
    const nextLightIntensity = isOn ? spec.intensity * accentIntensity : 0;
    const nextBulbIntensity = isOn ? 0.46 + accentIntensity * 0.94 : 0.08;
    const nextGlowOpacity = isOn ? beamOpacity : 0;

    gsap.to(lightRef.current, {
      intensity: nextLightIntensity,
      duration: 0.45,
      ease: "power2.out"
    });
    if (bulbRef.current?.material instanceof THREE.MeshStandardMaterial) {
      gsap.to(bulbRef.current.material, {
        emissiveIntensity: nextBulbIntensity,
        duration: 0.35,
        ease: "power2.out"
      });
    }
    gsap.to(beamMaterial.uniforms.uOpacity, {
      value: nextGlowOpacity,
      duration: 0.4,
      ease: "power2.out"
    });
    gsap.to(floorGlowMaterial.uniforms.uOpacity, {
      value: nextGlowOpacity * 0.8,
      duration: 0.4,
      ease: "power2.out"
    });
  }, [accentIntensity, beamMaterial.uniforms.uOpacity, beamOpacity, floorGlowMaterial.uniforms.uOpacity, isOn, spec.intensity]);

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

  useEffect(() => {
    return () => {
      beamMaterial.dispose();
      floorGlowMaterial.dispose();
    };
  }, [beamMaterial, floorGlowMaterial]);

  return (
    <group ref={rootRef} position={spec.position}>
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.03, 24]} />
        <meshStandardMaterial color="#f1eee7" roughness={0.82} />
      </mesh>
      <mesh ref={bulbRef} position={[0, 0.025, 0]} castShadow={false} receiveShadow={false}>
        <cylinderGeometry args={[0.06, 0.06, 0.02, 24]} />
        <meshStandardMaterial color="#fff5d6" emissive="#fff1c2" emissiveIntensity={0.95} roughness={0.18} />
      </mesh>
      <mesh position={[0, -beamHeight / 2, 0]} renderOrder={3}>
        <coneGeometry args={[0.82, beamHeight, 28, 1, true]} />
        <primitive object={beamMaterial} attach="material" />
      </mesh>
      <mesh position={[0, -beamHeight + 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <planeGeometry args={[1.75, 1.75, 1, 1]} />
        <primitive object={floorGlowMaterial} attach="material" />
      </mesh>
      <pointLight ref={lightRef} intensity={0} distance={5.5} decay={2.1} color="#fff1c2" />
    </group>
  );
}

function IndirectCeilingGlow({
  centerX,
  centerZ,
  width,
  depth,
  height,
  accentIntensity
}: {
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  height: number;
  accentIntensity: number;
}) {
  const material = useMemo(() => createIndirectGlowMaterial(Math.min(0.42, accentIntensity * 0.42)), [accentIntensity]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <group position={[centerX, height, centerZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[Math.max(1.8, width), Math.max(1.8, depth), 1, 1]} />
        <primitive object={material} attach="material" />
      </mesh>
      <pointLight
        position={[0, -0.14, 0]}
        intensity={accentIntensity * 0.52}
        distance={Math.max(width, depth) * 1.2}
        decay={2.4}
        color="#fff0cf"
      />
    </group>
  );
}

function computeBounds(walls: { start: [number, number]; end: [number, number]; height: number }[], scale: number) {
  if (walls.length === 0) {
    return { minX: -2, maxX: 2, minZ: -2, maxZ: 2, ceilingHeight: 2.35 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let ceilingHeight = 2.35;
  walls.forEach((wall) => {
    [wall.start, wall.end].forEach(([x, z]) => {
      const scaledX = x * scale;
      const scaledZ = z * scale;
      minX = Math.min(minX, scaledX);
      maxX = Math.max(maxX, scaledX);
      minZ = Math.min(minZ, scaledZ);
      maxZ = Math.max(maxZ, scaledZ);
    });
    ceilingHeight = Math.max(ceilingHeight, wall.height * scale - 0.15);
  });
  return { minX, maxX, minZ, maxZ, ceilingHeight };
}

export default function InteractiveLights() {
  const walls = useShellSelector((slice) => slice.walls);
  const scale = useShellSelector((slice) => slice.scale);
  const lighting = useShellSelector((slice) => slice.lighting);

  const layout = useMemo(() => {
    const bounds = computeBounds(walls, scale);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const width = Math.max(2, bounds.maxX - bounds.minX);
    const depth = Math.max(2, bounds.maxZ - bounds.minZ);
    const height = bounds.ceilingHeight;
    const specs: LightSpec[] = [
      { id: "light-center", position: [centerX, height, centerZ], intensity: 0.74 }
    ];
    if (width > 5) {
      specs.push({ id: "light-east", position: [centerX + width * 0.2, height, centerZ], intensity: 0.62 });
      specs.push({ id: "light-west", position: [centerX - width * 0.2, height, centerZ], intensity: 0.62 });
    }
    if (depth > 5) {
      specs.push({ id: "light-north", position: [centerX, height, centerZ - depth * 0.2], intensity: 0.56 });
      specs.push({ id: "light-south", position: [centerX, height, centerZ + depth * 0.2], intensity: 0.56 });
    }
    return {
      centerX,
      centerZ,
      width,
      depth,
      height,
      fixtures: specs
    };
  }, [scale, walls]);

  if (lighting.mode === "indirect") {
    return (
      <IndirectCeilingGlow
        centerX={layout.centerX}
        centerZ={layout.centerZ}
        width={layout.width}
        depth={layout.depth}
        height={layout.height - 0.03}
        accentIntensity={lighting.accentIntensity}
      />
    );
  }

  if (layout.fixtures.length === 0) return null;

  return (
    <group>
      {layout.fixtures.map((spec) => (
        <LightFixture
          key={spec.id}
          spec={spec}
          accentIntensity={lighting.accentIntensity}
          beamOpacity={lighting.beamOpacity}
        />
      ))}
    </group>
  );
}
