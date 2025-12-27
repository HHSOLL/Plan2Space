/**
 * EventEmitter - Simple event system for Three.js modules
 * Based on my-room-in-3d pattern
 */
export default class EventEmitter {
  private callbacks: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  on(event: string, callback: (...args: unknown[]) => void): this {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, new Set());
    }
    this.callbacks.get(event)!.add(callback);
    return this;
  }

  off(event: string, callback?: (...args: unknown[]) => void): this {
    if (!callback) {
      this.callbacks.delete(event);
    } else {
      this.callbacks.get(event)?.delete(callback);
    }
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    const callbacks = this.callbacks.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        callback(...args);
      });
    }
    return this;
  }

  once(event: string, callback: (...args: unknown[]) => void): this {
    const onceCallback = (...args: unknown[]) => {
      this.off(event, onceCallback);
      callback(...args);
    };
    return this.on(event, onceCallback);
  }

  destroy(): void {
    this.callbacks.clear();
  }
}
