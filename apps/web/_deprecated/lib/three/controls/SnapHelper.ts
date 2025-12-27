import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type Apartment from '../world/Apartment';

export default class SnapHelper {
    controls: TransformControls;
    apartment?: Apartment;

    gridSize: number | null = 0.1; // 10cm default
    wallSnapDistance: number = 0.2; // 20cm snap range

    constructor(controls: TransformControls, apartment?: Apartment) {
        this.controls = controls;
        this.apartment = apartment;

        // Grid Snap
        if (this.gridSize) {
            this.controls.translationSnap = this.gridSize;
            this.controls.rotationSnap = THREE.MathUtils.degToRad(15); // 15 deg
        }

        // Wall Snap listener could go here if we implemented custom wall snap logic
        // But modifying object position during TransformControls drag is tricky.
        // TransformControls usually overrides it.
        // Strategy: We can't easily override TransformControls position unless we use a custom handle or post-process.
        // For now, grid snap is built-in.
    }

    setApartment(apartment: Apartment): void {
        this.apartment = apartment;
    }

    toggleGrid(enabled: boolean): void {
        this.controls.translationSnap = enabled ? (this.gridSize ?? 0.1) : null;
        this.controls.rotationSnap = enabled ? THREE.MathUtils.degToRad(15) : null;
    }
}
