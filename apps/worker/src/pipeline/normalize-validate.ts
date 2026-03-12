import { normalizeTopology, type TopologyPayload } from "@plan2space/floorplan-core";

function rebuildAnalysisCompleteness(payload: TopologyPayload) {
  return {
    totalWallSegments: payload.walls.length,
    exteriorWalls: payload.walls.filter((wall) => wall.type === "exterior").length,
    interiorWalls: payload.walls.filter((wall) => wall.type === "interior").length,
    totalOpenings: payload.openings.length,
    doors: payload.openings.filter((opening) => opening.type !== "window").length,
    windows: payload.openings.filter((opening) => opening.type === "window").length,
    balconies: payload.walls.filter((wall) => wall.type === "balcony" || wall.isPartOfBalcony).length,
    columns: payload.walls.filter((wall) => wall.type === "column").length
  };
}

export function normalizeAndValidateTopology(payload: TopologyPayload): TopologyPayload {
  const normalized = normalizeTopology(payload);

  return {
    ...payload,
    walls: normalized.walls,
    openings: normalized.openings,
    metadata: {
      ...payload.metadata,
      scale: normalized.scale,
      scaleInfo: normalized.scaleInfo,
      confidence: Math.max(payload.metadata.confidence ?? 0, normalized.scaleInfo.confidence ?? 0),
      analysisCompleteness: rebuildAnalysisCompleteness({
        ...payload,
        walls: normalized.walls,
        openings: normalized.openings,
        metadata: {
          ...payload.metadata,
          scale: normalized.scale,
          scaleInfo: normalized.scaleInfo
        }
      })
    }
  };
}
