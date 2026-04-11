import { normalizeAssetSupportProfile } from "../scene/support-profiles";
import type { AssetSupportProfile } from "../scene/support-profiles";
import type {
  CameraAnchor,
  Ceiling,
  Floor,
  LightingSettings,
  NavGraph,
  Opening,
  RoomZone,
  ScaleInfo,
  SceneAsset,
  Wall
} from "../stores/useSceneStore";

export type RoomTemplate = {
  id: string;
  name: string;
  description: string;
  shape: string;
  defaultDimensions: {
    width: number;
    depth: number;
    nookWidth?: number;
    nookDepth?: number;
  };
};

export type RoomShell = {
  scale: number;
  scaleInfo: ScaleInfo;
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
  ceilings: Ceiling[];
  rooms: RoomZone[];
  cameraAnchors: CameraAnchor[];
  navGraph: NavGraph;
};

export type ProductMetadata = {
  catalogItemId?: string | null;
  label?: string;
  category?: string;
  collection?: string;
  supportAssetId?: string | null;
  supportProfile?: AssetSupportProfile | null;
};

export type SceneObject = SceneAsset & {
  metadata?: ProductMetadata;
};

export type SceneNode = SceneObject;

export type MaterialOverride = {
  wallMaterialIndex: number;
  floorMaterialIndex: number;
};

export type LightInstance = LightingSettings;

export type SceneDocument = {
  schemaVersion: 1;
  roomShell: RoomShell;
  nodes: SceneNode[];
  materialOverride: MaterialOverride;
  lighting: LightInstance;
};

export type ViewerHotspot = {
  id: string;
  nodeId: string;
  label: string;
};

export type ProductHotspot = ViewerHotspot & {
  category?: string;
  collection?: string;
};

export type SceneDocumentBootstrap = {
  document: SceneDocument;
  entranceId: string | null;
  diagnostics?: Record<string, unknown>;
};

export type SceneStorePatch = {
  scale: number;
  scaleInfo: ScaleInfo;
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
  ceilings: Ceiling[];
  rooms: RoomZone[];
  cameraAnchors: CameraAnchor[];
  navGraph: NavGraph;
  assets: SceneAsset[];
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  lighting: LightingSettings;
  entranceId: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function toSafeNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toScaleInfo(value: unknown) {
  if (!isRecord(value)) {
    return {
      value: 1,
      source: "unknown" as const,
      confidence: 0
    };
  }

  const source: ScaleInfo["source"] =
    value.source === "ocr_dimension" ||
    value.source === "door_heuristic" ||
    value.source === "user_measure" ||
    value.source === "unknown"
      ? (value.source as ScaleInfo["source"])
      : "unknown";

  return {
    value: toSafeNumber(value.value, 1),
    source,
    confidence: toSafeNumber(value.confidence, 0),
    evidence: isRecord(value.evidence) ? value.evidence : undefined
  };
}

function parseSceneDocumentFromVersion(version: Record<string, unknown>): SceneDocumentBootstrap | null {
  const rawCustomization = isRecord(version.customization) ? version.customization : null;
  const rawDocument = rawCustomization && isRecord(rawCustomization.sceneDocument) ? rawCustomization.sceneDocument : null;

  if (!isRecord(rawDocument)) {
    return null;
  }

  const rawRoomShell = isRecord(rawDocument.roomShell) ? rawDocument.roomShell : null;
  const rawMaterialOverride = isRecord(rawDocument.materialOverride) ? rawDocument.materialOverride : null;
  const rawLighting = isRecord(rawDocument.lighting) ? rawDocument.lighting : null;
  const rawNavGraph = isRecord(rawRoomShell?.navGraph) ? rawRoomShell.navGraph : {};

  if (!rawRoomShell || !isArray(rawDocument.nodes)) {
    return null;
  }

  const entranceId =
    typeof rawRoomShell.entranceId === "string" && rawRoomShell.entranceId.length > 0 ? rawRoomShell.entranceId : null;
  const mappedDocument: SceneDocument = {
    schemaVersion: 1,
    roomShell: {
      scale: toSafeNumber(rawRoomShell.scale, 1),
      scaleInfo: toScaleInfo(rawRoomShell.scaleInfo),
      walls: isArray(rawRoomShell.walls) ? (rawRoomShell.walls as Wall[]) : [],
      openings: isArray(rawRoomShell.openings) ? (rawRoomShell.openings as Opening[]) : [],
      floors: isArray(rawRoomShell.floors) ? (rawRoomShell.floors as Floor[]) : [],
      ceilings: isArray(rawRoomShell.ceilings) ? (rawRoomShell.ceilings as Ceiling[]) : [],
      rooms: isArray(rawRoomShell.rooms) ? (rawRoomShell.rooms as RoomZone[]) : [],
      cameraAnchors: isArray(rawRoomShell.cameraAnchors) ? (rawRoomShell.cameraAnchors as CameraAnchor[]) : [],
      navGraph: {
        nodes: isArray(rawNavGraph.nodes) ? (rawNavGraph.nodes as NavGraph["nodes"]) : [],
        edges: isArray(rawNavGraph.edges) ? (rawNavGraph.edges as NavGraph["edges"]) : []
      }
    },
    nodes: rawDocument.nodes as SceneNode[],
    materialOverride: {
      wallMaterialIndex: toSafeNumber(rawMaterialOverride?.wallMaterialIndex, 0),
      floorMaterialIndex: toSafeNumber(rawMaterialOverride?.floorMaterialIndex, 0)
    },
    lighting: {
      ambientIntensity: toSafeNumber(rawLighting?.ambientIntensity, 0.35),
      hemisphereIntensity: toSafeNumber(rawLighting?.hemisphereIntensity, 0.4),
      directionalIntensity: toSafeNumber(rawLighting?.directionalIntensity, 1.05),
      environmentBlur: toSafeNumber(rawLighting?.environmentBlur, 0.2)
    }
  };

  return {
    document: mappedDocument,
    entranceId,
    diagnostics: {
      source: "customization.sceneDocument"
    }
  };
}

export function mapProjectVersionToSceneDocument(version: Record<string, unknown>): SceneDocumentBootstrap | null {
  return parseSceneDocumentFromVersion(version);
}

export function toSceneStorePatch(scene: SceneDocumentBootstrap): SceneStorePatch {
  return {
    scale: scene.document.roomShell.scale,
    scaleInfo: scene.document.roomShell.scaleInfo,
    walls: scene.document.roomShell.walls,
    openings: scene.document.roomShell.openings,
    floors: scene.document.roomShell.floors,
    ceilings: scene.document.roomShell.ceilings,
    rooms: scene.document.roomShell.rooms,
    cameraAnchors: scene.document.roomShell.cameraAnchors,
    navGraph: scene.document.roomShell.navGraph,
    assets: scene.document.nodes.map((node) => ({
      ...node,
      catalogItemId: node.metadata?.catalogItemId ?? node.catalogItemId,
      supportAssetId:
        (node.metadata && typeof node.metadata.supportAssetId === "string" && node.metadata.supportAssetId.length > 0
          ? node.metadata.supportAssetId
          : typeof node.supportAssetId === "string" && node.supportAssetId.length > 0
            ? node.supportAssetId
            : null),
      supportProfile: normalizeAssetSupportProfile(node.metadata?.supportProfile ?? node.supportProfile)
    })),
    wallMaterialIndex: scene.document.materialOverride.wallMaterialIndex,
    floorMaterialIndex: scene.document.materialOverride.floorMaterialIndex,
    lighting: scene.document.lighting,
    entranceId: scene.entranceId
  };
}
