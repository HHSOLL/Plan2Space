import * as THREE from 'three';
import type Experience from './Experience';
import { EventEmitter } from './utils';
import FirstPersonController from './controls/FirstPersonController';

export default class Navigation extends EventEmitter {
    experience: Experience;
    targetElement: HTMLElement;
    time: any;
    camera: any;

    mode: 'orbit' | 'walk' = 'orbit';
    firstPersonController: FirstPersonController;
    enabled: boolean = true;

    // Orbit State
    view: {
        spherical: {
            value: THREE.Spherical;
            smoothed: THREE.Spherical;
            smoothing: number;
            limits: { radius: { min: number; max: number }; phi: { min: number; max: number }; theta: { min: number; max: number } };
        };
        target: {
            value: THREE.Vector3;
            smoothed: THREE.Vector3;
            smoothing: number;
            limits: { x: { min: number; max: number }; y: { min: number; max: number }; z: { min: number; max: number } };
        };
        drag: {
            delta: { x: number; y: number };
            previous: { x: number; y: number };
            sensitivity: number;
            alternative: boolean; // panning
        };
        zoom: {
            sensitivity: number;
            delta: number;
        };
    };

    // Events
    private onPointerDownHandler: (e: PointerEvent) => void;
    private onPointerMoveHandler: (e: PointerEvent) => void;
    private onPointerUpHandler: (e: PointerEvent) => void;
    private onWheelHandler: (e: WheelEvent) => void;

    private isDragging: boolean = false;

    constructor(experience: Experience) {
        super();

        this.experience = experience;
        this.targetElement = this.experience.targetElement;
        this.time = this.experience.time;
        this.camera = this.experience.camera;

        // Init Orbit State
        this.view = {
            spherical: {
                value: new THREE.Spherical(15, Math.PI * 0.35, Math.PI * 0.25),
                smoothed: new THREE.Spherical(15, Math.PI * 0.35, Math.PI * 0.25),
                smoothing: 10, // Damping factor (using simpler lerp logic usually, or damp)
                limits: { radius: { min: 2, max: 50 }, phi: { min: 0.01, max: Math.PI * 0.5 }, theta: { min: -Infinity, max: Infinity } }
            },
            target: {
                value: new THREE.Vector3(0, 2, 0),
                smoothed: new THREE.Vector3(0, 2, 0),
                smoothing: 10,
                limits: { x: { min: -50, max: 50 }, y: { min: 0, max: 10 }, z: { min: -50, max: 50 } }
            },
            drag: {
                delta: { x: 0, y: 0 },
                previous: { x: 0, y: 0 },
                sensitivity: 1,
                alternative: false
            },
            zoom: {
                sensitivity: 0.01,
                delta: 0
            }
        };

        // Init Walk Controller
        this.firstPersonController = new FirstPersonController(this.experience);

        // Bind Handlers
        this.onPointerDownHandler = this.handlePointerDown.bind(this);
        this.onPointerMoveHandler = this.handlePointerMove.bind(this);
        this.onPointerUpHandler = this.handlePointerUp.bind(this);
        this.onWheelHandler = this.handleWheel.bind(this);

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.targetElement.addEventListener('pointerdown', this.onPointerDownHandler);
        this.targetElement.addEventListener('pointermove', this.onPointerMoveHandler);
        this.targetElement.addEventListener('pointerup', this.onPointerUpHandler);
        // this.targetElement.addEventListener('pointerleave', this.onPointerUpHandler); // Optional
        this.targetElement.addEventListener('wheel', this.onWheelHandler, { passive: false });
        this.targetElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    setMode(mode: 'orbit' | 'walk'): void {
        this.mode = mode;
        if (mode === 'walk') {
            const locked = this.firstPersonController.enable();
            if (!locked) {
                this.mode = 'orbit';
                return;
            }

            // 1. Find Entry Point
            // Priorities: Room named 'entry'/'현관' center -> First Door -> Origin
            let startPos = new THREE.Vector3(0, 1.6, 0); // Default 1.6m height
            const apartment = this.experience.world.apartment;

            // Check rooms
            const entryRoom = apartment?.designDoc?.plan2d.rooms.find(r =>
                r.name.toLowerCase().includes('entry') || r.name.includes('현관')
            );

            if (entryRoom && entryRoom.polygon.length > 0) {
                let x = 0, z = 0;
                entryRoom.polygon.forEach(p => { x += p.x; z += p.y; });
                startPos.set(x / entryRoom.polygon.length, 1.6, z / entryRoom.polygon.length);
            } else {
                // Check doors if no room
                const entryDoor = apartment?.designDoc?.plan2d.openings.find(o => o.type === 'door');
                if (entryDoor) {
                    // We need actual 3D position. simplified approach:
                    // Look at first door mesh position if available, or just plan params
                    // let's use default for now if room not found to avoid complexity
                }
            }

            // Set Camera
            this.camera.instance.position.copy(startPos);
            // Look forward (defaults to -Z usually)

        } else {
            this.firstPersonController.disable();
            // Reset camera roll and update
            this.camera.instance.rotation.z = 0;

            // Sync Orbit Spherical to current Camera Position?
            const camPos = this.camera.instance.position.clone();
            const target = this.view.target.value;
            const offset = camPos.sub(target);
            this.view.spherical.value.setFromVector3(offset);
            this.view.spherical.smoothed.copy(this.view.spherical.value);
        }
    }

    // -- Orbit Logic --

    private handlePointerDown(e: PointerEvent): void {
        if (!this.enabled) return;

        // Walk Mode Interaction (Click to Open)
        if (this.mode === 'walk') {
            if (document.pointerLockElement !== this.targetElement) {
                // If not locked, maybe allow locking? handled by FPC usually.
                // But user says "mouse to open door". 
                // PointerLock consumes clicks.
                // We need to check if FPC is locked.
                // Actually FPC handles lock on click usually.
                // If we want interact, we might listen to 'mousedown' inside FPC or here.

                // If locked, we use center raycast.
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera.instance); // Center

                const doors = this.experience.world.apartment?.doors;
                if (doors) {
                    const intersects = raycaster.intersectObjects(doors.children, true);
                    if (intersects.length > 0) {
                        // Find door panel
                        const hit = intersects[0].object;
                        // Call apartment toggle
                        this.experience.world.apartment?.toggleDoor(hit);
                    }
                }
            }
            return;
        }

        if (this.mode !== 'orbit') return;

        this.view.drag.alternative = e.button === 2 || e.ctrlKey || e.metaKey;
        this.view.drag.previous.x = e.clientX;
        this.view.drag.previous.y = e.clientY;
        this.isDragging = true;
    }

    private handlePointerMove(e: PointerEvent): void {
        if (this.mode !== 'orbit' || !this.enabled || !this.isDragging) return;

        this.view.drag.delta.x = e.clientX - this.view.drag.previous.x;
        this.view.drag.delta.y = e.clientY - this.view.drag.previous.y;

        this.view.drag.previous.x = e.clientX;
        this.view.drag.previous.y = e.clientY;

        if (this.view.drag.alternative) {
            // Pan
            const sensitivity = 0.01;
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.instance.quaternion);
            forward.y = 0;
            forward.normalize();

            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.instance.quaternion);
            right.y = 0;
            right.normalize();

            this.view.target.value.addScaledVector(right, -this.view.drag.delta.x * sensitivity);
            this.view.target.value.addScaledVector(forward, this.view.drag.delta.y * sensitivity);
        } else {
            // Rotate
            const sensitivity = 0.005;
            this.view.spherical.value.theta -= this.view.drag.delta.x * sensitivity;
            this.view.spherical.value.phi -= this.view.drag.delta.y * sensitivity;
        }
    }

    private handlePointerUp(e: PointerEvent): void {
        this.isDragging = false;
    }

    private handleWheel(e: WheelEvent): void {
        if (this.mode !== 'orbit' || !this.enabled) return;
        e.preventDefault();

        const sensitivity = 0.001; // Pixels to Zoom units
        this.view.spherical.value.radius += e.deltaY * sensitivity * this.view.spherical.value.radius; // Logarithmic zoom feel
    }

    // External Helpers

    setTarget(target: THREE.Vector3, radius?: number): void {
        this.view.target.value.copy(target);
        this.view.target.smoothed.copy(target); // Instant snap or smooth? Instant for setup.

        if (radius) {
            this.view.spherical.value.radius = radius;
            this.view.spherical.smoothed.radius = radius;
        }
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    update(): void {
        if (!this.enabled) return;

        const dt = this.time.delta / 1000;

        if (this.mode === 'walk') {
            this.firstPersonController.update(dt);
        } else {
            // Update Orbit
            // Clamp
            this.view.spherical.value.phi = Math.max(this.view.spherical.limits.phi.min, Math.min(this.view.spherical.limits.phi.max, this.view.spherical.value.phi));
            this.view.spherical.value.radius = Math.max(this.view.spherical.limits.radius.min, Math.min(this.view.spherical.limits.radius.max, this.view.spherical.value.radius));

            // Smooth
            // Using damp: current = THREE.MathUtils.damp(current, target, lambda, dt)
            // lambda ~ 10-20
            const lambda = 10;

            this.view.spherical.smoothed.phi = THREE.MathUtils.damp(this.view.spherical.smoothed.phi, this.view.spherical.value.phi, lambda, dt);
            this.view.spherical.smoothed.theta = THREE.MathUtils.damp(this.view.spherical.smoothed.theta, this.view.spherical.value.theta, lambda, dt);
            this.view.spherical.smoothed.radius = THREE.MathUtils.damp(this.view.spherical.smoothed.radius, this.view.spherical.value.radius, lambda, dt);

            this.view.target.smoothed.x = THREE.MathUtils.damp(this.view.target.smoothed.x, this.view.target.value.x, lambda, dt);
            this.view.target.smoothed.y = THREE.MathUtils.damp(this.view.target.smoothed.y, this.view.target.value.y, lambda, dt);
            this.view.target.smoothed.z = THREE.MathUtils.damp(this.view.target.smoothed.z, this.view.target.value.z, lambda, dt);

            // Apply to Camera
            const viewPos = new THREE.Vector3();
            viewPos.setFromSpherical(this.view.spherical.smoothed);
            viewPos.add(this.view.target.smoothed);

            this.camera.instance.position.copy(viewPos);
            this.camera.instance.lookAt(this.view.target.smoothed);
        }
    }

    destroy(): void {
        this.targetElement.removeEventListener('pointerdown', this.onPointerDownHandler);
        this.targetElement.removeEventListener('pointermove', this.onPointerMoveHandler);
        this.targetElement.removeEventListener('pointerup', this.onPointerUpHandler);
        this.targetElement.removeEventListener('wheel', this.onWheelHandler);

        this.firstPersonController.destroy();
    }
}
