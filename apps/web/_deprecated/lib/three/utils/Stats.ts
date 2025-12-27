/**
 * Stats - Performance monitoring with optional stats.js integration
 * Based on my-room-in-3d pattern
 */
import type { WebGLRenderer } from 'three';

export default class Stats {
    private active: boolean;
    private container: HTMLElement | null = null;
    private fpsPanel: HTMLElement | null = null;
    private lastTime: number = performance.now();
    private frameCount: number = 0;
    private fps: number = 0;

    constructor(active: boolean = false) {
        this.active = active;

        if (this.active) {
            this.createPanel();
        }
    }

    private createPanel(): void {
        this.container = document.createElement('div');
        this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      z-index: 9999;
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.8);
      color: #0f0;
      font-family: monospace;
      font-size: 12px;
      pointer-events: none;
    `;

        this.fpsPanel = document.createElement('div');
        this.container.appendChild(this.fpsPanel);
        document.body.appendChild(this.container);
    }

    setRenderPanel(_context: WebGLRenderingContext | WebGL2RenderingContext): void {
        // Optional: Add WebGL stats if needed
    }

    beforeRender(): void {
        // Placeholder for render timing
    }

    afterRender(): void {
        // Placeholder for render timing
    }

    update(): void {
        if (!this.active) return;

        this.frameCount++;
        const now = performance.now();

        if (now - this.lastTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
            this.frameCount = 0;
            this.lastTime = now;

            if (this.fpsPanel) {
                this.fpsPanel.textContent = `${this.fps} FPS`;
            }
        }
    }

    destroy(): void {
        if (this.container && this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        this.container = null;
        this.fpsPanel = null;
    }
}
