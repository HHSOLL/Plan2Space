/**
 * Furniture - Manages furniture objects with GLB support
 */
import * as THREE from 'three';
import type Experience from '../Experience';
import type { DesignDoc } from '@webinterior/shared/types';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default class Furniture {
    group: THREE.Group;
    private experience: Experience;
    private resources: any;
    private items: THREE.Object3D[] = [];

    constructor(experience: Experience) {
        this.experience = experience;
        this.resources = this.experience.resources;
        this.group = new THREE.Group();
    }

    updateFromDoc(doc: DesignDoc): void {
        this.clear();
        if (!doc.objects) return;

        for (const obj of doc.objects) {
            this.createItem(obj);
        }
    }

    private createItem(obj: DesignDoc['objects'][number]): void {
        const key = this.getAssetKey(obj.objectSkuId, obj.name);
        const resource = this.resources.items[key] as GLTF | undefined;

        let item: THREE.Object3D;

        if (resource && resource.scene) {
            // Use GLB model
            item = resource.scene.clone();
        } else {
            // Fallback: Box placeholder
            const spec = this.getFallbackSpec(obj.objectSkuId, obj.name);
            const geo = new THREE.BoxGeometry(spec.size[0], spec.size[1], spec.size[2]);
            const mat = new THREE.MeshStandardMaterial({
                color: spec.color,
                emissive: spec.emissive ? spec.emissive : 0x000000,
                emissiveIntensity: spec.emissive ? 0.35 : 0
            });
            item = new THREE.Mesh(geo, mat);
        }

        // Position
        const yOffset = obj.pos.y ?? 0;

        if (item instanceof THREE.Mesh) {
            // It's a box
            const height = (item.geometry as THREE.BoxGeometry).parameters.height;
            item.position.set(obj.pos.x, height / 2 + yOffset, obj.pos.z);
            this.addEdges(item);
        } else {
            // It's a GLB (assume pivot at bottom)
            item.position.set(obj.pos.x, yOffset, obj.pos.z);
            // Apply edges to children
            item.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    this.addEdges(child, 0x000000, 0.15); // Lighter edges for detailed models
                }
            });
        }

        item.rotation.y = obj.rotY;

        item.castShadow = true;
        item.receiveShadow = true;
        item.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.group.add(item);
        this.items.push(item);
    }

    private addEdges(mesh: THREE.Mesh, color: number = 0x000000, opacity: number = 0.3): void {
        // Skip edges if geometry is very dense (optional optimization)
        const edges = new THREE.EdgesGeometry(mesh.geometry, 25);
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color, transparent: true, opacity })
        );
        mesh.add(line);
    }

    private getAssetKey(skuId: string, name: string): string {
        const n = name.toLowerCase();
        // Simple mapping logic
        if (n.includes('sofa')) return 'sofa_modern';
        if (n.includes('table')) return 'table_dining';
        if (n.includes('chair')) return 'chair_dining';
        if (n.includes('bed')) return 'bed_standard';
        if (n.includes('desk')) return 'desk_office';
        return skuId;
    }

    private getFallbackSpec(skuId: string, name: string): { size: [number, number, number]; color: string; emissive?: string } {
        // Re-use logic from Apartment.ts (simplified)
        const key = `${skuId} ${name}`.toLowerCase();
        if (key.includes('sofa')) return { size: [2.2, 0.85, 1.0], color: '#111827' };
        if (key.includes('table')) return { size: [1.2, 0.45, 0.7], color: '#9a6b43' };
        if (key.includes('desk')) return { size: [1.4, 0.75, 0.7], color: '#d4d4d8' };
        if (key.includes('tv')) return { size: [1.6, 0.9, 0.2], color: '#0b0b0f', emissive: '#ff115e' };
        if (key.includes('bed')) return { size: [2.0, 0.55, 1.6], color: '#f4f4f5' };
        if (key.includes('pc')) return { size: [0.4, 0.85, 0.6], color: '#111827', emissive: '#0082ff' };
        return { size: [1.0, 0.7, 1.0], color: '#a1a1aa' };
    }

    private clear(): void {
        for (const item of this.items) {
            this.group.remove(item);
            // traverse and dispose
        }
        this.items = [];
    }

    destroy(): void {
        this.clear();
    }
}
