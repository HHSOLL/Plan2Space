"use client";

import { Suspense, forwardRef, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { FurnitureItem, Vec3 } from "../../../../types/database";
import { getAssetPublicUrl } from "../../lib/storage";
import { useDesignStore } from "../../store/useDesignStore";

type FurnitureMeshProps = {
  item: FurnitureItem;
};

function resolveGlbPath(item: FurnitureItem): string {
  const meta = item.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const record = meta as Record<string, unknown>;
    const glbPath = record.glbPath ?? record.glb_path ?? record.path;
    if (typeof glbPath === "string" && glbPath.length > 0) return glbPath;
  }
  return item.modelId;
}

function vector3ToVec3(v: THREE.Vector3): Vec3 {
  return [v.x, v.y, v.z];
}

const FurnitureMeshInner = forwardRef<THREE.Group, FurnitureMeshProps>(function FurnitureMeshInner({ item }, ref) {
  const selectedItemId = useDesignStore((s) => s.selectedItemId);
  const selectItem = useDesignStore((s) => s.selectItem);

  const isSelected = selectedItemId === item.id;

  const glbUrl = useMemo(() => getAssetPublicUrl(resolveGlbPath(item)), [item]);
  const gltf = useGLTF(glbUrl);

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

  const selectionBox = useMemo(() => {
    const box = new THREE.Box3();
    scene.updateMatrixWorld(true);
    box.setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    return { size, center, isEmpty: size.lengthSq() === 0 };
  }, [scene]);

  return (
    <group
      ref={ref}
      position={item.position}
      rotation={item.rotation}
      scale={item.scale}
      onPointerDown={(e) => {
        e.stopPropagation();
        selectItem(item.id);
      }}
    >
      <primitive object={scene} />
      {isSelected && !selectionBox.isEmpty && (
        <mesh position={vector3ToVec3(selectionBox.center)}>
          <boxGeometry args={[selectionBox.size.x, selectionBox.size.y, selectionBox.size.z]} />
          <meshBasicMaterial color="#00e5ff" wireframe transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
});

export const FurnitureMesh = forwardRef<THREE.Group, FurnitureMeshProps>(function FurnitureMesh(props, ref) {
  return (
    <Suspense fallback={null}>
      <FurnitureMeshInner {...props} ref={ref} />
    </Suspense>
  );
});
