import { normalizeSceneAnchorType, type SceneAnchorType } from "./anchor-types";

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
  position: [number, number, number];
  scale: [number, number, number];
  anchorType?: SceneAnchorType;
};

type Position = [number, number, number];
type Rotation = [number, number, number];

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

function constrainToSupportingSurface(
  anchorType: SceneAnchorType,
  position: Position,
  sceneAssets: AnchorAssetLike[],
  activeAssetId?: string
) {
  const [x, y, z] = position;
  const supportCandidates = sceneAssets.filter((asset) => {
    if (asset.id === activeAssetId) return false;
    if (asset.anchorType && asset.anchorType !== "floor" && asset.anchorType !== "wall") return false;
    return matchesSupportCandidate(anchorType, asset.assetId);
  });

  if (supportCandidates.length === 0) {
    return null;
  }

  const picked = supportCandidates.reduce<{
    asset: AnchorAssetLike;
    distanceSq: number;
    width: number;
    depth: number;
    topY: number;
  } | null>((closest, candidate) => {
    const base = inferAssetBounds(candidate.assetId);
    const scale = getScaleMagnitude(candidate.scale);
    const width = base.width * scale.x;
    const depth = base.depth * scale.z;
    const height = base.height * scale.y;
    const distanceSq = (candidate.position[0] - x) ** 2 + (candidate.position[2] - z) ** 2;
    const next = {
      asset: candidate,
      distanceSq,
      width,
      depth,
      topY: candidate.position[1] + height * 0.5
    };
    if (!closest || next.distanceSq < closest.distanceSq) {
      return next;
    }
    return closest;
  }, null);

  if (!picked) return null;

  const marginX = Math.min(0.08, picked.width * 0.2);
  const marginZ = Math.min(0.08, picked.depth * 0.2);
  const clampedX = Math.min(
    picked.asset.position[0] + picked.width * 0.5 - marginX,
    Math.max(picked.asset.position[0] - picked.width * 0.5 + marginX, x)
  );
  const clampedZ = Math.min(
    picked.asset.position[2] + picked.depth * 0.5 - marginZ,
    Math.max(picked.asset.position[2] - picked.depth * 0.5 + marginZ, z)
  );
  const hoverOffset = anchorType === "shelf_surface" ? 0.05 : 0.03;
  return {
    position: [clampedX, Math.max(y, picked.topY + hoverOffset), clampedZ] as Position
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
} {
  const anchorType = normalizeSceneAnchorType(input.anchorType);
  const ceilingHeight = resolveCeilingHeight(options.walls, options.ceilings);

  let [x, y, z] = input.position;
  const [rotationX, rotationY, rotationZ] = input.rotation;
  let nextRotationY = rotationY;

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
  } else if (anchorType === "ceiling") {
    y = ceilingHeight;
  } else if (anchorType === "wall") {
    const wallDefault = getDefaultAnchorHeight(anchorType, ceilingHeight);
    y =
      Number.isFinite(y) && y > 0
        ? Math.min(Math.max(y, 0.35), Math.max(0.35, ceilingHeight - 0.15))
        : wallDefault;
  } else {
    const supportSurface = constrainToSupportingSurface(
      anchorType,
      [x, y, z],
      options.sceneAssets ?? [],
      options.activeAssetId
    );
    if (supportSurface) {
      [x, y, z] = supportSurface.position;
    }
    const defaultHeight = getDefaultAnchorHeight(anchorType, ceilingHeight);
    y = Number.isFinite(y) && y > 0 ? y : defaultHeight;
  }

  return {
    position: [x, y, z],
    rotation: [rotationX, nextRotationY, rotationZ],
    anchorType
  };
}
