"use client";

import { Component, Suspense, forwardRef, memo, useEffect, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { SceneAsset } from "../../lib/stores/useSceneStore";
import { getAssetPublicUrl } from "../../lib/storage";
import { useSelectionSelector } from "../../lib/stores/scene-slices";

type FurnitureMeshProps = {
  item: SceneAsset;
  interactive?: boolean;
};

type ProceduralKind = "desk" | "chair" | "shelf" | "bed" | "generic";

class ModelErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function resolveGlbPath(item: SceneAsset): string {
  return item.assetId;
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function looksLikeGltfPath(value: string) {
  if (!value) return false;
  if (value.startsWith("http://") || value.startsWith("https://")) return true;
  return value.endsWith(".glb") || value.endsWith(".gltf") || value.includes("placeholder:");
}

function inferProceduralKind(item: SceneAsset): ProceduralKind {
  const assetId = (item.assetId ?? "").toLowerCase();

  if (assetId.includes("desk") || assetId.includes("table")) return "desk";
  if (assetId.includes("chair") || assetId.includes("stool")) return "chair";
  if (assetId.includes("shelf") || assetId.includes("book")) return "shelf";
  if (assetId.includes("bed")) return "bed";
  return "generic";
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ProceduralFurniture({ kind }: { kind: ProceduralKind }) {
  const wood = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#d2b48c",
        roughness: 0.68,
        metalness: 0.02
      }),
    []
  );

  const metal = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#121212",
        roughness: 0.35,
        metalness: 0.85
      }),
    []
  );

  const fabric = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#9ca3af",
        roughness: 0.92,
        metalness: 0.0
      }),
    []
  );

  const ceramic = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f5f5f4",
        roughness: 0.25,
        metalness: 0.0
      }),
    []
  );

  const accentGlow = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0b1220",
        emissive: new THREE.Color().setRGB(0.2, 0.35, 0.9),
        emissiveIntensity: 0.45,
        roughness: 0.65,
        metalness: 0.0
      }),
    []
  );

  const books = useMemo(() => {
    const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];
    const localRand = mulberry32(2024);
    return Array.from({ length: 42 }, (_, i) => ({
      id: `b-${i}`,
      x: (localRand() - 0.5) * 0.95,
      y: 0.36 + Math.floor(i / 14) * 0.32,
      z: (localRand() - 0.5) * 0.2,
      h: 0.18 + localRand() * 0.1,
      c: colors[Math.floor(localRand() * colors.length)]!
    }));
  }, []);

  useEffect(() => {
    return () => {
      wood.dispose();
      metal.dispose();
      fabric.dispose();
      ceramic.dispose();
      accentGlow.dispose();
    };
  }, [accentGlow, ceramic, fabric, metal, wood]);

  if (kind === "desk") {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.75, 0]} material={wood}>
          <boxGeometry args={[1.5, 0.06, 0.7]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0.48, 0.37, 0.25]} material={metal}>
          <boxGeometry args={[0.05, 0.74, 0.05]} />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.48, 0.37, 0.25]} material={metal}>
          <boxGeometry args={[0.05, 0.74, 0.05]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0.48, 0.37, -0.25]} material={metal}>
          <boxGeometry args={[0.05, 0.74, 0.05]} />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.48, 0.37, -0.25]} material={metal}>
          <boxGeometry args={[0.05, 0.74, 0.05]} />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.42, 0.62, 0]} material={wood}>
          <boxGeometry args={[0.34, 0.18, 0.58]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0.35, 0.82, -0.08]} material={accentGlow}>
          <boxGeometry args={[0.62, 0.02, 0.36]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0.35, 0.9, -0.08]} material={ceramic}>
          <cylinderGeometry args={[0.05, 0.06, 0.12, 24]} />
        </mesh>
      </group>
    );
  }

  if (kind === "chair") {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.46, 0]} material={fabric}>
          <boxGeometry args={[0.5, 0.07, 0.5]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.78, -0.22]} material={fabric}>
          <boxGeometry args={[0.5, 0.62, 0.08]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0.2, 0.23, 0.2]} material={metal}>
          <cylinderGeometry args={[0.025, 0.025, 0.46, 18]} />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.2, 0.23, 0.2]} material={metal}>
          <cylinderGeometry args={[0.025, 0.025, 0.46, 18]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0.2, 0.23, -0.2]} material={metal}>
          <cylinderGeometry args={[0.025, 0.025, 0.46, 18]} />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.2, 0.23, -0.2]} material={metal}>
          <cylinderGeometry args={[0.025, 0.025, 0.46, 18]} />
        </mesh>
      </group>
    );
  }

  if (kind === "bed") {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.18, 0]} material={wood}>
          <boxGeometry args={[1.4, 0.26, 2.0]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.36, 0]} material={fabric}>
          <boxGeometry args={[1.34, 0.18, 1.94]} />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.35, 0.46, -0.7]} material={ceramic}>
          <boxGeometry args={[0.5, 0.12, 0.3]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0.35, 0.46, -0.7]} material={ceramic}>
          <boxGeometry args={[0.5, 0.12, 0.3]} />
        </mesh>
      </group>
    );
  }

  if (kind === "shelf") {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.9, 0]} material={wood}>
          <boxGeometry args={[1.2, 1.8, 0.3]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.9, 0.14]} material={metal}>
          <boxGeometry args={[1.16, 1.76, 0.02]} />
        </mesh>
        {books.map((b) => (
          <mesh key={b.id} castShadow receiveShadow position={[b.x, b.y, 0.12]}>
            <boxGeometry args={[0.05, b.h, 0.16]} />
            <meshStandardMaterial color={b.c} roughness={0.82} metalness={0.0} />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.45, 0]} material={wood}>
        <boxGeometry args={[1.0, 0.08, 0.6]} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.42, 0.23, 0.24]} material={metal}>
        <boxGeometry args={[0.04, 0.46, 0.04]} />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.42, 0.23, 0.24]} material={metal}>
        <boxGeometry args={[0.04, 0.46, 0.04]} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.42, 0.23, -0.24]} material={metal}>
        <boxGeometry args={[0.04, 0.46, 0.04]} />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.42, 0.23, -0.24]} material={metal}>
        <boxGeometry args={[0.04, 0.46, 0.04]} />
      </mesh>
    </group>
  );
}

function GltfModel({ url }: { url: string }) {
  const gltf = useGLTF(url);

  const scene = useMemo(() => {
    const cloned = (gltf.scene as THREE.Group).clone(true);
    cloned.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return cloned;
  }, [gltf.scene]);

  return <primitive object={scene} />;
}

const FurnitureMeshInner = forwardRef<THREE.Group, FurnitureMeshProps>(function FurnitureMeshInner(
  { item, interactive = true },
  ref
) {
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const setSelectedAssetId = useSelectionSelector((slice) => slice.setSelectedAssetId);
  const isSelected = selectedAssetId === item.id;

  const kind = useMemo(() => inferProceduralKind(item), [item]);

  const glbPath = useMemo(() => resolveGlbPath(item), [item]);
  const canLoadGltf = useMemo(() => looksLikeGltfPath(glbPath) && !looksLikeUuid(glbPath), [glbPath]);
  const glbUrl = useMemo(
    () => (glbPath.startsWith("http://") || glbPath.startsWith("https://") ? glbPath : getAssetPublicUrl(glbPath)),
    [glbPath]
  );

  return (
    <group
      ref={ref}
      position={item.position}
      rotation={item.rotation}
      scale={item.scale}
      onPointerDown={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        setSelectedAssetId(item.id);
      }}
    >
      {canLoadGltf && !glbPath.includes("placeholder:") ? (
        <Suspense fallback={<ProceduralFurniture kind={kind} />}>
          <ModelErrorBoundary fallback={<ProceduralFurniture kind={kind} />} key={glbUrl}>
            <GltfModel url={glbUrl} />
          </ModelErrorBoundary>
        </Suspense>
      ) : (
        <ProceduralFurniture kind={kind} />
      )}

      {isSelected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.38, 0.55, 64]} />
          <meshBasicMaterial color="#1a1a1a" transparent opacity={0.65} />
        </mesh>
      ) : null}
    </group>
  );
});

export const FurnitureMesh = memo(
  forwardRef<THREE.Group, FurnitureMeshProps>(function FurnitureMesh(props, ref) {
    return <FurnitureMeshInner {...props} ref={ref} />;
  })
);
