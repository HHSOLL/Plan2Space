/**
 * Sizes - Viewport size management with resize events
 * Based on my-room-in-3d pattern
 */
import EventEmitter from './EventEmitter';

export interface SizesConfig {
    width: number;
    height: number;
    pixelRatio: number;
    smallestSide: number;
    largestSide: number;
}

export default class Sizes extends EventEmitter {
    width: number = 0;
    height: number = 0;
    pixelRatio: number = 1;
    smallestSide: number = 0;
    largestSide: number = 0;

    private targetElement: HTMLElement | null = null;
    private resizeObserver: ResizeObserver | null = null;

    constructor(targetElement?: HTMLElement) {
        super();

        if (targetElement) {
            this.setTargetElement(targetElement);
        }
    }

    setTargetElement(element: HTMLElement): void {
        this.targetElement = element;
        this.update();

        // Use ResizeObserver for better performance
        this.resizeObserver = new ResizeObserver(() => {
            this.update();
        });
        this.resizeObserver.observe(element);
    }

    private update(): void {
        if (!this.targetElement) return;

        const rect = this.targetElement.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height || window.innerHeight;
        this.pixelRatio = Math.min(Math.max(window.devicePixelRatio, 1), 2);
        this.smallestSide = Math.min(this.width, this.height);
        this.largestSide = Math.max(this.width, this.height);

        this.emit('resize');
    }

    getConfig(): SizesConfig {
        return {
            width: this.width,
            height: this.height,
            pixelRatio: this.pixelRatio,
            smallestSide: this.smallestSide,
            largestSide: this.largestSide,
        };
    }

    destroy(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        super.destroy();
    }
}
