import { normalizeSceneAnchorType, type SceneAnchorType } from "./anchor-types";
import {
  resolveAssetSupportProfile,
  type AssetSupportProfile,
  type SupportAnchorType
} from "./support-profiles";

const DEFAULT_CEILING_HEIGHT = 2.8;

type WallLike = {
  start: [number, number];
  end: [number, number];
  height?: number;
};

type CeilingLike = {
  height: number;
};

type AnchorAssetLike = {
  id: string;
  assetId: string;
  catalogItemId?: string | null;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  anchorType?: SceneAnchorType;
  supportProfile?: AssetSupportProfile | null;
};

type Position = [number, number, number];
type Rotation = [number, number, number];
type SurfacePlacement = {
  position: Position;
  supportAssetId: string | null;
};

const SMALL_OBJECT_KEYWORDS = [
  "monitor",
  "keyboard",
  "mouse",
  "laptop",
  "tablet",
  "speaker",
  "headset",
  "microphone"
];
const WALL_OBJECT_KEYWORDS = ["mirror", "wall art", "wall", "painting", "frame", "sconce"];
const CEILING_OBJECT_KEYWORDS = ["pendant", "chandelier", "ceiling"];
const SHELF_OBJECT_KEYWORDS = ["book", "vase", "figurine", "ornament", "frame"];
const DESK_SURFACE_SUPPORT_KEYWORDS = ["desk", "table", "workbench", "console"];
const SHELF_SURFACE_SUPPORT_KEYWORDS = ["shelf", "bookcase", "rack", "cabinet"];
const FURNITURE_SURFACE_SUPPORT_KEYWORDS = [
  "desk",
  "table",
  "shelf",
  "bookcase",
  "cabinet",
  "console",
  "dresser",
  "stand",
  "nightstand",
  "bedside"
];

function projectPointToSegment2D(
  pointX: number,
  pointZ: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number
) {
  const deltaX = endX - startX;
  const deltaZ = endZ - startZ;
  const lenSq = deltaX * deltaX + deltaZ * deltaZ;
  if (lenSq <= Number.EPSILON) {
    return {
      x: startX,
      z: startZ,
      distanceSq: (pointX - startX) ** 2 + (pointZ - startZ) ** 2,
      yaw: 0
    };
  }
  const t = Math.max(0, Math.min(1, ((pointX - startX) * deltaX + (pointZ - startZ) * deltaZ) / lenSq));
  const x = startX + deltaX * t;
  const z = startZ + deltaZ * t;
  return {
    x,
    z,
    distanceSq: (pointX - x) ** 2 + (pointZ - z) ** 2,
    yaw: Math.atan2(deltaZ, deltaX)
  };
}

function getDefaultAnchorHeight(anchorType: SceneAnchorType, ceilingHeight: number): number {
  switch (anchorType) {
    case "ceiling":
      return ceilingHeight;
    case "desk_surface":
      return 0.74;
    case "furniture_surface":
      return 0.82;
    case "shelf_surface":
      return 1.35;
    case "wall":
      return Math.min(Math.max(ceilingHeight * 0.5, 0.9), ceilingHeight - 0.25);
    case "floor":
    default:
      return 0;
  }
}

function inferAssetBounds(assetId: string) {
  const haystack = assetId.toLowerCase();
  if (haystack.includes("desk") || haystack.includes("table")) {
    return { width: 1.4, depth: 0.7, height: 0.75 };
  }
  if (haystack.includes("shelf") || haystack.includes("bookcase") || haystack.includes("cabinet")) {
    return { width: 1.0, depth: 0.38, height: 1.75 };
  }
  if (haystack.includes("sofa")) {
    return { width: 2.1, depth: 0.92, height: 0.9 };
  }
  if (haystack.includes("bed")) {
    return { width: 2.0, depth: 1.65, height: 0.58 };
  }
  if (haystack.includes("chair") || haystack.includes("stool")) {
    return { width: 0.62, depth: 0.62, height: 0.92 };
  }
  return { width: 1.0, depth: 1.0, height: 1.0 };
}

function getScaleMagnitude(scale: [number, number, number]) {
  return {
    x: Math.max(Math.abs(scale[0]), 0.1),
    y: Math.max(Math.abs(scale[1]), 0.1),
    z: Math.max(Math.abs(scale[2]), 0.1)
  };
}

function isSurfaceAnchorType(anchorType: SceneAnchorType): anchorType is SupportAnchorType {
  return (
    anchorType === "desk_surface" ||
    anchorType === "shelf_surface" ||
    anchorType === "furniture_surface"
  );
}

function matchesSupportCandidate(anchorType: SceneAnchorType, assetId: string) {
  const haystack = assetId.toLowerCase();
  if (anchorType === "desk_surface") {
    return DESK_SURFACE_SUPPORT_KEYWORDS.some((keyword) => haystack.includes(keyword));
  }
  if (anchorType === "shelf_surface") {
    return SHELF_SURFACE_SUPPORT_KEYWORDS.some((keyword) => haystack.includes(keyword));
  }
  if (anchorType === "furniture_surface") {
    return FURNITURE_SURFACE_SUPPORT_KEYWORDS.some((keyword) => haystack.includes(keyword));
  }
  return false;
}

function rotateXZ(x: number, z: number, yaw: number) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: x * cos - z * sin,
    z: x * sin + z * cos
  };
}

function inverseRotateXZ(x: number, z: number, yaw: number) {
  return rotateXZ(x, z, -yaw);
}

function getHeuristicSupportProfile(anchorType: SupportAnchorType, assetId: string) {
  if (!matchesSupportCandidate(anchorType, assetId)) {
    return null;
  }

  const bounds = inferAssetBounds(assetId);
  if (anchorType === "shelf_surface") {
    return {
      surfaces: [
        {
          id: "heuristic-shelf",
          anchorTypes: ["shelf_surface"],
          center: [0, 0],
          size: [Math.max(bounds.width * 0.82, 0.28), Math.max(bounds.depth * 0.72, 0.18)],
          top: Math.max(bounds.height * 0.72, 0.8),
          margin: [0.06, 0.04]
        }
      ]
    } satisfies AssetSupportProfile;
  }

  return {
    surfaces: [
      {
        id: "heuristic-top",
        anchorTypes: [anchorType, "furniture_surface"],
        center: [0, 0],
        size: [Math.max(bounds.width * 0.86, 0.3), Math.max(bounds.depth * 0.82, 0.2)],
        top: bounds.height,
        margin: [0.08, 0.06]
      }
    ]
  } satisfies AssetSupportProfile;
}

function resolveSupportProfileForAsset(asset: AnchorAssetLike, anchorType: SupportAnchorType) {
  return (
    resolveAssetSupportProfile({
      catalogItemId: asset.catalogItemId,
      assetId: asset.assetId,
      supportProfile: asset.supportProfile
    }) ?? getHeuristicSupportProfile(anchorType, asset.assetId)
  );
}

function resolveSurfacePlacementForCandidate(
  anchorType: SupportAnchorType,
  position: Position,
  asset: AnchorAssetLike
) {
  const profile = resolveSupportProfileForAsset(asset, anchorType);
  if (!profile) {
    return null;
  }

  const [x, , z] = position;
  const scale = getScaleMagnitude(asset.scale);
  const yaw = asset.rotation[1] ?? 0;
  const hoverOffset = anchorType === "shelf_surface" ? 0.05 : 0.03;

  return profile.surfaces
    .filter((surface) => surface.anchorTypes.includes(anchorType))
    .reduce<{
      position: Position;
      distanceSq: number;
      supportAssetId: string;
      explicit: boolean;
    } | null>((best, surface) => {
      const centerOffset = rotateXZ(surface.center[0] * scale.x, surface.center[1] * scale.z, yaw);
      const surfaceCenterX = asset.position[0] + centerOffset.x;
      const surfaceCenterZ = asset.position[2] + centerOffset.z;
      const localPoint = inverseRotateXZ(x - surfaceCenterX, z - surfaceCenterZ, yaw);
      const halfWidth = Math.max((surface.size[0] * scale.x) / 2, 0);
      const halfDepth = Math.max((surface.size[1] * scale.z) / 2, 0);
      const marginX = Math.min(surface.margin?.[0] ?? 0.08, halfWidth);
      const marginZ = Math.min(surface.margin?.[1] ?? 0.06, halfDepth);
      const minX = halfWidth > marginX ? -halfWidth + marginX : 0;
      const maxX = halfWidth > marginX ? halfWidth - marginX : 0;
      const minZ = halfDepth > marginZ ? -halfDepth + marginZ : 0;
      const maxZ = halfDepth > marginZ ? halfDepth - marginZ : 0;
      const clampedLocalX = Math.min(maxX, Math.max(minX, localPoint.x));
      const clampedLocalZ = Math.min(maxZ, Math.max(minZ, localPoint.z));
      const worldOffset = rotateXZ(clampedLocalX, clampedLocalZ, yaw);
      const clampedX = surfaceCenterX + worldOffset.x;
      const clampedZ = surfaceCenterZ + worldOffset.z;
      const topY = asset.position[1] + surface.top * scale.y + hoverOffset;
      const distanceSq = (clampedX - x) ** 2 + (clampedZ - z) ** 2;
      const candidatePlacement = {
        position: [clampedX, topY, clampedZ] as Position,
        distanceSq,
        supportAssetId: asset.id,
        explicit: Boolean(asset.supportProfile)
      };
      if (!best) {
        return candidatePlacement;
      }
      if (candidatePlacement.distanceSq < best.distanceSq - 1e-6) {
        return candidatePlacement;
      }
      if (
        Math.abs(candidatePlacement.distanceSq - best.distanceSq) <= 1e-6 &&
        candidatePlacement.explicit &&
        !best.explicit
      ) {
        return candidatePlacement;
      }
      return best;
    }, null);
}

function constrainToSupportingSurface(
  anchorType: SupportAnchorType,
  position: Position,
  sceneAssets: AnchorAssetLike[],
  options?: {
    activeAssetId?: string;
    supportAssetId?: string | null;
  }
): SurfacePlacement | null {
  const supportCandidates = sceneAssets.filter((asset) => {
    if (asset.id === options?.activeAssetId) return false;
    const candidateAnchorType = normalizeSceneAnchorType(asset.anchorType);
    if (candidateAnchorType === "ceiling") return false;
    return Boolean(resolveSupportProfileForAsset(asset, anchorType));
  });

  if (supportCandidates.length === 0) {
    return null;
  }

  const picked = supportCandidates.reduce<{
    position: Position;
    distanceSq: number;
    supportAssetId: string;
  } | null>((best, candidate) => {
    const placement = resolveSurfacePlacementForCandidate(anchorType, position, candidate);
    if (!placement) {
      return best;
    }
    if (!best || placement.distanceSq < best.distanceSq) {
      return placement;
    }
    return best;
  }, null);

  if (!picked) {
    return null;
  }

  const assignedSupport = options?.supportAssetId
    ? supportCandidates.find((asset) => asset.id === options.supportAssetId)
    : null;
  const assignedPlacement =
    assignedSupport && resolveSurfacePlacementForCandidate(anchorType, position, assignedSupport);
  if (!assignedPlacement) {
    return {
      position: picked.position,
      supportAssetId: picked.supportAssetId
    };
  }

  const SUPPORT_STICKY_DISTANCE_SQ = 0.18;
  if (assignedPlacement.distanceSq <= picked.distanceSq + SUPPORT_STICKY_DISTANCE_SQ) {
    return {
      position: assignedPlacement.position,
      supportAssetId: assignedPlacement.supportAssetId
    };
  }

  return {
    position: picked.position,
    supportAssetId: picked.supportAssetId
  };
}

export function inferAnchorTypeForCatalogItem(item: {
  label?: string;
  description?: string;
  category?: string;
  categoryId?: string;
}): SceneAnchorType {
  const haystack = `${item.label ?? ""} ${item.description ?? ""} ${item.category ?? ""} ${
    item.categoryId ?? ""
  }`.toLowerCase();

  if (SMALL_OBJECT_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "desk_surface";
  }
  if (WALL_OBJECT_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "wall";
  }
  if (CEILING_OBJECT_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "ceiling";
  }
  if (SHELF_OBJECT_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "shelf_surface";
  }
  if ((item.categoryId ?? "").toLowerCase() === "lighting") {
    return "ceiling";
  }
  return "floor";
}

export function resolveCeilingHeight(
  walls: WallLike[],
  ceilings: CeilingLike[],
  fallback = DEFAULT_CEILING_HEIGHT
): number {
  const fromCeilings = ceilings.reduce(
    (max, ceiling) => (Number.isFinite(ceiling.height) ? Math.max(max, ceiling.height) : max),
    0
  );
  if (fromCeilings > 0) return fromCeilings;
  const fromWalls = walls.reduce(
    (max, wall) =>
      typeof wall.height === "number" && Number.isFinite(wall.height)
        ? Math.max(max, wall.height)
        : max,
    0
  );
  if (fromWalls > 0) return fromWalls;
  return fallback;
}

export function constrainPlacementToAnchor(
  input: {
    position: Position;
    rotation: Rotation;
    anchorType?: SceneAnchorType | null;
    supportAssetId?: string | null;
  },
  options: {
    walls: WallLike[];
    ceilings: CeilingLike[];
    scale: number;
    sceneAssets?: AnchorAssetLike[];
    activeAssetId?: string;
  }
): {
  position: Position;
  rotation: Rotation;
  anchorType: SceneAnchorType;
  supportAssetId: string | null;
} {
  const anchorType = normalizeSceneAnchorType(input.anchorType);
  const ceilingHeight = resolveCeilingHeight(options.walls, options.ceilings);

  let [x, y, z] = input.position;
  const [rotationX, rotationY, rotationZ] = input.rotation;
  let nextRotationY = rotationY;
  let supportAssetId =
    typeof input.supportAssetId === "string" && input.supportAssetId.length > 0 ? input.supportAssetId : null;

  if (anchorType === "wall" && options.walls.length > 0) {
    const snapped = options.walls.reduce<{
      x: number;
      z: number;
      yaw: number;
      distanceSq: number;
    } | null>((closest, wall) => {
      const startX = wall.start[0] * options.scale;
      const startZ = wall.start[1] * options.scale;
      const endX = wall.end[0] * options.scale;
      const endZ = wall.end[1] * options.scale;
      const projected = projectPointToSegment2D(x, z, startX, startZ, endX, endZ);
      if (!closest || projected.distanceSq < closest.distanceSq) {
        return projected;
      }
      return closest;
    }, null);
    if (snapped) {
      x = snapped.x;
      z = snapped.z;
      nextRotationY = snapped.yaw;
    }
  }

  if (anchorType === "floor") {
    y = 0;
    supportAssetId = null;
  } else if (anchorType === "ceiling") {
    y = ceilingHeight;
    supportAssetId = null;
  } else if (anchorType === "wall") {
    const wallDefault = getDefaultAnchorHeight(anchorType, ceilingHeight);
    y =
      Number.isFinite(y) && y > 0
        ? Math.min(Math.max(y, 0.35), Math.max(0.35, ceilingHeight - 0.15))
        : wallDefault;
    supportAssetId = null;
  } else if (isSurfaceAnchorType(anchorType)) {
    const supportSurface = constrainToSupportingSurface(
      anchorType,
      [x, y, z],
      options.sceneAssets ?? [],
      {
        activeAssetId: options.activeAssetId,
        supportAssetId
      }
    );
    if (supportSurface) {
      [x, y, z] = supportSurface.position;
      supportAssetId = supportSurface.supportAssetId;
    } else {
      y = 0;
      supportAssetId = null;
    }
  } else {
    supportAssetId = null;
  }

  return {
    position: [x, y, z],
    rotation: [rotationX, nextRotationY, rotationZ],
    anchorType,
    supportAssetId
  };
}
