/**
 * Resources - Asset loading manager for GLB models, textures, etc.
 * Based on my-room-in-3d pattern with modern loaders
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { EventEmitter } from './utils';
import type { WebGPURenderer } from 'three/webgpu';

export interface AssetItem {
    name: string;
    source: string;
    type?: 'model' | 'texture' | 'cubeTexture';
}

export interface AssetGroup {
    name: string;
    items: AssetItem[];
}

export interface LoadedAssets {
    [key: string]: THREE.Texture | GLTF | THREE.CubeTexture;
}

export default class Resources extends EventEmitter {
    items: LoadedAssets = {};
    private toLoad: number = 0;
    private loaded: number = 0;
    private gltfLoader: GLTFLoader;
    private textureLoader: THREE.TextureLoader;
    private cubeTextureLoader: THREE.CubeTextureLoader;

    constructor(assetGroups: AssetGroup[], renderer: THREE.WebGLRenderer | WebGPURenderer) {
        super();

        // Setup Draco
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/');

        // Setup KTX2
        const ktx2Loader = new KTX2Loader();
        ktx2Loader.setTranscoderPath('/basis/');
        ktx2Loader.detectSupport(renderer);

        // Setup GLTF loader with Draco, KTX2, and Meshopt
        this.gltfLoader = new GLTFLoader();
        this.gltfLoader.setDRACOLoader(dracoLoader);
        this.gltfLoader.setKTX2Loader(ktx2Loader);
        this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);

        // Setup texture loaders
        this.textureLoader = new THREE.TextureLoader();
        this.cubeTextureLoader = new THREE.CubeTextureLoader();

        // Start loading
        this.startLoading(assetGroups);
    }

    private startLoading(assetGroups: AssetGroup[]): void {
        for (const group of assetGroups) {
            this.toLoad += group.items.length;

            for (const item of group.items) {
                this.loadItem(item, group.name);
            }
        }

        if (this.toLoad === 0) {
            // No assets to load
            setTimeout(() => this.emit('ready'), 0);
        }
    }

    private loadItem(item: AssetItem, groupName: string): void {
        const type = item.type || this.inferType(item.source);

        switch (type) {
            case 'model':
                this.gltfLoader.load(
                    item.source,
                    (gltf) => this.onItemLoaded(item.name, gltf, groupName),
                    undefined,
                    (error) => this.onItemError(item.name, error)
                );
                break;

            case 'texture':
                this.textureLoader.load(
                    item.source,
                    (texture) => this.onItemLoaded(item.name, texture, groupName),
                    undefined,
                    (error) => this.onItemError(item.name, error)
                );
                break;

            case 'cubeTexture':
                // For cube textures, source should be an array-like path pattern
                // This is a simplified version
                console.warn('[Resources] CubeTexture loading not fully implemented');
                this.loaded++;
                this.checkComplete(groupName);
                break;

            default:
                console.warn(`[Resources] Unknown asset type for: ${item.name}`);
                this.loaded++;
                this.checkComplete(groupName);
        }
    }

    private inferType(source: string): 'model' | 'texture' | 'cubeTexture' {
        const ext = source.split('.').pop()?.toLowerCase();

        if (ext === 'glb' || ext === 'gltf') return 'model';
        if (['jpg', 'jpeg', 'png', 'webp', 'ktx2'].includes(ext || '')) return 'texture';

        return 'texture'; // Default
    }

    private onItemLoaded(name: string, resource: THREE.Texture | GLTF, groupName: string): void {
        this.items[name] = resource;
        this.loaded++;

        this.emit('itemLoaded', { name, resource });
        this.checkComplete(groupName);
    }

    private onItemError(name: string, error: unknown): void {
        console.error(`[Resources] Failed to load: ${name}`, error);
        this.loaded++;
        this.emit('itemError', { name, error });
    }

    private checkComplete(groupName: string): void {
        if (this.loaded === this.toLoad) {
            this.emit('groupEnd', { name: groupName });
            this.emit('ready');
        }
    }

    /**
     * Get loading progress (0-1)
     */
    get progress(): number {
        if (this.toLoad === 0) return 1;
        return this.loaded / this.toLoad;
    }

    destroy(): void {
        // Dispose textures
        for (const key in this.items) {
            const item = this.items[key];
            if (item instanceof THREE.Texture) {
                item.dispose();
            }
        }
        this.items = {};
        super.destroy();
    }
}
