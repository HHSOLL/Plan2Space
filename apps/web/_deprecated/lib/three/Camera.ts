/**
 * Camera - Camera management with multiple modes (orbit/walk)
 * Based on my-room-in-3d pattern
 */
import * as THREE from 'three';
import type Experience from './Experience';

export interface CameraMode {
    instance: THREE.PerspectiveCamera;
}

export interface CameraModes {
    default: CameraMode;
    // Can add more modes like 'walk', 'debug', etc.
}

export default class Camera {
    private experience: Experience;
    modes: CameraModes;

    constructor(experience: Experience) {
        this.experience = experience;

        this.modes = {
            default: {
                instance: this.createDefaultCamera(),
            },
        };
    }

    private createDefaultCamera(): THREE.PerspectiveCamera {
        const { width, height } = this.experience.sizes;
        const camera = new THREE.PerspectiveCamera(
            35,
            width / Math.max(height, 1),
            0.1,
            150
        );
        camera.rotation.order = 'YXZ';
        return camera;
    }

    get instance(): THREE.PerspectiveCamera {
        return this.modes.default.instance;
    }

    resize(): void {
        const { width, height } = this.experience.sizes;
        this.modes.default.instance.aspect = width / Math.max(height, 1);
        this.modes.default.instance.updateProjectionMatrix();
    }

    update(): void {
        // Camera updates are handled by Navigation
    }

    destroy(): void {
        // Cleanup if needed
    }
}
