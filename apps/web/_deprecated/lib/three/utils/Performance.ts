/**
 * Performance - FPS monitor and adaptive quality controller
 * Enhanced with memory tracking and adaptive recommendations
 */
import EventEmitter from './EventEmitter';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface PerformanceConfig {
    targetFPS?: number;
    autoAdjust?: boolean;
    onQualityChange?: (level: QualityLevel) => void;
}

export interface PerformanceStats {
    fps: number;
    quality: QualityLevel;
    memoryMB: number;
    frameTime: number;
}

export default class Performance extends EventEmitter {
    private frames: number[] = [];
    private lastTime: number = 0;
    private fps: number = 60;
    private quality: QualityLevel = 'high';
    private targetFPS: number;
    private autoAdjust: boolean;
    private adjustCooldown: number = 0;
    private onQualityChange?: (level: QualityLevel) => void;

    // Memory tracking
    private memoryUsage: number = 0;
    private lastMemoryCheck: number = 0;
    private frameTime: number = 16.67; // ms per frame (60fps default)

    constructor(config: PerformanceConfig = {}) {
        super();
        this.targetFPS = config.targetFPS ?? 30;
        this.autoAdjust = config.autoAdjust ?? true;
        this.onQualityChange = config.onQualityChange;
        this.lastTime = performance.now();
    }

    /**
     * Call each frame to track FPS
     */
    tick(): void {
        const now = performance.now();
        const delta = now - this.lastTime;
        this.lastTime = now;
        this.frameTime = delta;

        // Track last 60 frames
        this.frames.push(delta);
        if (this.frames.length > 60) {
            this.frames.shift();
        }

        // Calculate average FPS
        const avgDelta = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
        this.fps = Math.round(1000 / avgDelta);

        // Auto-adjust quality
        if (this.autoAdjust) {
            this.adjustCooldown--;
            if (this.adjustCooldown <= 0) {
                this.maybeAdjustQuality();
            }
        }

        // Periodic memory check
        this.updateMemoryUsage();
    }

    /**
     * Update memory usage (checked every 5 seconds)
     */
    private updateMemoryUsage(): void {
        const now = performance.now();
        if (now - this.lastMemoryCheck < 5000) return;

        this.lastMemoryCheck = now;

        // Chrome-specific memory API
        if (typeof performance !== 'undefined' && (performance as any).memory) {
            const mem = (performance as any).memory;
            this.memoryUsage = Math.round(mem.usedJSHeapSize / 1024 / 1024);
        }
    }

    private maybeAdjustQuality(): void {
        const prevQuality = this.quality;

        if (this.fps < this.targetFPS - 5) {
            // FPS too low, reduce quality
            if (this.quality === 'high') {
                this.quality = 'medium';
            } else if (this.quality === 'medium') {
                this.quality = 'low';
            }
        } else if (this.fps > this.targetFPS + 15) {
            // FPS high enough, try increasing quality
            if (this.quality === 'low') {
                this.quality = 'medium';
            } else if (this.quality === 'medium') {
                this.quality = 'high';
            }
        }

        if (prevQuality !== this.quality) {
            this.adjustCooldown = 120; // Wait 2 seconds before next adjustment
            this.emit('qualityChange', this.quality);
            this.onQualityChange?.(this.quality);
        }
    }

    getFPS(): number {
        return this.fps;
    }

    getFrameTime(): number {
        return this.frameTime;
    }

    getQuality(): QualityLevel {
        return this.quality;
    }

    getMemoryUsage(): number {
        return this.memoryUsage;
    }

    /**
     * Get comprehensive performance stats
     */
    getStats(): PerformanceStats {
        return {
            fps: this.fps,
            quality: this.quality,
            memoryMB: this.memoryUsage,
            frameTime: Math.round(this.frameTime * 100) / 100
        };
    }

    setQuality(level: QualityLevel): void {
        if (this.quality !== level) {
            this.quality = level;
            this.emit('qualityChange', this.quality);
            this.onQualityChange?.(this.quality);
        }
    }

    setAutoAdjust(enabled: boolean): void {
        this.autoAdjust = enabled;
    }

    /**
     * Get recommended settings based on quality level
     */
    getSettings(): { pixelRatio: number; shadowMapSize: number; antialias: boolean } {
        switch (this.quality) {
            case 'low':
                return { pixelRatio: 1, shadowMapSize: 512, antialias: false };
            case 'medium':
                return { pixelRatio: Math.min(1.5, window.devicePixelRatio), shadowMapSize: 1024, antialias: true };
            case 'high':
            default:
                return { pixelRatio: Math.min(2, window.devicePixelRatio), shadowMapSize: 2048, antialias: true };
        }
    }

    destroy(): void {
        this.frames = [];
        this.onQualityChange = undefined;
    }
}

