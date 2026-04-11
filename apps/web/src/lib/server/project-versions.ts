import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../../../../../types/database";
import { deriveBlankRoomShell } from "../domain/room-shell";
import type { Floor, Opening, ScaleInfo, Wall } from "../stores/useSceneStore";

const DEFAULT_WALL_HEIGHT = 2.8;
const ASSET_ANCHOR_TYPES = new Set([
  "floor",
  "wall",
  "ceiling",
  "furniture_surface",
  "desk_surface",
  "shelf_surface"
]);

const AssetSummarySchema = z.object({
  totalAssets: z.number(),
  highlightedItems: z
    .array(
      z.object({
        catalogItemId: z.string().nullable(),
        assetId: z.string(),
        label: z.string(),
        category: z.string(),
        collection: z.string(),
        tone: z.enum(["sand", "olive", "slate", "ember"]),
        count: z.number()
      })
    )
    .default([]),
  collections: z
    .array(
      z.object({
        label: z.string(),
        count: z.number()
      })
    )
    .default([]),
  uncataloguedCount: z.number(),
  primaryTone: z.enum(["sand", "olive", "slate", "ember"]),
  primaryCollection: z.string().nullable()
});

const RoomShellSchema = z.object({
  scale: z.number(),
  scaleInfo: z.record(z.string(), z.unknown()).optional(),
  walls: z.array(z.record(z.string(), z.unknown())),
  openings: z.array(z.record(z.string(), z.unknown())),
  floors: z.array(z.record(z.string(), z.unknown())).default([]),
  ceilings: z.array(z.record(z.string(), z.unknown())).default([]),
  rooms: z.array(z.record(z.string(), z.unknown())).default([]),
  cameraAnchors: z.array(z.record(z.string(), z.unknown())).default([]),
  navGraph: z
    .object({
      nodes: z.array(z.record(z.string(), z.unknown())).default([]),
      edges: z.array(z.record(z.string(), z.unknown())).default([])
    })
    .default({ nodes: [], edges: [] }),
  entranceId: z.string().nullable().optional()
});

export const SaveVersionSchema = z.object({
  message: z.string().optional(),
  topology: z.object({
    scale: z.number(),
    scaleInfo: z.record(z.string(), z.unknown()).optional(),
    walls: z.array(z.record(z.string(), z.unknown())),
    openings: z.array(z.record(z.string(), z.unknown())),
    floors: z.array(z.record(z.string(), z.unknown())).optional()
  }),
  roomShell: RoomShellSchema.optional(),
  assets: z.array(z.record(z.string(), z.unknown())).default([]),
  materials: z.object({
    wallIndex: z.number(),
    floorIndex: z.number()
  }),
  lighting: z
    .object({
      ambientIntensity: z.number(),
      hemisphereIntensity: z.number(),
      directionalIntensity: z.number(),
      environmentBlur: z.number()
    })
    .optional(),
  thumbnailDataUrl: z.string().nullable().optional(),
  assetSummary: AssetSummarySchema.nullable().optional(),
  projectName: z.string().optional(),
  projectDescription: z.string().nullable().optional()
});

type SaveVersionPayload = z.infer<typeof SaveVersionSchema>;
type TopologyPayload = SaveVersionPayload["topology"];
type RoomShellPayload = NonNullable<SaveVersionPayload["roomShell"]>;
type MaterialsPayload = SaveVersionPayload["materials"];
type LightingPayload = NonNullable<SaveVersionPayload["lighting"]>;
type ProjectRow = Pick<Database["public"]["Tables"]["projects"]["Row"], "id" | "owner_id" | "meta" | "current_version_id">;
type ProjectVersionRow = Pick<
  Database["public"]["Tables"]["project_versions"]["Row"],
  "id" | "project_id" | "version" | "created_by" | "message" | "customization" | "snapshot_path" | "created_at" | "updated_at"
>;

const PROJECT_VERSION_SELECT =
  "id, project_id, version, created_by, message, customization, snapshot_path, created_at, updated_at";

export class ProjectVersionApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function resolveUploadBucket() {
  return process.env.FLOORPLAN_UPLOAD_BUCKET ?? process.env.NEXT_PUBLIC_FLOORPLAN_UPLOAD_BUCKET ?? "floor-plans";
}

function createPrivilegedSupabaseClient(userScopedSupabase: SupabaseClient<Database>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return userScopedSupabase;
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function normalizeAssetAnchor(value: unknown) {
  return typeof value === "string" && ASSET_ANCHOR_TYPES.has(value) ? value : "floor";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeScaleSource(value: unknown): ScaleInfo["source"] {
  if (value === "ocr_dimension" || value === "door_heuristic" || value === "user_measure" || value === "unknown") {
    return value;
  }
  return "unknown";
}

function toScaleInfo(value: unknown, fallbackValue: number): ScaleInfo {
  if (!isRecord(value)) {
    return {
      value: fallbackValue,
      source: "unknown",
      confidence: 0
    };
  }

  const numericValue = Number(value.value);
  const confidence = Number(value.confidence);

  return {
    value: Number.isFinite(numericValue) ? numericValue : fallbackValue,
    source: normalizeScaleSource(value.source),
    confidence: Number.isFinite(confidence) ? confidence : 0,
    evidence: isRecord(value.evidence) ? value.evidence : undefined
  };
}

function dataUrlToBuffer(dataUrl: string) {
  const [header, payload = ""] = dataUrl.split(",", 2);
  const mimeMatch = header?.match(/^data:([^;,]+)/);
  const mime = mimeMatch?.[1] ?? "image/png";
  const isBase64 = header?.includes(";base64");
  return {
    mime,
    buffer: Buffer.from(isBase64 ? payload : decodeURIComponent(payload), isBase64 ? "base64" : "utf8")
  };
}

function mimeToExtension(mime: string) {
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "bin";
}

function buildProjectVersionFloorPlan(topology: TopologyPayload) {
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

function buildRoomShell(topology: TopologyPayload, roomShell?: RoomShellPayload) {
  const scale = typeof roomShell?.scale === "number" ? roomShell.scale : topology.scale;
  const resolvedScaleInfo = toScaleInfo(roomShell?.scaleInfo ?? topology.scaleInfo, scale);
  const walls = Array.isArray(roomShell?.walls)
    ? (roomShell.walls as Array<Record<string, unknown>>)
    : (topology.walls as Array<Record<string, unknown>>);
  const openings = Array.isArray(roomShell?.openings)
    ? (roomShell.openings as Array<Record<string, unknown>>)
    : (topology.openings as Array<Record<string, unknown>>);
  const floors = Array.isArray(roomShell?.floors)
    ? (roomShell.floors as Array<Record<string, unknown>>)
    : Array.isArray(topology.floors)
      ? (topology.floors as Array<Record<string, unknown>>)
      : [];
  const derivedShell = deriveBlankRoomShell({
    scale,
    scaleInfo: resolvedScaleInfo,
    walls: walls as unknown as Wall[],
    openings: openings as unknown as Opening[],
    floors: floors as unknown as Floor[]
  });

  return {
    scale,
    scaleInfo: resolvedScaleInfo,
    walls,
    openings,
    floors,
    ceilings:
      Array.isArray(roomShell?.ceilings) && roomShell.ceilings.length > 0
        ? (roomShell.ceilings as Array<Record<string, unknown>>)
        : (derivedShell.ceilings as unknown as Array<Record<string, unknown>>),
    rooms:
      Array.isArray(roomShell?.rooms) && roomShell.rooms.length > 0
        ? (roomShell.rooms as Array<Record<string, unknown>>)
        : (derivedShell.rooms as unknown as Array<Record<string, unknown>>),
    cameraAnchors:
      Array.isArray(roomShell?.cameraAnchors) && roomShell.cameraAnchors.length > 0
        ? (roomShell.cameraAnchors as Array<Record<string, unknown>>)
        : (derivedShell.cameraAnchors as unknown as Array<Record<string, unknown>>),
    navGraph: {
      nodes:
        Array.isArray(roomShell?.navGraph?.nodes) && roomShell.navGraph.nodes.length > 0
          ? (roomShell.navGraph.nodes as Array<Record<string, unknown>>)
          : (derivedShell.navGraph.nodes as unknown as Array<Record<string, unknown>>),
      edges:
        Array.isArray(roomShell?.navGraph?.edges) && roomShell.navGraph.edges.length > 0
          ? (roomShell.navGraph.edges as Array<Record<string, unknown>>)
          : (derivedShell.navGraph.edges as unknown as Array<Record<string, unknown>>)
    },
    entranceId:
      typeof roomShell?.entranceId === "string" && roomShell.entranceId.length > 0
        ? roomShell.entranceId
        : derivedShell.entranceId
  };
}

function resolveLightingSettings(lighting?: Partial<LightingPayload>): LightingPayload {
  const fallbackLighting: LightingPayload = {
    ambientIntensity: 0.35,
    hemisphereIntensity: 0.4,
    directionalIntensity: 1.05,
    environmentBlur: 0.2
  };

  return {
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
  };
}

function buildSceneDocument(
  topology: TopologyPayload,
  roomShell: RoomShellPayload | undefined,
  assets: Array<Record<string, unknown>>,
  materials: MaterialsPayload,
  lighting?: Partial<LightingPayload>
) {
  const resolvedRoomShell = buildRoomShell(topology, roomShell);
  const normalizedLighting = resolveLightingSettings(lighting);

  return {
    schemaVersion: 1,
    roomShell: resolvedRoomShell,
    nodes: assets.map((asset) => {
      const anchorType = normalizeAssetAnchor(asset.anchorType);
      return {
        id: asset.id,
        assetId: asset.assetId,
        catalogItemId: typeof asset.catalogItemId === "string" && asset.catalogItemId.length > 0 ? asset.catalogItemId : null,
        anchorType,
        supportAssetId:
          typeof asset.supportAssetId === "string" && asset.supportAssetId.length > 0 ? asset.supportAssetId : null,
        supportProfile: asset.supportProfile ?? null,
        position: asset.position,
        rotation: asset.rotation,
        scale: asset.scale,
        materialId: asset.materialId ?? null,
        metadata: {
          anchorType,
          ...(typeof asset.supportAssetId === "string" && asset.supportAssetId.length > 0
            ? { supportAssetId: asset.supportAssetId }
            : {}),
          ...(asset.supportProfile && typeof asset.supportProfile === "object"
            ? { supportProfile: asset.supportProfile }
            : {}),
          ...(typeof asset.catalogItemId === "string" && asset.catalogItemId.length > 0
            ? { catalogItemId: asset.catalogItemId }
            : {})
        }
      };
    }),
    materialOverride: {
      wallMaterialIndex: materials.wallIndex,
      floorMaterialIndex: materials.floorIndex
    },
    lighting: normalizedLighting
  };
}

function buildProjectVersionCustomization(
  topology: TopologyPayload,
  roomShell: RoomShellPayload | undefined,
  assets: Array<Record<string, unknown>>,
  materials: MaterialsPayload,
  lighting?: Partial<LightingPayload>
) {
  const normalizedLighting = resolveLightingSettings(lighting);
  const sceneDocument = buildSceneDocument(topology, roomShell, assets, materials, lighting);

  return {
    schemaVersion: 1,
    furniture: assets.map((asset) => {
      const anchorType = normalizeAssetAnchor(asset.anchorType);
      return {
        id: asset.id,
        modelId: asset.assetId,
        anchor: anchorType,
        supportAssetId:
          typeof asset.supportAssetId === "string" && asset.supportAssetId.length > 0 ? asset.supportAssetId : null,
        position: asset.position,
        rotation: asset.rotation,
        scale: asset.scale,
        metadata: {
          path: asset.assetId,
          anchorType,
          ...(typeof asset.supportAssetId === "string" && asset.supportAssetId.length > 0
            ? { supportAssetId: asset.supportAssetId }
            : {}),
          ...(asset.supportProfile && typeof asset.supportProfile === "object"
            ? { supportProfile: asset.supportProfile }
            : {}),
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
      lighting: normalizedLighting
    },
    sceneDocument
  };
}

async function requireOwnedProject(
  supabase: SupabaseClient<Database>,
  projectId: string,
  ownerId: string
): Promise<ProjectRow> {
  const projectLookup = await supabase
    .from("projects")
    .select("id, owner_id, meta, current_version_id")
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (projectLookup.error) {
    throw new ProjectVersionApiError(500, projectLookup.error.message);
  }
  if (!projectLookup.data) {
    throw new ProjectVersionApiError(404, "Project not found.");
  }

  return projectLookup.data;
}

export async function createProjectVersion(
  supabase: SupabaseClient<Database>,
  input: {
    projectId: string;
    ownerId: string;
    payload: SaveVersionPayload;
  }
) {
  const project = await requireOwnedProject(supabase, input.projectId, input.ownerId);
  const privilegedSupabase = createPrivilegedSupabaseClient(supabase);
  const payload = input.payload;

  if (payload.projectName || payload.projectDescription !== undefined) {
    const updateProject = await privilegedSupabase
      .from("projects")
      .update({
        ...(payload.projectName ? { name: payload.projectName } : {}),
        ...(payload.projectDescription !== undefined ? { description: payload.projectDescription } : {})
      })
      .eq("id", input.projectId)
      .eq("owner_id", input.ownerId);

    if (updateProject.error) {
      throw new ProjectVersionApiError(500, updateProject.error.message);
    }
  }

  let snapshotPath: string | null = null;
  const nextMeta: Record<string, unknown> = {
    ...((project.meta as Record<string, unknown> | null) ?? {})
  };

  if (payload.thumbnailDataUrl) {
    const parsed = dataUrlToBuffer(payload.thumbnailDataUrl);
    snapshotPath = `${input.ownerId}/${input.projectId}/thumbnail-${Date.now()}.${mimeToExtension(parsed.mime)}`;
    const upload = await privilegedSupabase.storage.from(resolveUploadBucket()).upload(snapshotPath, parsed.buffer, {
      contentType: parsed.mime,
      upsert: true
    });

    if (upload.error) {
      throw new ProjectVersionApiError(500, upload.error.message);
    }

    nextMeta.thumbnailBucket = resolveUploadBucket();
  }

  if (payload.assetSummary !== undefined) {
    nextMeta.assetSummary = payload.assetSummary;
  }

  if (snapshotPath || payload.assetSummary !== undefined) {
    const updateSnapshotMeta = await privilegedSupabase
      .from("projects")
      .update({
        ...(snapshotPath ? { thumbnail_path: snapshotPath } : {}),
        meta: nextMeta
      })
      .eq("id", input.projectId)
      .eq("owner_id", input.ownerId);

    if (updateSnapshotMeta.error) {
      throw new ProjectVersionApiError(500, updateSnapshotMeta.error.message);
    }
  }

  const floorPlan = buildProjectVersionFloorPlan({
    scale: payload.topology.scale,
    scaleInfo: payload.topology.scaleInfo,
    walls: payload.topology.walls as Array<Record<string, unknown>>,
    openings: payload.topology.openings as Array<Record<string, unknown>>,
    floors: Array.isArray(payload.topology.floors) ? (payload.topology.floors as Array<Record<string, unknown>>) : []
  });

  const customization = buildProjectVersionCustomization(
    payload.topology,
    payload.roomShell,
    payload.assets as Array<Record<string, unknown>>,
    payload.materials,
    payload.lighting
  );

  const createVersion = await supabase.rpc("create_project_version", {
    p_project_id: input.projectId,
    p_message: payload.message ?? "Manual save",
    p_floor_plan:
      floorPlan as unknown as Database["public"]["Functions"]["create_project_version"]["Args"]["p_floor_plan"],
    p_customization:
      customization as Database["public"]["Functions"]["create_project_version"]["Args"]["p_customization"],
    p_snapshot_path: snapshotPath
  });

  if (createVersion.error) {
    throw new ProjectVersionApiError(500, createVersion.error.message);
  }

  return createVersion.data;
}

function clampLimit(limit: number) {
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function clampOffset(offset: number) {
  return Math.max(Math.trunc(offset), 0);
}

export async function listProjectVersions(
  supabase: SupabaseClient<Database>,
  input: {
    projectId: string;
    ownerId: string;
    limit?: number;
    offset?: number;
  }
) {
  await requireOwnedProject(supabase, input.projectId, input.ownerId);

  const limit = clampLimit(input.limit ?? 20);
  const offset = clampOffset(input.offset ?? 0);

  const lookup = await supabase
    .from("project_versions")
    .select(PROJECT_VERSION_SELECT, { count: "exact" })
    .eq("project_id", input.projectId)
    .order("version", { ascending: false })
    .range(offset, offset + limit - 1);

  if (lookup.error) {
    throw new ProjectVersionApiError(500, lookup.error.message);
  }

  const items = (lookup.data ?? []) as ProjectVersionRow[];
  const total = lookup.count ?? 0;
  const nextCursor = total > offset + items.length ? String(offset + items.length) : null;

  return {
    items,
    total,
    nextCursor
  };
}

export async function getLatestProjectVersion(
  supabase: SupabaseClient<Database>,
  input: {
    projectId: string;
    ownerId: string;
  }
) {
  const project = await requireOwnedProject(supabase, input.projectId, input.ownerId);

  if (project.current_version_id) {
    const pinnedLookup = await supabase
      .from("project_versions")
      .select(PROJECT_VERSION_SELECT)
      .eq("project_id", input.projectId)
      .eq("id", project.current_version_id)
      .maybeSingle();

    if (pinnedLookup.error) {
      throw new ProjectVersionApiError(500, pinnedLookup.error.message);
    }
    if (pinnedLookup.data) {
      return pinnedLookup.data as ProjectVersionRow;
    }
  }

  const lookup = await supabase
    .from("project_versions")
    .select(PROJECT_VERSION_SELECT)
    .eq("project_id", input.projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookup.error) {
    throw new ProjectVersionApiError(500, lookup.error.message);
  }

  return (lookup.data as ProjectVersionRow | null) ?? null;
}
