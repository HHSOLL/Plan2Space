"use client";

import * as THREE from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
  type MeshBVHOptions
} from "three-mesh-bvh";

type BVHBufferGeometry = THREE.BufferGeometry & {
  boundsTree?: unknown;
  computeBoundsTree?: (options?: MeshBVHOptions) => void;
  disposeBoundsTree?: () => void;
};

let meshBvhInstalled = false;

function installMeshBvhRaycast() {
  const geometryPrototype =
    THREE.BufferGeometry.prototype as BVHBufferGeometry;

  if (!geometryPrototype.computeBoundsTree) {
    geometryPrototype.computeBoundsTree = computeBoundsTree;
  }

  if (!geometryPrototype.disposeBoundsTree) {
    geometryPrototype.disposeBoundsTree = disposeBoundsTree;
  }

  if (!meshBvhInstalled) {
    THREE.Mesh.prototype.raycast = acceleratedRaycast;
    meshBvhInstalled = true;
  }
}

export function ensureSceneBoundsTrees(
  root: THREE.Object3D,
  options?: MeshBVHOptions
) {
  installMeshBvhRaycast();

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const geometry = child.geometry as BVHBufferGeometry | undefined;
    if (!geometry?.attributes.position || geometry.boundsTree) {
      return;
    }

    geometry.computeBoundsTree?.(options);
  });
}
