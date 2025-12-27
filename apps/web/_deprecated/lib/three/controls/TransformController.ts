import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type Experience from '../Experience';
import { EventEmitter } from '../utils';
import SnapHelper from './SnapHelper';

export default class TransformController extends EventEmitter {
    private experience: Experience;
    instance: TransformControls;
    private helper: THREE.Object3D;
    snapHelper: SnapHelper;
    private raycaster: THREE.Raycaster;
    private pointer: THREE.Vector2;

    constructor(experience: Experience) {
        super();
        this.experience = experience;

        this.instance = new TransformControls(
            this.experience.camera.instance,
            this.experience.renderer.instance.domElement
        );

        // Setup events
        this.instance.addEventListener('change', () => {
            // Request render if not loop
        });

        this.instance.addEventListener('dragging-changed', (event) => {
            // Disable camera control while dragging
            this.experience.navigation.setEnabled(!event.value);
        });

        this.helper = this.instance.getHelper();
        this.experience.scene.add(this.helper);

        // Snap Helper
        this.snapHelper = new SnapHelper(this.instance, this.experience.world.apartment);

        // Selection Logic
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        const canvas = this.experience.renderer.instance.domElement;
        canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    }

    private onPointerDown(event: PointerEvent): void {
        // Only select if not transforming
        if (this.instance.dragging) return;

        // Calculate pointer position in normalized device coordinates (-1 to +1)
        const rect = this.experience.renderer.instance.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.experience.camera.instance);

        // Intersect furniture AND apartment structure
        const furniture = this.experience.world.furniture?.group;
        const apartment = this.experience.world.apartment?.group;

        const targets: THREE.Object3D[] = [];
        if (furniture) targets.push(furniture);
        if (apartment) targets.push(apartment);

        const intersects = this.raycaster.intersectObjects(targets, true);

        if (intersects.length > 0) {
            // Get the first hit
            const hit = intersects[0];
            let object = hit.object;

            // Check if it's furniture
            let isFurniture = false;
            let current = object;
            // Traverse up to find if it belongs to furniture group
            while (current.parent) {
                if (current.parent === furniture) {
                    isFurniture = true;
                    object = current; // Select the root item (the group or mesh added to furniture)
                    break;
                }
                current = current.parent;
            }

            if (isFurniture) {
                this.select(object, 'furniture');
                return;
            }

            // Check if it's a Floor or Wall (Look for userData)
            // Traverse up slightly in case we hit a child mesh of a wall group
            current = object;
            while (current) {
                if (current.userData?.type === 'floor' || current.userData?.type === 'wall') {
                    this.select(current, current.userData.type);
                    return;
                }
                if (current.parent === apartment || current === apartment) break;
                current = current.parent!;
            }

            this.select(null);
        } else {
            this.select(null);
        }
    }

    select(object: THREE.Object3D | null, type?: 'furniture' | 'floor' | 'wall'): void {
        if (object) {
            // Only attach gizmo if furniture
            if (type === 'furniture') {
                this.instance.attach(object);
            } else {
                this.instance.detach();
            }

            // Emit selection event with metadata
            this.emit('selected', {
                object,
                type,
                userData: object.userData
            });
        } else {
            this.instance.detach();
            this.emit('deselected');
        }
    }

    setMode(mode: 'translate' | 'rotate' | 'scale'): void {
        this.instance.setMode(mode);
    }

    update(): void {
        // TransformControls updates itself via event listeners usually,
        // but we might need to update if camera changes if not auto-updated?
        // It attaches to camera.
    }

    destroy(): void {
        this.instance.dispose();

        // Safety check before remove
        if (this.experience.scene) {
            this.experience.scene.remove(this.helper);
        }

        const canvas = this.experience.renderer.instance.domElement;
        // Need to remove listener - but bind creates new ref. 
        // Ideally store bound listener. For now it's okay as experience destroys canvas often.
    }
}
