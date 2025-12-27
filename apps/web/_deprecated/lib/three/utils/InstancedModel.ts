import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface InstanceData {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
}

export default class InstancedModel {
    mesh: THREE.InstancedMesh;
    count: number;

    constructor(gltf: GLTF, instances: InstanceData[]) {
        this.count = instances.length;

        // Find the first mesh in GLTF to instance
        // Limitation: assumes single mesh model for now
        let geometry: THREE.BufferGeometry | null = null;
        let material: THREE.Material | THREE.Material[] | null = null;

        gltf.scene.traverse((child) => {
            if (!geometry && child instanceof THREE.Mesh) {
                geometry = child.geometry;
                material = child.material;
            }
        });

        if (!geometry || !material) {
            throw new Error('No mesh found in GLTF to instance');
        }

        this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.count; i++) {
            const { position, rotation, scale } = instances[i];
            dummy.position.copy(position);
            dummy.rotation.copy(rotation);
            dummy.scale.copy(scale);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    get instance(): THREE.InstancedMesh {
        return this.mesh;
    }

    dispose(): void {
        this.mesh.dispose();
    }
}
