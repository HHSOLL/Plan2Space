/**
 * Time - Delta time management for animation loops
 * Based on my-room-in-3d pattern
 */
import EventEmitter from './EventEmitter';

export default class Time extends EventEmitter {
    start: number;
    current: number;
    elapsed: number;
    delta: number;
    private animationFrameId: number | null = null;

    constructor() {
        super();

        this.start = Date.now();
        this.current = this.start;
        this.elapsed = 0;
        this.delta = 16; // Initial delta (60fps assumption)

        this.tick = this.tick.bind(this);
        this.tick();
    }

    private tick(): void {
        const currentTime = Date.now();
        this.delta = currentTime - this.current;
        this.current = currentTime;
        this.elapsed = this.current - this.start;

        this.emit('tick');

        this.animationFrameId = window.requestAnimationFrame(this.tick);
    }

    destroy(): void {
        if (this.animationFrameId !== null) {
            window.cancelAnimationFrame(this.animationFrameId);
        }
        super.destroy();
    }
}
