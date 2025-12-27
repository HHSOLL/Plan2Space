/**
 * Experience - Main entry point and singleton manager
 * Orchestrates Renderer, Camera, World, and Utils
 */
import * as THREE from 'three';
import { Sizes, Time, Stats, Performance, EventEmitter } from './utils';
import Camera from './Camera';
import Renderer from './Renderer';
import World from './World';
import Resources from './Resources';
import Navigation from './Navigation';
import { assets } from './assets';
import TransformController from './controls/TransformController';

export interface ExperienceConfig {
    targetElement: HTMLElement;
    debug?: boolean;
}

export default class Experience extends EventEmitter {
    static instance: Experience;

    targetElement!: HTMLElement;
    debug: boolean;

    // Modules
    sizes!: Sizes;
    time!: Time;
    stats!: Stats;
    performance!: Performance;
    scene!: THREE.Scene;
    resources!: Resources;
    camera!: Camera;
    renderer!: Renderer;
    world!: World;
    navigation!: Navigation;
    transformController!: TransformController;
    isInitialized: boolean = false;

    constructor(config?: ExperienceConfig) {
        super();

        if (Experience.instance) {
            if (config) {
                Experience.instance.destroy(); // Re-initialize if config provided
            } else {
                return Experience.instance;
            }
        }
        Experience.instance = this;

        // Config
        this.debug = config?.debug ?? false;
        if (config?.targetElement) {
            this.targetElement = config.targetElement;
        }

        // Setup
        this.sizes = new Sizes(this.targetElement);
        this.time = new Time();
        this.stats = new Stats(this.debug);
        this.performance = new Performance({
            autoAdjust: true,
            targetFPS: 60
        });
        this.scene = new THREE.Scene();

        this.camera = new Camera(this);
        this.renderer = new Renderer(this);

        // Performance Monitoring
        this.performance.on('qualityChange', (level: any) => {
            if (this.renderer) {
                this.renderer.setQuality(level);
            }
        });

        // Events
        this.sizes.on('resize', () => this.resize());
        this.time.on('tick', () => this.update());

        // Async Init
        this.init();
    }

    private async init(): Promise<void> {
        // 1. Init Renderer FIRST (Determines if we use WebGL or WebGPU)
        await this.renderer.init();

        // 2. Resources needs final renderer for KTX2 detection etc.
        this.resources = new Resources(assets, this.renderer.instance);
        this.resources.on('ready', () => {
            this.emit('ready');
        });

        // 3. World and Controls now use the CORRECT renderer backend
        this.world = new World(this);
        this.navigation = new Navigation(this);
        this.transformController = new TransformController(this);

        this.isInitialized = true;
        this.emit('initialized');
    }

    resize(): void {
        this.camera.resize();
        if (this.renderer) this.renderer.resize();
    }

    update(): void {
        this.stats.update();
        this.performance.tick();

        // Only update if initialized
        if (!this.world || !this.renderer) return;

        this.navigation.update();
        this.world.update();
        this.renderer.update();
    }

    destroy(): void {
        this.sizes?.destroy();
        this.time?.destroy();
        this.stats?.destroy();
        this.performance?.destroy();
        this.renderer?.destroy();
        this.world?.destroy();
        this.navigation?.destroy();
        this.transformController?.destroy();
        this.resources?.destroy();

        this.scene.clear();

        // Remove singleton reference
        // @ts-ignore
        Experience.instance = null;
    }
}
