import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTopology } from "@plan2space/floorplan-core";
import { buildGeometry } from "./geometry-builder";
import { buildRevisionArtifacts } from "./revision-builder";

test("buildGeometry reconstructs an exterior loop and a room polygon from a closed layout", () => {
  const topology = normalizeTopology({
    walls: [
      { id: "w1", start: [0, 0], end: [120, 0], thickness: 12, type: "exterior" },
      { id: "w2", start: [120, 0], end: [120, 90], thickness: 12, type: "exterior" },
      { id: "w3", start: [120, 90], end: [0, 90], thickness: 12, type: "exterior" },
      { id: "w4", start: [0, 90], end: [0, 0], thickness: 12, type: "exterior" }
    ],
    openings: [{ id: "d1", position: [60, 0], width: 28, type: "door", isEntrance: true }],
    scale: 0.025,
    scaleInfo: {
      value: 0.025,
      source: "ocr_dimension",
      confidence: 0.8
    }
  });

  const geometry = buildGeometry({
    walls: topology.walls,
    openings: topology.openings,
    scale: topology.scale
  });

  assert.equal(geometry.exteriorShell.length, 4);
  assert.equal(geometry.roomPolygons.length, 1);
  assert.ok(geometry.roomPolygons[0]!.polygon.length >= 4);
  assert.equal(geometry.roomAdjacency.length, 1);
  assert.equal(geometry.roomAdjacency[0]!.relation, "entrance");
});

test("buildRevisionArtifacts reflects reconstructed rooms in room graph hash", () => {
  const topology = {
    metadata: {
      imageWidth: 120,
      imageHeight: 90,
      scale: 0.025,
      scaleInfo: {
        value: 0.025,
        source: "ocr_dimension" as const,
        confidence: 0.9
      },
      unit: "pixels" as const,
      confidence: 0.9,
      analysisCompleteness: {
        totalWallSegments: 4,
        exteriorWalls: 4,
        interiorWalls: 0,
        totalOpenings: 1,
        doors: 1,
        windows: 0,
        balconies: 0,
        columns: 0
      }
    },
    walls: normalizeTopology({
      walls: [
        { id: "w1", start: [0, 0], end: [120, 0], thickness: 12, type: "exterior" },
        { id: "w2", start: [120, 0], end: [120, 90], thickness: 12, type: "exterior" },
        { id: "w3", start: [120, 90], end: [0, 90], thickness: 12, type: "exterior" },
        { id: "w4", start: [0, 90], end: [0, 0], thickness: 12, type: "exterior" }
      ],
      openings: [{ id: "d1", position: [60, 0], width: 28, type: "door", isEntrance: true }],
      scale: 0.025,
      scaleInfo: {
        value: 0.025,
        source: "ocr_dimension",
        confidence: 0.8
      }
    }).walls,
    openings: normalizeTopology({
      walls: [
        { id: "w1", start: [0, 0], end: [120, 0], thickness: 12, type: "exterior" },
        { id: "w2", start: [120, 0], end: [120, 90], thickness: 12, type: "exterior" },
        { id: "w3", start: [120, 90], end: [0, 90], thickness: 12, type: "exterior" },
        { id: "w4", start: [0, 90], end: [0, 0], thickness: 12, type: "exterior" }
      ],
      openings: [{ id: "d1", position: [60, 0], width: 28, type: "door", isEntrance: true }],
      scale: 0.025,
      scaleInfo: {
        value: 0.025,
        source: "ocr_dimension",
        confidence: 0.8
      }
    }).openings,
    source: "test",
    cacheHit: false as const,
    selection: {
      sourceModule: "provider" as const,
      selectedScore: 88,
      selectedPassId: "pass1",
      preprocessProfile: "balanced" as const
    },
    providerStatus: [],
    providerErrors: [],
    selectedScore: 88,
    selectedProvider: "anthropic",
    selectedPassId: "pass1",
    selectedPreprocessProfile: "balanced" as const
  };

  const geometry = buildGeometry({
    walls: topology.walls,
    openings: topology.openings,
    scale: topology.metadata.scale
  });
  const artifacts = buildRevisionArtifacts(topology, geometry);

  assert.ok(artifacts.roomGraphHash.length > 0);
  assert.equal(artifacts.geometryJson.rooms.length, 1);
  assert.equal(artifacts.geometryJson.exteriorShell.length, 4);
});
