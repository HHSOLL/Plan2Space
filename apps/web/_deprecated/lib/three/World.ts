import * as THREE from 'three';
import type Experience from './Experience';
import { EventEmitter } from './utils';
import type { DesignDoc } from '@webinterior/shared/types';
import Apartment from './world/Apartment';
import Environment, { type MoodConfig } from './world/Environment';
import Furniture from './world/Furniture';

export default class World extends EventEmitter {
  private experience: Experience;
  private scene: THREE.Scene;
  private resources: any;

  apartment?: Apartment;
  environment?: Environment;
  furniture?: Furniture;

  constructor(experience: Experience) {
    super();
    this.experience = experience;
    this.scene = this.experience.scene;
    this.resources = this.experience.resources;

    // Initialize systems
    this.environment = new Environment(this.experience);
    this.furniture = new Furniture(this.experience);
    this.scene.add(this.furniture.group);

    // Wait for resources if needed, though we generate procedurally for now
    this.resources.on('ready', () => {
      this.emit('ready');
    });
  }

  loadDesignDoc(doc: DesignDoc): void {
    if (this.apartment) {
      this.apartment.destroy();
      this.scene.remove(this.apartment.group);
    }

    this.apartment = new Apartment({ designDoc: doc });
    this.scene.add(this.apartment.group);

    // Update Furniture
    this.furniture?.updateFromDoc(doc);

    // Calculate bounds for camera and environment
    const box = new THREE.Box3().setFromObject(this.apartment.group);

    // Include furniture in bounds?
    // Optionally expand box with furniture group
    // const furnBox = new THREE.Box3().setFromObject(this.furniture.group);
    // box.union(furnBox);

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const bounds = {
      width: size.x,
      height: size.z, // Y is up in 3D, but Z in plan coordinates often maps to depth
      maxX: box.max.x,
      maxY: box.max.z
    };

    // Update Environment
    this.environment?.setDesignDoc(doc, bounds);

    // Reset Camera target
    this.experience.navigation.setTarget(center, Math.max(size.x, size.z, 1));
  }

  updateMood(config: MoodConfig): void {
    this.environment?.update(config);
  }

  update(): void {
    const dt = this.experience.time.delta / 1000;
    this.apartment?.update(dt);
  }

  destroy(): void {
    this.apartment?.destroy();
    if (this.apartment) this.scene.remove(this.apartment.group);

    this.furniture?.destroy();
    if (this.furniture) this.scene.remove(this.furniture.group);

    this.environment?.destroy();

    super.destroy();
  }
}
