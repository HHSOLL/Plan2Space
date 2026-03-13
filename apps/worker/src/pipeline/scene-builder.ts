import type { TopologyPayload } from "@plan2space/floorplan-core";
import type {
  CameraAnchor,
  CeilingZone,
  FloorZone,
  GeometryBuildResult,
  NavEdge,
  NavNode,
  RoomAdjacency,
  RoomPolygon
} from "./geometry-builder";

function serializeRoom(room: RoomPolygon) {
  return {
    id: room.id,
    type: room.type,
    roomType: room.roomType,
    label: room.label,
    polygon: room.polygon,
    area: room.area,
    centroid: room.centroid,
    openingIds: room.openingIds,
    connectedRoomIds: room.connectedRoomIds,
    estimatedCeilingHeight: room.estimatedCeilingHeight,
    estimatedUsage: room.estimatedUsage,
    isExteriorFacing: room.isExteriorFacing
  };
}

function serializeFloorZone(floor: FloorZone) {
  return {
    id: floor.id,
    roomId: floor.roomId,
    roomType: floor.roomType,
    outline: floor.outline,
    materialId: floor.materialId
  };
}

function serializeCeilingZone(ceiling: CeilingZone) {
  return {
    id: ceiling.id,
    roomId: ceiling.roomId,
    roomType: ceiling.roomType,
    outline: ceiling.outline,
    materialId: ceiling.materialId,
    height: ceiling.height
  };
}

function serializeAdjacency(adjacency: RoomAdjacency) {
  return {
    id: adjacency.id,
    fromRoomId: adjacency.fromRoomId,
    toRoomId: adjacency.toRoomId,
    openingId: adjacency.openingId,
    relation: adjacency.relation
  };
}

function serializeCameraAnchor(anchor: CameraAnchor) {
  return {
    id: anchor.id,
    kind: anchor.kind,
    roomId: anchor.roomId,
    openingId: anchor.openingId,
    planPosition: anchor.planPosition,
    targetPlanPosition: anchor.targetPlanPosition,
    height: anchor.height
  };
}

function serializeNavNode(node: NavNode) {
  return {
    id: node.id,
    roomId: node.roomId,
    kind: node.kind,
    planPosition: node.planPosition
  };
}

function serializeNavEdge(edge: NavEdge) {
  return {
    id: edge.id,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    relation: edge.relation,
    openingId: edge.openingId
  };
}

export function buildSceneJson(topology: TopologyPayload, geometry?: GeometryBuildResult) {
  const entranceAnchor = geometry?.cameraAnchors.find((anchor) => anchor.kind === "entrance") ?? null;

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    scale: topology.metadata.scale,
    scaleInfo: topology.metadata.scaleInfo,
    walls: topology.walls,
    openings: topology.openings,
    rooms: geometry?.roomPolygons.map(serializeRoom) ?? [],
    floors: geometry?.floorZones.map(serializeFloorZone) ?? [],
    ceilings: geometry?.ceilingZones.map(serializeCeilingZone) ?? [],
    exteriorShell: geometry?.exteriorShell ?? [],
    roomAdjacency: geometry?.roomAdjacency.map(serializeAdjacency) ?? [],
    navGraph: geometry
      ? {
          nodes: geometry.navGraph.nodes.map(serializeNavNode),
          edges: geometry.navGraph.edges.map(serializeNavEdge)
        }
      : { nodes: [], edges: [] },
    cameraAnchors: geometry?.cameraAnchors.map(serializeCameraAnchor) ?? [],
    entrance: entranceAnchor
      ? {
          openingId: entranceAnchor.openingId,
          roomId: entranceAnchor.roomId
        }
      : null,
    source: topology.source
  };
}
