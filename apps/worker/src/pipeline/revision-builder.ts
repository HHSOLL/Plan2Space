import { createHash } from "node:crypto";
import type { TopologyPayload, Vec2 } from "@plan2space/floorplan-core";
import type { GeometryBuildResult } from "./geometry-builder";

type GeometrySnapshot = {
  schemaVersion: number;
  unit: "mm";
  canonicalOrientation: {
    strategy: string;
    reference: string;
  };
  scale: {
    metersPerPixel: number;
    millimetersPerPixel: number;
    source: string;
    confidence: number;
  };
  walls: Array<{
    id: string;
    startMm: [number, number];
    endMm: [number, number];
    thicknessMm: number;
    lengthMm: number;
    type: string;
    isPartOfBalcony: boolean;
    confidence: number | null;
  }>;
  openings: Array<{
    id: string;
    wallId: string;
    type: string;
    positionMm: [number, number];
    offsetMm: number;
    widthMm: number;
    heightMm: number | null;
    isEntrance: boolean;
    detectConfidence: number | null;
    attachConfidence: number | null;
    typeConfidence: number | null;
  }>;
  rooms: Array<{
    id: string;
    roomType: string;
    label: string;
    polygonMm: Array<[number, number]>;
    areaSqMm: number;
    centroidMm: [number, number];
    openingIds: string[];
    connectedRoomIds: string[];
    estimatedCeilingHeightMm: number;
    estimatedUsage: string;
    isExteriorFacing: boolean;
  }>;
  entrance:
    | {
        openingId: string;
        wallId: string;
        positionMm: [number, number];
        type: string;
      }
    | null;
  exteriorShell: Array<[number, number]>;
  roomAdjacency: Array<{
    id: string;
    fromRoomId: string | null;
    toRoomId: string | null;
    openingId: string;
    relation: string;
  }>;
  evidenceRefs: Record<string, unknown>;
};

function toMillimeters(value: number, metersPerPixel: number) {
  return Math.round(value * metersPerPixel * 1000);
}

function toMillimeterVec(point: Vec2, metersPerPixel: number): [number, number] {
  return [toMillimeters(point[0], metersPerPixel), toMillimeters(point[1], metersPerPixel)];
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = sortObject((value as Record<string, unknown>)[key]);
      return accumulator;
    }, {});
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(sortObject(value))).digest("hex");
}

function deriveEntrance(topology: TopologyPayload) {
  const entranceOpening = topology.openings.find((opening) => opening.isEntrance);
  if (!entranceOpening) {
    return null;
  }

  return {
    openingId: entranceOpening.id,
    wallId: entranceOpening.wallId,
    positionMm: [
      toMillimeters(entranceOpening.position[0], topology.metadata.scale),
      toMillimeters(entranceOpening.position[1], topology.metadata.scale)
    ] as [number, number],
    type: entranceOpening.type
  };
}

export function buildRevisionArtifacts(topology: TopologyPayload, geometry: GeometryBuildResult) {
  const geometryJson: GeometrySnapshot = {
    schemaVersion: 1,
    unit: "mm",
    canonicalOrientation: {
      strategy: "entrance-aligned",
      reference: topology.openings.some((opening) => opening.isEntrance) ? "entrance" : "input"
    },
    scale: {
      metersPerPixel: topology.metadata.scale,
      millimetersPerPixel: topology.metadata.scale * 1000,
      source: topology.metadata.scaleInfo.source,
      confidence: topology.metadata.scaleInfo.confidence
    },
    walls: topology.walls.map((wall) => ({
      id: wall.id,
      startMm: toMillimeterVec(wall.start, topology.metadata.scale),
      endMm: toMillimeterVec(wall.end, topology.metadata.scale),
      thicknessMm: toMillimeters(wall.thickness, topology.metadata.scale),
      lengthMm: toMillimeters(wall.length, topology.metadata.scale),
      type: wall.type,
      isPartOfBalcony: wall.isPartOfBalcony,
      confidence: wall.confidence ?? null
    })),
    openings: topology.openings.map((opening) => ({
      id: opening.id,
      wallId: opening.wallId,
      type: opening.type,
      positionMm: toMillimeterVec(opening.position, topology.metadata.scale),
      offsetMm: toMillimeters(opening.offset, topology.metadata.scale),
      widthMm: toMillimeters(opening.width, topology.metadata.scale),
      heightMm: opening.height ? toMillimeters(opening.height, topology.metadata.scale) : null,
      isEntrance: Boolean(opening.isEntrance),
      detectConfidence: opening.detectConfidence ?? null,
      attachConfidence: opening.attachConfidence ?? null,
      typeConfidence: opening.typeConfidence ?? null
    })),
    rooms: geometry.roomPolygons.map((room) => ({
      id: room.id,
      roomType: room.roomType,
      label: room.label,
      polygonMm: room.polygon.map((point) => toMillimeterVec(point, topology.metadata.scale)),
      areaSqMm: Math.round(room.area * topology.metadata.scale * 1000 * topology.metadata.scale * 1000),
      centroidMm: toMillimeterVec(room.centroid, topology.metadata.scale),
      openingIds: room.openingIds,
      connectedRoomIds: room.connectedRoomIds,
      estimatedCeilingHeightMm: Math.round(room.estimatedCeilingHeight * 1000),
      estimatedUsage: room.estimatedUsage,
      isExteriorFacing: room.isExteriorFacing
    })),
    entrance: deriveEntrance(topology),
    exteriorShell: geometry.exteriorShell.map((point) => toMillimeterVec(point, topology.metadata.scale)),
    roomAdjacency: geometry.roomAdjacency.map((adjacency) => ({
      id: adjacency.id,
      fromRoomId: adjacency.fromRoomId,
      toRoomId: adjacency.toRoomId,
      openingId: adjacency.openingId,
      relation: adjacency.relation
    })),
    evidenceRefs: {
      source: topology.source,
      scaleInfo: topology.metadata.scaleInfo,
      selection: topology.selection,
      selectedProvider: topology.selectedProvider ?? null,
      selectedPassId: topology.selectedPassId ?? null
    }
  };

  const topologyProjection = {
    walls: geometryJson.walls.map((wall) => ({
      id: wall.id,
      type: wall.type,
      startMm: wall.startMm,
      endMm: wall.endMm
    })),
    openings: geometryJson.openings.map((opening) => ({
      id: opening.id,
      wallId: opening.wallId,
      type: opening.type,
      isEntrance: opening.isEntrance
    })),
    exteriorShell: geometryJson.exteriorShell,
    entrance: geometryJson.entrance ? { wallId: geometryJson.entrance.wallId, openingId: geometryJson.entrance.openingId } : null
  };

  const roomGraphProjection = {
    rooms: geometryJson.rooms.map((room) => ({
      id: room.id,
      roomType: room.roomType,
      polygonMm: room.polygonMm,
      openingIds: room.openingIds,
      connectedRoomIds: room.connectedRoomIds
    })),
    roomAdjacency: geometryJson.roomAdjacency,
    entrance: geometryJson.entrance
  };

  const geometryHash = stableHash(geometryJson);
  return {
    geometryJson,
    topologyHash: stableHash(topologyProjection),
    roomGraphHash: stableHash(roomGraphProjection),
    geometryHash,
    derivedNavJson: {
      nodes: geometry.navGraph.nodes.map((node) => ({
        id: node.id,
        roomId: node.roomId,
        kind: node.kind,
        planPositionMm: toMillimeterVec(node.planPosition, topology.metadata.scale)
      })),
      edges: geometry.navGraph.edges.map((edge) => ({
        id: edge.id,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        relation: edge.relation,
        openingId: edge.openingId
      }))
    },
    derivedCameraJson: {
      anchors: geometry.cameraAnchors.map((anchor) => ({
        id: anchor.id,
        kind: anchor.kind,
        roomId: anchor.roomId,
        openingId: anchor.openingId,
        planPositionMm: toMillimeterVec(anchor.planPosition, topology.metadata.scale),
        targetPlanPositionMm: toMillimeterVec(anchor.targetPlanPosition, topology.metadata.scale),
        heightMm: Math.round(anchor.height * 1000)
      }))
    }
  };
}
