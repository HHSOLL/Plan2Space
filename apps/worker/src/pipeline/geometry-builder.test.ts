import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTopology } from "@plan2space/floorplan-core";
import { buildGeometry, classifyRooms, selectBaseRoomPolygons } from "./geometry-builder";
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

test("buildGeometry falls back to semantic room hint polygons when wall loops do not separate rooms", () => {
  const topology = normalizeTopology({
    walls: [
      { id: "w1", start: [0, 0], end: [200, 0], thickness: 12, type: "exterior" },
      { id: "w2", start: [200, 0], end: [200, 120], thickness: 12, type: "exterior" },
      { id: "w3", start: [200, 120], end: [0, 120], thickness: 12, type: "exterior" },
      { id: "w4", start: [0, 120], end: [0, 0], thickness: 12, type: "exterior" }
    ],
    openings: [{ id: "d1", position: [24, 0], width: 28, type: "door", isEntrance: true }],
    scale: 0.025,
    scaleInfo: {
      value: 0.025,
      source: "ocr_dimension",
      confidence: 0.9
    },
    roomHints: [
      {
        id: "rh1",
        label: "거실",
        position: [50, 60],
        polygon: [
          [0, 0],
          [100, 0],
          [100, 120],
          [0, 120]
        ]
      },
      {
        id: "rh2",
        label: "침실",
        position: [150, 60],
        polygon: [
          [100, 0],
          [200, 0],
          [200, 120],
          [100, 120]
        ]
      }
    ]
  });

  const geometry = buildGeometry({
    walls: topology.walls,
    openings: topology.openings,
    scale: topology.scale,
    semanticAnnotations: topology.semanticAnnotations
  });

  assert.equal(geometry.roomPolygons.length, 2);
  assert.equal(geometry.roomPolygons.find((room) => room.id === "room-1")?.roomType, "living_room");
  assert.equal(geometry.roomPolygons.find((room) => room.id === "room-2")?.roomType, "bedroom");
  assert.equal(geometry.roomPolygons.find((room) => room.id === "room-1")?.labelSource, "annotation");
});

test("selectBaseRoomPolygons keeps loop-derived rooms when topology already separates rooms", () => {
  const loopRooms = [
    { id: "room-1", polygon: [[0, 0], [100, 0], [100, 120], [0, 120]] as [number, number][], area: 12000, type: "room" as const, centroid: [50, 60] as [number, number] },
    { id: "room-2", polygon: [[100, 0], [200, 0], [200, 120], [100, 120]] as [number, number][], area: 12000, type: "room" as const, centroid: [150, 60] as [number, number] }
  ];
  const hintedRooms = [
    ...loopRooms,
    { id: "room-3", polygon: [[150, 0], [200, 0], [200, 40], [150, 40]] as [number, number][], area: 2000, type: "room" as const, centroid: [175, 20] as [number, number] }
  ];

  const selected = selectBaseRoomPolygons(loopRooms, hintedRooms);
  assert.deepEqual(selected, loopRooms);
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
    semanticAnnotations: {
      roomHints: [],
      dimensionAnnotations: []
    },
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
  assert.equal(artifacts.geometryJson.rooms[0]!.labelSource, "heuristic");
  assert.equal(artifacts.geometryJson.rooms[0]!.matchedHintId, null);
  assert.deepEqual(artifacts.geometryJson.evidenceRefs.semanticAnnotations, {
    roomHints: [],
    dimensionAnnotations: []
  });
});

test("buildRevisionArtifacts stays deterministic for reordered semantic hints", () => {
  const createTopology = (roomHints: Array<{ label: string; position: [number, number]; polygon: [number, number][] }>) =>
    normalizeTopology({
      walls: [
        { id: "w1", start: [0, 0], end: [200, 0], thickness: 12, type: "exterior" },
        { id: "w2", start: [200, 0], end: [200, 120], thickness: 12, type: "exterior" },
        { id: "w3", start: [200, 120], end: [0, 120], thickness: 12, type: "exterior" },
        { id: "w4", start: [0, 120], end: [0, 0], thickness: 12, type: "exterior" }
      ],
      openings: [{ id: "d1", position: [24, 0], width: 28, type: "door", isEntrance: true }],
      scale: 1,
      scaleInfo: {
        value: 1,
        source: "unknown",
        confidence: 0.1
      },
      semanticAnnotations: {
        roomHints,
        dimensionAnnotations: [
          {
            text: "10,060",
            p1: [0, 0],
            p2: [200, 0]
          }
        ]
      }
    });

  const topologyA = createTopology([
    {
      label: "침실",
      position: [150, 60],
      polygon: [
        [100, 0],
        [200, 0],
        [200, 120],
        [100, 120]
      ]
    },
    {
      label: "거실",
      position: [50, 60],
      polygon: [
        [0, 0],
        [100, 0],
        [100, 120],
        [0, 120]
      ]
    }
  ]);
  const topologyB = createTopology([
    {
      label: "거실",
      position: [50, 60],
      polygon: [
        [0, 0],
        [100, 0],
        [100, 120],
        [0, 120]
      ]
    },
    {
      label: "침실",
      position: [150, 60],
      polygon: [
        [100, 0],
        [200, 0],
        [200, 120],
        [100, 120]
      ]
    }
  ]);

  const geometryA = buildGeometry({
    walls: topologyA.walls,
    openings: topologyA.openings,
    scale: topologyA.scale,
    semanticAnnotations: topologyA.semanticAnnotations
  });
  const geometryB = buildGeometry({
    walls: topologyB.walls,
    openings: topologyB.openings,
    scale: topologyB.scale,
    semanticAnnotations: topologyB.semanticAnnotations
  });

  const baseMetadata = {
    imageWidth: 200,
    imageHeight: 120,
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
  };

  const artifactsA = buildRevisionArtifacts(
    {
      metadata: { ...baseMetadata, scale: topologyA.scale, scaleInfo: topologyA.scaleInfo },
      walls: topologyA.walls,
      openings: topologyA.openings,
      semanticAnnotations: topologyA.semanticAnnotations,
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
    },
    geometryA
  );
  const artifactsB = buildRevisionArtifacts(
    {
      metadata: { ...baseMetadata, scale: topologyB.scale, scaleInfo: topologyB.scaleInfo },
      walls: topologyB.walls,
      openings: topologyB.openings,
      semanticAnnotations: topologyB.semanticAnnotations,
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
    },
    geometryB
  );

  assert.equal(artifactsA.roomGraphHash, artifactsB.roomGraphHash);
  assert.equal(artifactsA.geometryHash, artifactsB.geometryHash);
  assert.deepEqual(artifactsA.geometryJson.evidenceRefs.semanticAnnotations, artifactsB.geometryJson.evidenceRefs.semanticAnnotations);
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
