import type { TopologyPayload, Vec2 } from "@plan2space/floorplan-core";

type GeometryBuildResult = {
  roomPolygons: Array<{
    id: string;
    polygon: Vec2[];
    area: number;
    type: string;
  }>;
  exteriorShell: Vec2[];
  roomAdjacency: Array<Record<string, unknown>>;
};

export function buildSceneJson(topology: TopologyPayload, geometry?: GeometryBuildResult) {
  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    scale: topology.metadata.scale,
    scaleInfo: topology.metadata.scaleInfo,
    walls: topology.walls,
    openings: topology.openings,
    rooms:
      geometry?.roomPolygons.map((room) => ({
        id: room.id,
        type: room.type,
        polygon: room.polygon,
        area: room.area
      })) ?? [],
    floors:
      geometry?.roomPolygons.map((room) => ({
        id: room.id,
        outline: room.polygon,
        materialId: null
      })) ?? [],
    exteriorShell: geometry?.exteriorShell ?? [],
    roomAdjacency: geometry?.roomAdjacency ?? [],
    source: topology.source
  };
}
