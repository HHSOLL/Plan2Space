import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type Experience from '../Experience';
import { EventEmitter } from '../utils';

export default class FirstPersonController extends EventEmitter {
    private experience: Experience;
    controls: PointerLockControls;

    moveForward: boolean = false;
    moveBackward: boolean = false;
    moveLeft: boolean = false;
    moveRight: boolean = false;

    velocity: THREE.Vector3 = new THREE.Vector3();
    direction: THREE.Vector3 = new THREE.Vector3();

    enabled: boolean = false;
    speed: number = 8.0;

    constructor(experience: Experience) {
        super();
        this.experience = experience;

        this.controls = new PointerLockControls(
            this.experience.camera.instance,
            this.experience.renderer.instance.domElement
        );

        this.controls.addEventListener('lock', () => {
            this.enabled = true;
            this.emit('lock');
        });

        this.controls.addEventListener('unlock', () => {
            this.enabled = false;
            this.emit('unlock');
        });

        // Key Events
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
    }

    private onKeyDown = (event: KeyboardEvent) => {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = true;
                break;
        }
    };

    private onKeyUp = (event: KeyboardEvent) => {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = false;
                break;
        }
    };

    enable(): boolean {
        const dom = this.controls.domElement as HTMLElement | null;
        if (!dom || !dom.isConnected) {
            console.warn("PointerLock skipped: target element not in DOM");
            return false;
        }
        try {
            this.controls.lock();
            return true;
        } catch (err) {
            console.warn("PointerLock failed", err);
            return false;
        }
    }

    disable(): void {
        this.controls.unlock();
        this.enabled = false;
    }

    update(dt: number): void {
        if (!this.controls.isLocked) return;

        // Friction
        const damping = Math.exp(-3 * dt) - 1; // Simple damping?
        // Better friction logic: velocity *= 0.9?
        // Using frame independent friction:
        // velocity.x -= velocity.x * 10.0 * dt;
        // velocity.z -= velocity.z * 10.0 * dt;

        if (this.enabled) {
            this.velocity.x -= this.velocity.x * 10.0 * dt;
            this.velocity.z -= this.velocity.z * 10.0 * dt;

            this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
            this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
            this.direction.normalize(); // this ensures consistent movements in all directions

            if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * this.speed * 100.0 * dt; // accelerating
            if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * this.speed * 100.0 * dt;

            this.controls.moveRight(-this.velocity.x * dt);
            this.controls.moveForward(-this.velocity.z * dt);
        }
    }

    destroy(): void {
        this.controls.dispose();
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
    }
}
