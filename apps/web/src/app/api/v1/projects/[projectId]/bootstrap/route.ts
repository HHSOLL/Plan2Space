import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { mapProjectVersionToSceneDocument } from "../../../../../../lib/domain/scene-document";
import { getProjectByOwner, ProjectApiError } from "../../../../../../lib/server/projects";
import {
  getLatestProjectVersion,
  ProjectVersionApiError
} from "../../../../../../lib/server/project-versions";
import { ShareApiError, requireAuthenticatedUserId } from "../../../../../../lib/server/shares";
import { createSupabaseServerClient } from "../../../../../../lib/supabase/server";

type BootstrapSource = "current_version" | "latest_version" | "revision_layout" | "none";

type LayoutRevisionRow = {
  id: string;
  scope: string | null;
  verification_status: string | null;
  created_from_intake_session_id: string | null;
  geometry_json: unknown;
  derived_scene_json: unknown;
  derived_nav_json: unknown;
  derived_camera_json: unknown;
};

const DEFAULT_LIGHTING = {
  ambientIntensity: 0.35,
  hemisphereIntensity: 0.4,
  directionalIntensity: 1.05,
  environmentBlur: 0.2
};

const DEFAULT_SCALE_INFO = {
  value: 1,
  source: "unknown",
  confidence: 0
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toErrorResponse(error: unknown) {
  if (error instanceof ProjectApiError || error instanceof ProjectVersionApiError || error instanceof ShareApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toArrayRecords(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
  );
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

function getScaleInfo(value: unknown, revisionId: string) {
  const record = toRecord(value);
  if (!record) {
    return {
      ...DEFAULT_SCALE_INFO,
      evidence: {
        notes: `Bootstrapped from layout revision ${revisionId}`
      }
    };
  }

  return {
    value: typeof record.value === "number" && record.value > 0 ? record.value : DEFAULT_SCALE_INFO.value,
    source:
      record.source === "ocr_dimension" ||
      record.source === "door_heuristic" ||
      record.source === "user_measure" ||
      record.source === "unknown"
        ? record.source
        : "unknown",
    confidence: typeof record.confidence === "number" ? record.confidence : 0,
    evidence: toRecord(record.evidence) ?? {
      notes: `Bootstrapped from layout revision ${revisionId}`
    }
  };
}

function buildSceneDocumentFromLayoutRevision(revision: LayoutRevisionRow) {
  type SceneFloor = {
    id: string;
    outline: [number, number][];
    materialId: string | null;
  };

  const derivedScene = toRecord(revision.derived_scene_json);
  const geometry = toRecord(revision.geometry_json) ?? {};
  const derivedNav = toRecord(revision.derived_nav_json) ?? {};
  const derivedCamera = toRecord(revision.derived_camera_json);

  const wallsFromDerived = toArrayRecords(derivedScene?.walls).map((wall, index) => ({
    id: typeof wall.id === "string" ? wall.id : `revision-wall-${index + 1}`,
    start: toVec2(wall.start ?? wall.a, [0, 0]),
    end: toVec2(wall.end ?? wall.b, [0, 0]),
    thickness: Number(wall.thickness ?? 0.16),
    height: Number(wall.height ?? 2.8),
    type: typeof wall.type === "string" ? wall.type : "exterior"
  }));
  const wallsFromGeometry = toArrayRecords(geometry.walls).map((wall, index) => ({
    id: typeof wall.id === "string" ? wall.id : `revision-wall-${index + 1}`,
    start: (() => {
      const point = toVec2(wall.startMm ?? wall.start, [0, 0]);
      return [point[0] / 1000, point[1] / 1000];
    })(),
    end: (() => {
      const point = toVec2(wall.endMm ?? wall.end, [0, 0]);
      return [point[0] / 1000, point[1] / 1000];
    })(),
    thickness: Math.max(0.02, Number(wall.thicknessMm ?? wall.thickness ?? 160) / 1000),
    height: Number(wall.height ?? 2.8),
    type: typeof wall.type === "string" ? wall.type : "exterior"
  }));
  const walls = wallsFromDerived.length > 0 ? wallsFromDerived : wallsFromGeometry;

  const openingsFromDerived = toArrayRecords(derivedScene?.openings).map((opening, index) => ({
    id: typeof opening.id === "string" ? opening.id : `revision-opening-${index + 1}`,
    wallId: typeof opening.wallId === "string" ? opening.wallId : "",
    type: opening.type === "window" ? "window" : "door",
    offset: Number(opening.offset ?? 0),
    width: Number(opening.width ?? (opening.type === "window" ? 1.6 : 0.9)),
    height: Number(opening.height ?? (opening.type === "window" ? 1.2 : 2.1)),
    verticalOffset: typeof opening.verticalOffset === "number" ? opening.verticalOffset : undefined,
    sillHeight: typeof opening.sillHeight === "number" ? opening.sillHeight : undefined,
    isEntrance: Boolean(opening.isEntrance)
  }));
  const openingsFromGeometry = toArrayRecords(geometry.openings).map((opening, index) => ({
    id: typeof opening.id === "string" ? opening.id : `revision-opening-${index + 1}`,
    wallId: typeof opening.wallId === "string" ? opening.wallId : "",
    type: opening.type === "window" ? "window" : "door",
    offset: Math.max(0, Number(opening.offsetMm ?? opening.offset ?? 0) / 1000),
    width: Math.max(0.2, Number(opening.widthMm ?? opening.width ?? (opening.type === "window" ? 1200 : 900)) / 1000),
    height: Math.max(0.4, Number(opening.heightMm ?? opening.height ?? (opening.type === "window" ? 1200 : 2100)) / 1000),
    verticalOffset:
      typeof opening.verticalOffsetMm === "number"
        ? Number(opening.verticalOffsetMm) / 1000
        : typeof opening.verticalOffset === "number"
          ? opening.verticalOffset
          : undefined,
    sillHeight:
      typeof opening.sillHeightMm === "number"
        ? Number(opening.sillHeightMm) / 1000
        : typeof opening.sillHeight === "number"
          ? opening.sillHeight
          : undefined,
    isEntrance: Boolean(opening.isEntrance)
  }));
  const openings = openingsFromDerived.length > 0 ? openingsFromDerived : openingsFromGeometry;

  const floorsFromDerived: SceneFloor[] = toArrayRecords(derivedScene?.floors)
    .map((floor, index) => {
      const outline = getPolygonPoints(floor.outline ?? floor.polygon);
      if (outline.length < 3) return null;
      return {
        id: typeof floor.id === "string" ? floor.id : `revision-floor-${index + 1}`,
        outline,
        materialId: typeof floor.materialId === "string" ? floor.materialId : null
      };
    })
    .filter((floor): floor is SceneFloor => floor !== null);
  const floorsFromGeometry: SceneFloor[] = toArrayRecords(geometry.rooms)
    .map((room, index) => {
      const outline = getPolygonPoints(room.polygonMm ?? room.polygon).map(([x, y]) => [x / 1000, y / 1000]);
      if (outline.length < 3) return null;
      return {
        id: typeof room.id === "string" ? `revision-floor-${room.id}` : `revision-floor-${index + 1}`,
        outline,
        materialId: null
      };
    })
    .filter((floor): floor is SceneFloor => floor !== null);
  const floors = floorsFromDerived.length > 0 ? floorsFromDerived : floorsFromGeometry;

  const rooms = toArrayRecords(derivedScene?.rooms);
  const ceilings = toArrayRecords(derivedScene?.ceilings);
  const navGraphCandidate = toRecord(derivedScene?.navGraph) ?? derivedNav;
  const cameraAnchorsCandidate = Array.isArray(derivedCamera?.anchors)
    ? toArrayRecords(derivedCamera?.anchors)
    : toArrayRecords(derivedScene?.cameraAnchors ?? derivedCamera);
  const scale = typeof derivedScene?.scale === "number" && derivedScene.scale > 0 ? derivedScene.scale : 1;
  const scaleInfo = getScaleInfo(derivedScene?.scaleInfo, revision.id);
  const entranceId =
    openings.find((opening) => Boolean(opening.isEntrance) && typeof opening.id === "string")?.id ?? null;

  if (walls.length === 0) {
    return null;
  }

  return {
    schemaVersion: 1,
    roomShell: {
      scale,
      scaleInfo,
      walls,
      openings,
      floors,
      ceilings,
      rooms,
      cameraAnchors: cameraAnchorsCandidate,
      navGraph: {
        nodes: toArrayRecords(navGraphCandidate.nodes),
        edges: toArrayRecords(navGraphCandidate.edges)
      },
      entranceId
    },
    nodes: [],
    materialOverride: {
      wallMaterialIndex: 0,
      floorMaterialIndex: 0
    },
    lighting: DEFAULT_LIGHTING
  };
}

function createSupabaseServiceClient(): SupabaseClient<any> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

async function fetchLayoutRevisionForOwner(
  ownerId: string,
  layoutRevisionId: string
): Promise<LayoutRevisionRow | null> {
  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return null;
  }

  const revisionLookup = await serviceClient
    .from("layout_revisions")
    .select(
      "id, scope, verification_status, created_from_intake_session_id, geometry_json, derived_scene_json, derived_nav_json, derived_camera_json"
    )
    .eq("id", layoutRevisionId)
    .maybeSingle();

  if (revisionLookup.error) {
    throw new Error(revisionLookup.error.message);
  }
  if (!revisionLookup.data) {
    return null;
  }

  const revision = revisionLookup.data as LayoutRevisionRow;
  if (revision.scope === "canonical" && revision.verification_status === "verified") {
    return revision;
  }

  if (!revision.created_from_intake_session_id) {
    return null;
  }

  const intakeLookup = await serviceClient
    .from("intake_sessions")
    .select("id, owner_id")
    .eq("id", revision.created_from_intake_session_id)
    .maybeSingle();

  if (intakeLookup.error) {
    throw new Error(intakeLookup.error.message);
  }
  if (!intakeLookup.data || intakeLookup.data.owner_id !== ownerId) {
    return null;
  }

  return revision;
}

export async function GET(_request: Request, context: { params: { projectId: string } }) {
  const projectId = context.params.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  try {
    const ownerId = await requireAuthenticatedUserId(supabase);
    const project = await getProjectByOwner(supabase, ownerId, projectId);
    const latestVersion = await getLatestProjectVersion(supabase, { projectId, ownerId });

    if (latestVersion) {
      const mapped = mapProjectVersionToSceneDocument(latestVersion as unknown as Record<string, unknown>);
      if (mapped) {
        const source: BootstrapSource =
          project.current_version_id && project.current_version_id === latestVersion.id
            ? "current_version"
            : "latest_version";
        return NextResponse.json(
          {
            source,
            bootstrap: mapped,
            revisionId: project.source_layout_revision_id ?? null
          },
          {
            status: 200,
            headers: {
              "Cache-Control": "private, no-store, max-age=0"
            }
          }
        );
      }
    }

    if (project.source_layout_revision_id) {
      const revision = await fetchLayoutRevisionForOwner(ownerId, project.source_layout_revision_id);
      if (revision) {
        const sceneDocument = buildSceneDocumentFromLayoutRevision(revision);
        if (sceneDocument) {
          const mapped = mapProjectVersionToSceneDocument({
            customization: {
              sceneDocument
            }
          });
          if (mapped) {
            return NextResponse.json(
              {
                source: "revision_layout" as const,
                bootstrap: mapped,
                revisionId: project.source_layout_revision_id
              },
              {
                status: 200,
                headers: {
                  "Cache-Control": "private, no-store, max-age=0"
                }
              }
            );
          }
        }
      }
    }

    return NextResponse.json(
      {
        source: "none" as const,
        bootstrap: null,
        revisionId: project.source_layout_revision_id ?? null
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0"
        }
      }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
