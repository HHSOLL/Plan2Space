import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTopology } from "@plan2space/floorplan-core";
import { buildGeometry, classifyRooms } from "./geometry-builder";
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
  assert.equal(geometry.roomPolygons[0]!.roomType, "living_room");
  assert.equal(geometry.floorZones.length, 1);
  assert.equal(geometry.ceilingZones.length, 1);
  assert.ok(geometry.cameraAnchors.some((anchor) => anchor.kind === "entrance"));
  assert.ok(geometry.navGraph.nodes.length >= 1);
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
  assert.equal(artifacts.geometryJson.rooms[0]!.roomType, "living_room");
  assert.equal(artifacts.derivedNavJson.nodes.length, geometry.navGraph.nodes.length);
  assert.equal(artifacts.derivedCameraJson.anchors.length, geometry.cameraAnchors.length);
  assert.equal(artifacts.geometryJson.exteriorShell.length, 4);
});

test("classifyRooms infers Korean apartment room semantics from adjacency and exposure", () => {
  const baseRooms = [
    {
      id: "living",
      polygon: [[0, 0], [80, 0], [80, 60], [0, 60]] as [number, number][],
      area: 4800,
      type: "room" as const,
      centroid: [40, 30] as [number, number]
    },
    {
      id: "kitchen",
      polygon: [[80, 0], [140, 0], [140, 60], [80, 60]] as [number, number][],
      area: 3600,
      type: "room" as const,
      centroid: [110, 30] as [number, number]
    },
    {
      id: "utility",
      polygon: [[140, 0], [170, 0], [170, 35], [140, 35]] as [number, number][],
      area: 1050,
      type: "room" as const,
      centroid: [155, 17.5] as [number, number]
    },
    {
      id: "balcony",
      polygon: [[0, 60], [80, 60], [80, 80], [0, 80]] as [number, number][],
      area: 1600,
      type: "room" as const,
      centroid: [40, 70] as [number, number]
    },
    {
      id: "foyer",
      polygon: [[80, 60], [110, 60], [110, 80], [80, 80]] as [number, number][],
      area: 600,
      type: "room" as const,
      centroid: [95, 70] as [number, number]
    }
  ];

  const adjacencies = [
    { id: "adj-entry", fromRoomId: "foyer", toRoomId: null, openingId: "o-entry", relation: "entrance" as const },
    { id: "adj-foyer-living", fromRoomId: "foyer", toRoomId: "living", openingId: "o1", relation: "door" as const },
    { id: "adj-living-kitchen", fromRoomId: "living", toRoomId: "kitchen", openingId: "o2", relation: "passage" as const },
    { id: "adj-kitchen-utility", fromRoomId: "kitchen", toRoomId: "utility", openingId: "o3", relation: "door" as const },
    { id: "adj-living-balcony", fromRoomId: "living", toRoomId: "balcony", openingId: "o4", relation: "door" as const }
  ];

  const walls = [
    { id: "w1", start: [0, 0] as [number, number], end: [80, 0] as [number, number], thickness: 12, type: "exterior" as const, length: 80, isPartOfBalcony: false },
    { id: "w2", start: [80, 0] as [number, number], end: [140, 0] as [number, number], thickness: 12, type: "exterior" as const, length: 60, isPartOfBalcony: false },
    { id: "w3", start: [140, 0] as [number, number], end: [170, 0] as [number, number], thickness: 12, type: "exterior" as const, length: 30, isPartOfBalcony: false },
    { id: "w4", start: [170, 0] as [number, number], end: [170, 35] as [number, number], thickness: 12, type: "exterior" as const, length: 35, isPartOfBalcony: false },
    { id: "w5", start: [0, 60] as [number, number], end: [0, 0] as [number, number], thickness: 12, type: "exterior" as const, length: 60, isPartOfBalcony: false },
    { id: "w6", start: [0, 80] as [number, number], end: [80, 80] as [number, number], thickness: 12, type: "balcony" as const, length: 80, isPartOfBalcony: true },
    { id: "w7", start: [0, 60] as [number, number], end: [0, 80] as [number, number], thickness: 12, type: "balcony" as const, length: 20, isPartOfBalcony: true },
    { id: "w8", start: [170, 35] as [number, number], end: [140, 35] as [number, number], thickness: 12, type: "exterior" as const, length: 30, isPartOfBalcony: false }
  ];

  const rooms = classifyRooms(baseRooms, adjacencies, walls);

  assert.equal(rooms.find((room) => room.id === "living")?.roomType, "living_room");
  assert.equal(rooms.find((room) => room.id === "kitchen")?.roomType, "kitchen");
  assert.equal(rooms.find((room) => room.id === "utility")?.roomType, "utility");
  assert.equal(rooms.find((room) => room.id === "balcony")?.roomType, "balcony");
  assert.equal(rooms.find((room) => room.id === "foyer")?.roomType, "foyer");
});
