import { normalizeSceneAnchorType, type SceneAnchorType } from "./anchor-types";

export type SupportAnchorType = Extract<
  SceneAnchorType,
  "desk_surface" | "shelf_surface" | "furniture_surface"
>;

export type AssetSupportSurface = {
  id: string;
  anchorTypes: SupportAnchorType[];
  center: [number, number];
  size: [number, number];
  top: number;
  margin?: [number, number];
};

export type AssetSupportProfile = {
  surfaces: AssetSupportSurface[];
};

type SupportProfileDescriptor = {
  catalogItemId?: string | null;
  assetId: string;
  label?: string;
  category?: string;
  description?: string;
};

const SUPPORT_ANCHOR_TYPES: SupportAnchorType[] = [
  "desk_surface",
  "shelf_surface",
  "furniture_surface"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSupportAnchorType(value: unknown): value is SupportAnchorType {
  return typeof value === "string" && SUPPORT_ANCHOR_TYPES.includes(normalizeSceneAnchorType(value) as SupportAnchorType);
}

function toNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeAnchorTypes(value: unknown) {
  const anchorTypes = Array.isArray(value)
    ? value.map((entry) => normalizeSceneAnchorType(entry)).filter(isSupportAnchorType)
    : [];
  return anchorTypes.length > 0 ? anchorTypes : null;
}

function createSurface(
  id: string,
  anchorTypes: SupportAnchorType[],
  size: [number, number],
  top: number,
  options?: {
    center?: [number, number];
    margin?: [number, number];
  }
): AssetSupportSurface {
  return {
    id,
    anchorTypes,
    size,
    top,
    center: options?.center ?? [0, 0],
    margin: options?.margin
  };
}

function createProfile(surfaces: AssetSupportSurface[]): AssetSupportProfile {
  return { surfaces };
}

export function normalizeAssetSupportProfile(value: unknown): AssetSupportProfile | null {
  if (!isRecord(value) || !Array.isArray(value.surfaces)) {
    return null;
  }

  const surfaces = value.surfaces
    .map<AssetSupportSurface | null>((surface, index) => {
      if (!isRecord(surface)) return null;
      const anchorTypes = normalizeAnchorTypes(surface.anchorTypes);
      if (!anchorTypes) return null;
      const sizeValue = Array.isArray(surface.size) ? surface.size : [surface.width, surface.depth];
      if (!Array.isArray(sizeValue) || sizeValue.length < 2) {
        return null;
      }
      const width = toNumber(sizeValue[0], 0);
      const depth = toNumber(sizeValue[1], 0);
      if (width <= 0 || depth <= 0) {
        return null;
      }
      const centerValue = Array.isArray(surface.center) ? surface.center : [surface.centerX, surface.centerZ];
      const marginValue = Array.isArray(surface.margin) ? surface.margin : [surface.marginX, surface.marginZ];
      return {
        id: typeof surface.id === "string" && surface.id.length > 0 ? surface.id : `surface-${index + 1}`,
        anchorTypes,
        center:
          Array.isArray(centerValue) && centerValue.length >= 2
            ? [toNumber(centerValue[0], 0), toNumber(centerValue[1], 0)]
            : [0, 0],
        size: [width, depth],
        top: toNumber(surface.top, 0),
        margin:
          Array.isArray(marginValue) && marginValue.length >= 2
            ? [Math.max(0, toNumber(marginValue[0], 0)), Math.max(0, toNumber(marginValue[1], 0))]
            : undefined
      };
    })
    .filter((surface): surface is AssetSupportSurface => Boolean(surface));

  return surfaces.length > 0 ? { surfaces } : null;
}

export function inferAssetSupportProfile(descriptor: SupportProfileDescriptor): AssetSupportProfile | null {
  const haystack = [
    descriptor.catalogItemId ?? "",
    descriptor.assetId,
    descriptor.label ?? "",
    descriptor.category ?? "",
    descriptor.description ?? ""
  ]
    .join(" ")
    .toLowerCase();

  if (haystack.includes("desk") || haystack.includes("workbench") || haystack.includes("dining table")) {
    return createProfile([
      createSurface("desk-top", ["desk_surface", "furniture_surface"], [1.25, 0.68], 0.75, {
        margin: [0.09, 0.08]
      })
    ]);
  }

  if (
    haystack.includes("table") ||
    haystack.includes("coffee table") ||
    haystack.includes("side table")
  ) {
    return createProfile([
      createSurface("table-top", ["desk_surface", "furniture_surface"], [1.05, 0.62], 0.72, {
        margin: [0.08, 0.07]
      })
    ]);
  }

  if (haystack.includes("nightstand")) {
    return createProfile([
      createSurface("nightstand-top", ["furniture_surface"], [0.5, 0.38], 0.68, {
        margin: [0.05, 0.05]
      })
    ]);
  }

  if (
    haystack.includes("dresser") ||
    haystack.includes("commode") ||
    haystack.includes("drawer") ||
    haystack.includes("cabinet") ||
    haystack.includes("console")
  ) {
    return createProfile([
      createSurface("casework-top", ["furniture_surface"], [0.88, 0.4], 0.84, {
        margin: [0.07, 0.05]
      })
    ]);
  }

  if (haystack.includes("cart")) {
    return createProfile([
      createSurface("cart-top", ["furniture_surface"], [0.72, 0.42], 0.86, {
        margin: [0.06, 0.05]
      })
    ]);
  }

  if (haystack.includes("shelf") || haystack.includes("shelves") || haystack.includes("bookcase") || haystack.includes("rack")) {
    return createProfile([
      createSurface("shelf-upper", ["shelf_surface"], [0.82, 0.28], 1.2, {
        margin: [0.06, 0.04]
      }),
      createSurface("shelf-top", ["furniture_surface"], [0.9, 0.32], 1.72, {
        margin: [0.07, 0.05]
      })
    ]);
  }

  return null;
}

export function resolveAssetSupportProfile(
  descriptor: SupportProfileDescriptor & { supportProfile?: AssetSupportProfile | null }
): AssetSupportProfile | null {
  return normalizeAssetSupportProfile(descriptor.supportProfile) ?? inferAssetSupportProfile(descriptor);
}
