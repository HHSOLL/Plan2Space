import { supabaseService } from "./supabase";

const DEFAULT_WALL_HEIGHT = 2.8;
const ASSET_ANCHOR_TYPES = new Set([
  "floor",
  "wall",
  "ceiling",
  "furniture_surface",
  "desk_surface",
  "shelf_surface"
]);

type TopologyPayload = {
  scale: number;
  scaleInfo?: Record<string, unknown>;
  walls: Array<Record<string, unknown>>;
  openings: Array<Record<string, unknown>>;
  floors?: Array<Record<string, unknown>>;
};

type MaterialsPayload = {
  wallIndex: number;
  floorIndex: number;
};

type LightingPayload = {
  ambientIntensity: number;
  hemisphereIntensity: number;
  directionalIntensity: number;
  environmentBlur: number;
};

type AssetPayload = Array<Record<string, unknown>>;

function normalizeAssetAnchor(value: unknown) {
  return typeof value === "string" && ASSET_ANCHOR_TYPES.has(value) ? value : "floor";
}

export function buildProjectVersionFloorPlan(topology: TopologyPayload) {
  const scale = topology.scale;
  const walls = topology.walls;
  const openings = topology.openings;
  const floors = Array.isArray(topology.floors) ? topology.floors : [];
  const wallHeight = walls.reduce((max, wall) => Math.max(max, Number(wall.height) || DEFAULT_WALL_HEIGHT), DEFAULT_WALL_HEIGHT);
  const wallThickness = walls.length > 0 ? Math.max(0.02, Number(walls[0]?.thickness ?? 0.2) * scale) : 0.2;

  return {
    schemaVersion: 1,
    unit: "m",
    coordSystem: {
      plane: "xz",
      upAxis: "y"
    },
    params: {
      wallHeight,
      wallThickness,
      ceilingHeight: wallHeight
    },
    walls: walls.map((wall) => ({
      id: wall.id,
      a: [Number(wall.start?.[0] ?? 0) * scale, Number(wall.start?.[1] ?? 0) * scale],
      b: [Number(wall.end?.[0] ?? 0) * scale, Number(wall.end?.[1] ?? 0) * scale],
      thickness: Number(wall.thickness ?? 12) * scale,
      height: Number(wall.height ?? wallHeight)
    })),
    openings: openings.map((opening) => ({
      id: opening.id,
      wallId: opening.wallId,
      type: opening.type,
      offset: Number(opening.offset ?? 0) * scale,
      width: Number(opening.width ?? 90) * scale,
      height: Number(opening.height ?? 210) * scale,
      isEntrance: Boolean(opening.isEntrance),
      verticalOffset:
        typeof opening.verticalOffset === "number" ? Number(opening.verticalOffset) * scale : undefined,
      sillHeight: typeof opening.sillHeight === "number" ? Number(opening.sillHeight) * scale : undefined
    })),
    source: {
      kind: "manual_2d_editor",
      raw: topology.scaleInfo
        ? {
            scaleInfo: topology.scaleInfo
          }
        : undefined
    },
    floors: floors.map((floor) => ({
      id: floor.id,
      outline: Array.isArray(floor.outline)
        ? floor.outline.map((point: unknown) => [
            Number((point as [number, number])?.[0] ?? 0) * scale,
            Number((point as [number, number])?.[1] ?? 0) * scale
          ])
        : [],
      materialId: typeof floor.materialId === "string" ? floor.materialId : null
    }))
  };
}

export function buildProjectVersionCustomization(
  assets: AssetPayload,
  materials: MaterialsPayload,
  lighting?: Partial<LightingPayload>
) {
  const fallbackLighting: LightingPayload = {
    ambientIntensity: 0.35,
    hemisphereIntensity: 0.4,
    directionalIntensity: 1.05,
    environmentBlur: 0.2
  };
  return {
    schemaVersion: 1,
    furniture: assets.map((asset: Record<string, any>) => {
      const anchorType = normalizeAssetAnchor(asset.anchorType);
      return {
        id: asset.id,
        modelId: asset.assetId,
        anchor: anchorType,
        position: asset.position,
        rotation: asset.rotation,
        scale: asset.scale,
        metadata: {
          path: asset.assetId,
          anchorType,
          ...(typeof asset.catalogItemId === "string" && asset.catalogItemId.length > 0
            ? { catalogItemId: asset.catalogItemId }
            : {})
        }
      };
    }),
    surfaceMaterials: {},
    defaults: {
      floor: {
        materialSkuId: `floor:${materials.floorIndex}`
      },
      wall: {
        materialSkuId: `wall:${materials.wallIndex}`
      },
      lighting: {
        ambientIntensity:
          typeof lighting?.ambientIntensity === "number"
            ? lighting.ambientIntensity
            : fallbackLighting.ambientIntensity,
        hemisphereIntensity:
          typeof lighting?.hemisphereIntensity === "number"
            ? lighting.hemisphereIntensity
            : fallbackLighting.hemisphereIntensity,
        directionalIntensity:
          typeof lighting?.directionalIntensity === "number"
            ? lighting.directionalIntensity
            : fallbackLighting.directionalIntensity,
        environmentBlur:
          typeof lighting?.environmentBlur === "number"
            ? lighting.environmentBlur
            : fallbackLighting.environmentBlur
      }
    }
  };
}

export async function createProjectVersionWithServiceRole(payload: {
  projectId: string;
  createdBy?: string | null;
  message?: string | null;
  floorPlan: Record<string, unknown>;
  customization: Record<string, unknown>;
  snapshotPath?: string | null;
}) {
  const latestVersion = await supabaseService
    .from("project_versions")
    .select("version")
    .eq("project_id", payload.projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestVersion.error) throw latestVersion.error;

  const nextVersion = (latestVersion.data?.version ?? 0) + 1;
  const insert = await supabaseService
    .from("project_versions")
    .insert({
      project_id: payload.projectId,
      version: nextVersion,
      created_by: payload.createdBy ?? null,
      message: payload.message ?? null,
      floor_plan: payload.floorPlan,
      customization: payload.customization,
      snapshot_path: payload.snapshotPath ?? null
    })
    .select("id, project_id, version, created_by, message, floor_plan, customization, snapshot_path, created_at, updated_at")
    .single();

  if (insert.error) throw insert.error;

  const updateProject = await supabaseService
    .from("projects")
    .update({
      current_version_id: insert.data.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", payload.projectId);

  if (updateProject.error) {
    await supabaseService.from("project_versions").delete().eq("id", insert.data.id);
    throw updateProject.error;
  }

  return insert.data;
}
