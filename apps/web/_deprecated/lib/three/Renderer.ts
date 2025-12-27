/**
 * Renderer - WebGPU/WebGL renderer with automatic fallback
 * Based on my-room-in-3d pattern with WebGPU enhancement
 * Enhanced with adaptive pixel ratio and quality settings
 */
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import type Experience from './Experience';
import type { QualityLevel } from './utils/Performance';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

export type RendererBackend = 'webgpu' | 'webgl';

export default class Renderer {
    private experience: Experience;
    instance: THREE.WebGLRenderer | WebGPURenderer;
    backend: RendererBackend = 'webgl';
    private clearColor: string = '#0b0b0f';
    private isInitialized: boolean = false;
    private composer: EffectComposer | null = null;
    private renderPass: RenderPass | null = null;
    private bloomPass: UnrealBloomPass | null = null;
    private ssaoPass: SSAOPass | null = null;
    private fxaaPass: ShaderPass | null = null;

    // Adaptive quality settings
    private isMobile: boolean = false;
    private isLowPowerMode: boolean = false;
    private currentQuality: QualityLevel = 'high';

    constructor(experience: Experience) {
        this.experience = experience;
        this.detectDeviceCapabilities();
        // Start with WebGL, then try to upgrade to WebGPU
        this.instance = this.createWebGLRenderer();
    }

    /**
     * Detect device capabilities for adaptive rendering
     */
    private detectDeviceCapabilities(): void {
        // Detect mobile devices
        if (typeof navigator !== 'undefined') {
            this.isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            // Detect low power mode (Battery API if available)
            if ('getBattery' in navigator) {
                (navigator as any).getBattery().then((battery: any) => {
                    this.isLowPowerMode = battery.charging === false && battery.level < 0.2;
                    // Update pixel ratio if low power
                    if (this.isLowPowerMode && this.isInitialized) {
                        this.updatePixelRatio();
                    }
                    // Listen for battery changes
                    battery.addEventListener('chargingchange', () => {
                        this.isLowPowerMode = battery.charging === false && battery.level < 0.2;
                        this.updatePixelRatio();
                    });
                }).catch(() => {
                    // Battery API not supported or denied
                });
            }
        }
    }

    /**
     * Get adaptive pixel ratio based on device capabilities and quality setting
     */
    getAdaptivePixelRatio(): number {
        const baseRatio = window.devicePixelRatio || 1;

        // Low power mode: always use minimum pixel ratio
        if (this.isLowPowerMode) return 1;

        // Quality-based pixel ratio
        switch (this.currentQuality) {
            case 'low':
                return 1;
            case 'medium':
                return Math.min(1.5, baseRatio);
            case 'high':
            default:
                return Math.min(this.isMobile ? 1.5 : 2, baseRatio);
        }
    }

    /**
     * Set quality level and update renderer settings
     */
    setQuality(level: QualityLevel): void {
        this.currentQuality = level;
        this.updatePixelRatio();
        this.updateShadowQuality();
        this.updatePostProcessingQuality();
    }

    /**
     * Get current quality level
     */
    getQuality(): QualityLevel {
        return this.currentQuality;
    }

    /**
     * Update pixel ratio based on current settings
     */
    private updatePixelRatio(): void {
        if (!this.instance) return;
        const pixelRatio = this.getAdaptivePixelRatio();
        this.instance.setPixelRatio(pixelRatio);
    }

    /**
     * Update shadow map quality based on current settings
     */
    private updateShadowQuality(): void {
        if (!(this.instance instanceof THREE.WebGLRenderer)) return;

        const renderer = this.instance;
        switch (this.currentQuality) {
            case 'low':
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.BasicShadowMap;
                break;
            case 'medium':
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFShadowMap;
                break;
            case 'high':
            default:
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.VSMShadowMap; // Highest quality soft shadows
                break;
        }
    }

    private createWebGLRenderer(): THREE.WebGLRenderer {
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
        });
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.configureRenderer(renderer);
        return renderer;
    }

    private createWebGPURenderer(): WebGPURenderer {
        const renderer = new WebGPURenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
        } as any);

        this.configureRenderer(renderer);
        return renderer;
    }

    private configureRenderer(renderer: THREE.WebGLRenderer | WebGPURenderer): void {
        const { width, height } = this.experience.sizes;
        const pixelRatio = this.getAdaptivePixelRatio();

        renderer.setClearColor(new THREE.Color(this.clearColor), 1);
        renderer.setSize(width, height);
        renderer.setPixelRatio(pixelRatio);

        if (renderer instanceof THREE.WebGLRenderer) {
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.15;
            this.setupComposer(renderer);
        }
    }

    /**
     * Initialize renderer - try WebGPU first, fallback to WebGL
     */
    async init(): Promise<RendererBackend> {
        if (this.isInitialized) return this.backend;

        const supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

        if (supportsWebGPU) {
            try {
                const adapter = await (navigator as any).gpu?.requestAdapter();
                if (adapter) {
                    // Dispose current WebGL renderer safely
                    if (this.instance && typeof this.instance.dispose === 'function') {
                        this.instance.dispose();
                    }

                    // Create and init WebGPU renderer
                    this.instance = this.createWebGPURenderer();
                    await (this.instance as WebGPURenderer).init();

                    this.backend = 'webgpu';
                    console.log('[Renderer] Using WebGPU backend');
                    // Post-processing composer is WebGL only; disable if switched
                    this.composer = null;
                    this.renderPass = null;
                    this.bloomPass = null;
                }
            } catch (error) {
                console.warn('[Renderer] WebGPU initialization failed, using WebGL:', error);
                this.backend = 'webgl';
            }
        } else {
            console.log('[Renderer] WebGPU not supported, using WebGL');
            this.backend = 'webgl';
        }

        this.isInitialized = true;
        this.resize();
        return this.backend;
    }

    private setupComposer(renderer: THREE.WebGLRenderer): void {
        const { width, height } = this.experience.sizes;
        this.composer = new EffectComposer(renderer);
        this.renderPass = new RenderPass(this.experience.scene, this.experience.camera.instance);
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.7, 0.88);
        this.ssaoPass = new SSAOPass(this.experience.scene, this.experience.camera.instance, width, height);
        this.fxaaPass = new ShaderPass(FXAAShader);

        this.composer.addPass(this.renderPass);
        if (this.ssaoPass) {
            this.ssaoPass.kernelRadius = 8;
            this.ssaoPass.minDistance = 0.005;
            this.ssaoPass.maxDistance = 0.2;
            this.composer.addPass(this.ssaoPass);
        }
        this.composer.addPass(this.bloomPass);
        if (this.fxaaPass) {
            const pixelRatio = this.getAdaptivePixelRatio();
            this.fxaaPass.material.uniforms['resolution'].value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
            this.composer.addPass(this.fxaaPass);
        }
        this.composer.setSize(width, height);
        this.composer.setPixelRatio(this.getAdaptivePixelRatio());

        this.updatePostProcessingQuality();
    }

    private updatePostProcessingQuality(): void {
        if (!this.bloomPass) return;
        const mobileFactor = this.isMobile ? 0.7 : 1;
        switch (this.currentQuality) {
            case 'low':
                this.bloomPass.strength = 0.12 * mobileFactor;
                this.bloomPass.radius = 0.4;
                this.bloomPass.threshold = 0.9;
                if (this.ssaoPass) {
                    this.ssaoPass.kernelRadius = 4;
                    this.ssaoPass.minDistance = 0.01;
                    this.ssaoPass.maxDistance = 0.12;
                }
                break;
            case 'medium':
                this.bloomPass.strength = 0.25 * mobileFactor;
                this.bloomPass.radius = 0.6;
                this.bloomPass.threshold = 0.88;
                if (this.ssaoPass) {
                    this.ssaoPass.kernelRadius = 8;
                    this.ssaoPass.minDistance = 0.008;
                    this.ssaoPass.maxDistance = 0.18;
                }
                break;
            case 'high':
            default:
                this.bloomPass.strength = 0.45 * mobileFactor;
                this.bloomPass.radius = 0.85;
                this.bloomPass.threshold = 0.86;
                if (this.ssaoPass) {
                    this.ssaoPass.kernelRadius = 12;
                    this.ssaoPass.minDistance = 0.005;
                    this.ssaoPass.maxDistance = 0.25;
                }
                break;
        }
    }

    resize(): void {
        const { width, height } = this.experience.sizes;
        const pixelRatio = this.getAdaptivePixelRatio();
        this.instance.setSize(width, height);
        this.instance.setPixelRatio(pixelRatio);
        if (this.composer) {
            this.composer.setSize(width, height);
            this.composer.setPixelRatio(pixelRatio);
        }
        if (this.fxaaPass) {
            this.fxaaPass.material.uniforms['resolution'].value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
        }
        if (this.ssaoPass) {
            this.ssaoPass.setSize(width, height);
        }
    }

    update(): void {
        if (!this.isInitialized || !this.instance) return;

        // Safety check for scene graph existence
        if (!this.experience.scene || !this.experience.camera?.instance) return;

        if (this.backend === 'webgpu') {
            try {
                (this.instance as WebGPURenderer).renderAsync(this.experience.scene, this.experience.camera.instance);
            } catch (error) {
                console.error('[Renderer] WebGPU Render Error:', error);
                // Fallback to WebGL if WebGPU fails during runtime
                this.backend = 'webgl';
            }
        } else {
            if (this.composer) {
                this.composer.render();
            } else {
                this.instance.render(this.experience.scene, this.experience.camera.instance);
            }
        }
    }

    destroy(): void {
        try {
            if (this.backend === 'webgpu') {
                const gpuRenderer = this.instance as any;
                const backend = gpuRenderer.backend ?? gpuRenderer._backend;
                if (backend && typeof backend.dispose === 'function') {
                    backend.dispose();
                }
            } else if (this.instance && typeof this.instance.dispose === 'function') {
                this.instance.dispose();
            }
        } catch (error) {
            console.warn('[Renderer] Error during disposal:', error);
        }
    }
}
