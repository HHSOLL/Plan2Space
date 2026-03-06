import type { TopologyPayload } from "@plan2space/floorplan-core";

export function buildSceneJson(topology: TopologyPayload) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scale: topology.metadata.scale,
    scaleInfo: topology.metadata.scaleInfo,
    walls: topology.walls,
    openings: topology.openings,
    source: topology.source
  };
}
