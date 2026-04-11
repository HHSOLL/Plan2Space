if (typeof globalThis.ProgressEvent === "undefined") {
  class NodeProgressEvent extends Event {
    readonly lengthComputable: boolean;
    readonly loaded: number;
    readonly total: number;

    constructor(type: string, init: ProgressEventInit = {}) {
      super(type);
      this.lengthComputable = Boolean(init.lengthComputable);
      this.loaded = init.loaded ?? 0;
      this.total = init.total ?? 0;
    }
  }

  Object.defineProperty(globalThis, "ProgressEvent", {
    value: NodeProgressEvent,
    writable: true,
    configurable: true
  });
}
