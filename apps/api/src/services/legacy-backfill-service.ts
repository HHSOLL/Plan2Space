import { supabaseService } from "./supabase";
import { getLatestSucceededFloorplan } from "../repositories/floorplans-repo";
import { getLatestVersion, getResultByFloorplanId } from "../repositories/results-repo";
import { buildProjectVersionCustomization, buildProjectVersionFloorPlan, createProjectVersionWithServiceRole } from "./project-version-service";

type LegacyProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  thumbnail_path: string | null;
  current_version_id: string | null;
  meta: Record<string, unknown> | null;
  source_layout_revision_id: string | null;
  created_at: string;
  updated_at: string;
};

type BackfillSource = "existing-version" | "floorplan-result" | "layout-revision" | "metadata-floorplan" | "none";

type BackfillTopology = {
  scale: number;
  scaleInfo?: Record<string, unknown>;
  walls: Array<Record<string, unknown>>;
  openings: Array<Record<string, unknown>>;
  floors: Array<Record<string, unknown>>;
};

type BackfillPlan = {
  source: BackfillSource;
  topology: BackfillTopology | null;
  message: string;
};

type BackfillFloor = {
  id: string;
  outline: [number, number][];
  materialId: string | null;
};

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toArrayRecords(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function toVec2(value: unknown, fallback: [number, number]): [number, number] {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return [x, y];
    }
  }
  return fallback;
}

function getPolygonPoints(value: unknown): [number, number][] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((point) => toVec2(point, [Number.NaN, Number.NaN]))
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  }
  const record = toRecord(value);
  if (!record) return [];
  return getPolygonPoints(record.polygon ?? record.points ?? record.outline ?? record.vertices);
}

function normalizeTopology(payload: Partial<BackfillTopology> & { scale?: number; scaleInfo?: Record<string, unknown> | undefined }) {
  return {
    scale: typeof payload.scale === "number" && payload.scale > 0 ? payload.scale : 1,
    scaleInfo: payload.scaleInfo,
    walls: Array.isArray(payload.walls) ? payload.walls : [],
    openings: Array.isArray(payload.openings) ? payload.openings : [],
    floors: Array.isArray(payload.floors) ? payload.floors : []
  } satisfies BackfillTopology;
}

function buildTopologyFromSceneJson(sceneJson: Record<string, unknown>, fallback: {
  wallCoordinates?: unknown[];
  roomPolygons?: unknown[];
  scale?: number;
}) {
  const walls =
    toArrayRecords(sceneJson.walls).length > 0
      ? toArrayRecords(sceneJson.walls).map((wall, index) => ({
          id: typeof wall.id === "string" ? wall.id : `legacy-wall-${index + 1}`,
          start: toVec2(wall.start ?? wall.a, [0, 0]),
          end: toVec2(wall.end ?? wall.b, [0, 0]),
          thickness: Number(wall.thickness ?? 0.12),
          height: Number(wall.height ?? 2.8)
        }))
      : toArrayRecords(fallback.wallCoordinates).map((wall, index) => ({
          id: typeof wall.id === "string" ? wall.id : `legacy-wall-${index + 1}`,
          start: toVec2(wall.start, [0, 0]),
          end: toVec2(wall.end, [0, 0]),
          thickness: Number(wall.thickness ?? 12),
          height: Number(wall.height ?? 2.8)
        }));

  const openings = toArrayRecords(sceneJson.openings).map((opening, index) => ({
    id: typeof opening.id === "string" ? opening.id : `legacy-opening-${index + 1}`,
    wallId: typeof opening.wallId === "string" ? opening.wallId : "",
    type: opening.type === "window" ? "window" : "door",
    offset: Number(opening.offset ?? 0),
    width: Number(opening.width ?? (opening.type === "window" ? 1.6 : 0.9)),
    height: Number(opening.height ?? (opening.type === "window" ? 1.2 : 2.1)),
    verticalOffset: typeof opening.verticalOffset === "number" ? opening.verticalOffset : undefined,
    sillHeight: typeof opening.sillHeight === "number" ? opening.sillHeight : undefined,
    isEntrance: Boolean(opening.isEntrance)
  }));

  const floors: BackfillFloor[] =
    toArrayRecords(sceneJson.floors).length > 0
      ? toArrayRecords(sceneJson.floors)
          .map((floor, index) => {
            const outline = getPolygonPoints(floor.outline ?? floor.polygon);
            if (outline.length < 3) return null;
            return {
              id: typeof floor.id === "string" ? floor.id : `legacy-floor-${index + 1}`,
              outline,
              materialId: typeof floor.materialId === "string" ? floor.materialId : null
            };
          })
          .filter((floor): floor is BackfillFloor => Boolean(floor))
      : toArrayRecords(fallback.roomPolygons)
          .map((room, index) => {
            const outline = getPolygonPoints(room.polygon);
            if (outline.length < 3) return null;
            return {
              id: typeof room.id === "string" ? `legacy-floor-${room.id}` : `legacy-floor-${index + 1}`,
              outline,
              materialId: null
            };
          })
          .filter((floor): floor is BackfillFloor => Boolean(floor));

  return normalizeTopology({
    scale: typeof sceneJson.scale === "number" ? sceneJson.scale : fallback.scale,
    scaleInfo: toRecord(sceneJson.scaleInfo) ?? undefined,
    walls,
    openings,
    floors
  });
}

function buildTopologyFromRevisionGeometry(revision: Record<string, unknown>) {
  const geometry = toRecord(revision.geometry_json) ?? {};
  const walls = toArrayRecords(geometry.walls).map((wall, index) => ({
    id: typeof wall.id === "string" ? wall.id : `revision-wall-${index + 1}`,
    start: (() => {
      const point = toVec2(wall.startMm, [0, 0]);
      return [point[0] / 1000, point[1] / 1000];
    })(),
    end: (() => {
      const point = toVec2(wall.endMm, [0, 0]);
      return [point[0] / 1000, point[1] / 1000];
    })(),
    thickness: Math.max(0.02, Number(wall.thicknessMm ?? 180) / 1000),
    height: 2.8
  }));

  const openings = toArrayRecords(geometry.openings).map((opening, index) => ({
    id: typeof opening.id === "string" ? opening.id : `revision-opening-${index + 1}`,
    wallId: typeof opening.wallId === "string" ? opening.wallId : "",
    type: opening.type === "window" ? "window" : "door",
    offset: Math.max(0, Number(opening.offsetMm ?? 0) / 1000),
    width: Math.max(0.2, Number(opening.widthMm ?? (opening.type === "window" ? 1200 : 900)) / 1000),
    height: Math.max(0.4, Number(opening.heightMm ?? (opening.type === "window" ? 1200 : 2100)) / 1000),
    verticalOffset: typeof opening.verticalOffsetMm === "number" ? Number(opening.verticalOffsetMm) / 1000 : undefined,
    sillHeight: typeof opening.sillHeightMm === "number" ? Number(opening.sillHeightMm) / 1000 : undefined,
    isEntrance: Boolean(opening.isEntrance)
  }));

  const roomFloors: BackfillFloor[] = toArrayRecords(geometry.rooms)
    .map((room, index) => {
      const outline = getPolygonPoints(room.polygonMm ?? room.polygon).map(([x, y]) => [x / 1000, y / 1000]);
      if (outline.length < 3) return null;
      return {
        id: typeof room.id === "string" ? `revision-floor-${room.id}` : `revision-floor-${index + 1}`,
        outline,
        materialId: null
      };
    })
    .filter((floor): floor is BackfillFloor => Boolean(floor));

  const scale = 1;
  const scaleRecord = toRecord(geometry.scale) ?? {};

  return normalizeTopology({
    scale,
    scaleInfo: {
      value: scale,
      source: typeof scaleRecord.source === "string" ? scaleRecord.source : "unknown",
      confidence: Number(scaleRecord.confidence ?? 0),
      evidence: {
        notes: typeof revision.id === "string" ? `Backfilled from layout revision ${revision.id}` : "Backfilled from layout revision"
      }
    },
    walls,
    openings,
    floors: roomFloors
  });
}

async function resolveRevisionById(revisionId: string) {
  const { data, error } = await supabaseService
    .from("layout_revisions")
    .select(
      "id, geometry_json, derived_scene_json, geometry_hash, topology_hash, room_graph_hash, derived_nav_json, derived_camera_json"
    )
    .eq("id", revisionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function buildBackfillPlanFromMetadata(project: LegacyProjectRow): BackfillPlan {
  const metadata = toRecord(project.meta);
  const floorPlan = toRecord(metadata?.floorPlan);
  if (!floorPlan) {
    return { source: "none", topology: null, message: "No compatible legacy source found" };
  }

  return {
    source: "metadata-floorplan",
    topology: normalizeTopology({
      scale: Number(floorPlan.scale ?? 1),
      scaleInfo: toRecord(floorPlan.scaleInfo) ?? undefined,
      walls: toArrayRecords(floorPlan.walls),
      openings: toArrayRecords(floorPlan.openings),
      floors: toArrayRecords(floorPlan.floors)
    }),
    message: "Legacy metadata floor plan"
  };
}

async function resolveBackfillPlan(project: LegacyProjectRow): Promise<BackfillPlan> {
  const latestVersion = await getLatestVersion(project.id);
  if (latestVersion?.id) {
    return {
      source: "existing-version",
      topology: null,
      message: "Latest version already exists"
    };
  }

  const floorplan = await getLatestSucceededFloorplan(project.id);
  if (floorplan?.id) {
    const result = await getResultByFloorplanId(floorplan.id);
    if (result) {
      return {
        source: "floorplan-result",
        topology: buildTopologyFromSceneJson((result.scene_json ?? {}) as Record<string, unknown>, {
          wallCoordinates: result.wall_coordinates,
          roomPolygons: result.room_polygons,
          scale: result.scale
        }),
        message: `Legacy floorplan result ${result.floorplan_id}`
      };
    }
  }

  if (project.source_layout_revision_id) {
    const revision = await resolveRevisionById(project.source_layout_revision_id);
    if (revision) {
      const derivedScene = toRecord(revision.derived_scene_json);
      return {
        source: "layout-revision",
        topology: derivedScene
          ? buildTopologyFromSceneJson(derivedScene, {
              scale: typeof derivedScene.scale === "number" ? derivedScene.scale : 1
            })
          : buildTopologyFromRevisionGeometry(revision),
        message: `Legacy layout revision ${project.source_layout_revision_id}`
      };
    }
  }

  return buildBackfillPlanFromMetadata(project);
}

export async function listLegacyBackfillCandidates(options: {
  limit?: number;
  projectId?: string;
}) {
  let query = supabaseService
    .from("projects")
    .select("id, owner_id, name, description, thumbnail_path, current_version_id, meta, source_layout_revision_id, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (options.projectId) {
    query = query.eq("id", options.projectId);
  } else {
    query = query.is("current_version_id", null).limit(options.limit ?? 200);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LegacyProjectRow[];
}

export async function ensureProjectCurrentVersion(projectId: string, versionId: string) {
  const { error } = await supabaseService
    .from("projects")
    .update({
      current_version_id: versionId,
      updated_at: new Date().toISOString()
    })
    .eq("id", projectId);

  if (error) throw error;
}

export async function backfillLegacyProjectVersion(project: LegacyProjectRow, dryRun = false) {
  const plan = await resolveBackfillPlan(project);
  if (plan.source === "existing-version") {
    const latestVersion = await getLatestVersion(project.id);
    if (latestVersion?.id && !project.current_version_id && !dryRun) {
      await ensureProjectCurrentVersion(project.id, latestVersion.id);
    }

    return {
      projectId: project.id,
      projectName: project.name,
      action: project.current_version_id ? "skipped-existing-version" : "set-current-version",
      source: plan.source,
      versionId: latestVersion?.id ?? null,
      message: plan.message
    };
  }

  if (!plan.topology || plan.topology.walls.length === 0) {
    return {
      projectId: project.id,
      projectName: project.name,
      action: "skipped-no-compatible-source",
      source: plan.source,
      versionId: null,
      message: plan.message
    };
  }

  if (dryRun) {
    return {
      projectId: project.id,
      projectName: project.name,
      action: "dry-run",
      source: plan.source,
      versionId: null,
      message: plan.message
    };
  }

  const floorPlan = buildProjectVersionFloorPlan(plan.topology);
  const customization = buildProjectVersionCustomization([], { wallIndex: 0, floorIndex: 0 });
  const version = await createProjectVersionWithServiceRole({
    projectId: project.id,
    createdBy: project.owner_id,
    message: `Legacy backfill · ${plan.message}`,
    floorPlan,
    customization,
    snapshotPath: project.thumbnail_path
  });

  if (version?.id && !project.current_version_id) {
    await ensureProjectCurrentVersion(project.id, version.id as string);
  }

  return {
    projectId: project.id,
    projectName: project.name,
    action: "backfilled",
    source: plan.source,
    versionId: (version?.id as string | undefined) ?? null,
    message: plan.message
  };
}
