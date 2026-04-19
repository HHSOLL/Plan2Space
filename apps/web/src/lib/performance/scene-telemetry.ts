"use client";

export const PLAN2SPACE_RENDERER_STATS_EVENT = "plan2space:renderer-stats";
export const PLAN2SPACE_INTERACTION_LATENCY_EVENT =
  "plan2space:interaction-latency";

const TELEMETRY_QUERY_PARAM = "telemetry";
const WINDOW_TELEMETRY_FLAG = "__PLAN2SPACE_TELEMETRY__";
const WINDOW_RENDERER_SNAPSHOT_KEY = "__PLAN2SPACE_LAST_RENDERER_STATS__";
const WINDOW_INTERACTION_SNAPSHOT_KEY =
  "__PLAN2SPACE_LAST_INTERACTION_LATENCY__";

type TelemetryWindow = Window &
  Record<string, unknown> & {
    requestAnimationFrame: (callback: FrameRequestCallback) => number;
  };

export type RendererStatsDetail = {
  timestamp: string;
  path: string;
  interactionMode: string;
  viewMode: string;
  topMode: string;
  dpr: number;
  fps: number;
  frames: number;
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
};

export type InteractionLatencyDetail = {
  timestamp: string;
  path: string;
  kind: string;
  durationMs: number;
  viewMode?: string;
  topMode?: string;
  targetId?: string | null;
};

function getTelemetryWindow(): TelemetryWindow | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window as unknown as TelemetryWindow;
}

export function isSceneTelemetryEnabled() {
  const win = getTelemetryWindow();
  if (!win) {
    return false;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  if (win[WINDOW_TELEMETRY_FLAG] === true) {
    return true;
  }

  const search = new URLSearchParams(win.location.search);
  return search.get(TELEMETRY_QUERY_PARAM) === "1";
}

function emitTelemetryEvent<T>(
  eventName: string,
  snapshotKey: string,
  detail: T
) {
  const win = getTelemetryWindow();
  if (!win || !isSceneTelemetryEnabled()) {
    return;
  }

  win[snapshotKey] = detail;
  win.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export function emitRendererStats(detail: RendererStatsDetail) {
  emitTelemetryEvent(
    PLAN2SPACE_RENDERER_STATS_EVENT,
    WINDOW_RENDERER_SNAPSHOT_KEY,
    detail
  );
}

export function scheduleInteractionLatency(
  kind: string,
  startedAt: number,
  metadata: Omit<
    InteractionLatencyDetail,
    "timestamp" | "path" | "kind" | "durationMs"
  > = {}
) {
  const win = getTelemetryWindow();
  if (!win || !isSceneTelemetryEnabled()) {
    return;
  }

  const finalize = () => {
    emitTelemetryEvent(
      PLAN2SPACE_INTERACTION_LATENCY_EVENT,
      WINDOW_INTERACTION_SNAPSHOT_KEY,
      {
        timestamp: new Date().toISOString(),
        path: win.location.pathname,
        kind,
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
        ...metadata
      } satisfies InteractionLatencyDetail
    );
  };

  win.requestAnimationFrame(() => {
    win.requestAnimationFrame(finalize);
  });
}
