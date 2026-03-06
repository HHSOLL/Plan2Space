import type { TopologyOpening, TopologyWall } from "@plan2space/floorplan-core";

export function buildGeometry(topology: { walls: TopologyWall[]; openings: TopologyOpening[]; scale: number }) {
  const wallCoordinates = topology.walls.map((wall) => ({
    id: wall.id,
    start: wall.start,
    end: wall.end,
    thickness: wall.thickness,
    type: wall.type,
    length: wall.length
  }));

  const roomPolygons: Array<{ id: string; polygon: Array<[number, number]> }> = [];

  return {
    wallCoordinates,
    roomPolygons,
    scale: topology.scale
  };
}
