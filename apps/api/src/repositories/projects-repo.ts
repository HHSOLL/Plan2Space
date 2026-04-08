import { env } from "../config/env";
import { supabaseService } from "../services/supabase";

async function resolveProjectThumbnail(thumbnailPath: string | null, metadata: Record<string, unknown> | null | undefined) {
  if (!thumbnailPath) return undefined;
  const bucket =
    metadata && typeof metadata.thumbnailBucket === "string" && metadata.thumbnailBucket.length > 0
      ? metadata.thumbnailBucket
      : env.FLOORPLAN_UPLOAD_BUCKET;
  const signed = await supabaseService.storage.from(bucket).createSignedUrl(thumbnailPath, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) {
    return undefined;
  }
  return signed.data.signedUrl;
}

type ShowcaseProjectRow = {
  id: string;
  name: string;
  description: string | null;
  meta: Record<string, unknown> | null;
  thumbnail_path: string | null;
};

async function mapProjectRecord(
  project: {
    id: string;
    owner_id: string | null;
    name: string;
    description: string | null;
    meta: Record<string, unknown> | null;
    thumbnail_path: string | null;
    source_layout_revision_id: string | null;
    resolution_state: "reused" | "generated" | "reuse_invalidated" | null;
    created_from_intake_session_id: string | null;
    created_at: string;
    updated_at: string;
  }
) {
  const metadata = project.meta ?? undefined;
  return {
    id: project.id,
    owner_id: project.owner_id,
    name: project.name,
    description: project.description,
    thumbnail: await resolveProjectThumbnail(project.thumbnail_path, project.meta),
    metadata,
    source_layout_revision_id: project.source_layout_revision_id ?? null,
    resolution_state: project.resolution_state ?? null,
    created_from_intake_session_id: project.created_from_intake_session_id ?? null,
    created_at: project.created_at,
    updated_at: project.updated_at
  };
}

export async function listProjectsByOwner(ownerId: string, limit: number, offset: number) {
  const { data, error, count } = await supabaseService
    .from("projects")
    .select(
      "id, owner_id, name, description, meta, thumbnail_path, source_layout_revision_id, resolution_state, created_from_intake_session_id, created_at, updated_at",
      { count: "exact" }
    )
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return {
    items: await Promise.all((data ?? []).map((project) => mapProjectRecord(project))),
    total: count ?? 0
  };
}

export async function getProjectByOwner(projectId: string, ownerId: string) {
  const { data, error } = await supabaseService
    .from("projects")
    .select(
      "id, owner_id, name, description, meta, thumbnail_path, source_layout_revision_id, resolution_state, created_from_intake_session_id, created_at, updated_at"
    )
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapProjectRecord(data);
}

export async function createProject(
  ownerId: string,
  payload: {
    name: string;
    description?: string | null;
    sourceLayoutRevisionId?: string | null;
    resolutionState?: "reused" | "generated" | "reuse_invalidated" | null;
    createdFromIntakeSessionId?: string | null;
  }
) {
  const { data, error } = await supabaseService
    .from("projects")
    .insert({
      owner_id: ownerId,
      name: payload.name,
      description: payload.description ?? null,
      source_layout_revision_id: payload.sourceLayoutRevisionId ?? null,
      resolution_state: payload.resolutionState ?? null,
      created_from_intake_session_id: payload.createdFromIntakeSessionId ?? null
    })
    .select(
      "id, owner_id, name, description, meta, thumbnail_path, source_layout_revision_id, resolution_state, created_from_intake_session_id, created_at, updated_at"
    )
    .single();

  if (error) throw error;
  return mapProjectRecord(data);
}

export async function updateProject(
  projectId: string,
  ownerId: string,
  payload: {
    name?: string;
    description?: string | null;
    sourceLayoutRevisionId?: string | null;
    resolutionState?: "reused" | "generated" | "reuse_invalidated" | null;
  }
) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.description !== undefined) updates.description = payload.description;
  if (payload.sourceLayoutRevisionId !== undefined) {
    updates.source_layout_revision_id = payload.sourceLayoutRevisionId;
  }
  if (payload.resolutionState !== undefined) {
    updates.resolution_state = payload.resolutionState;
  }

  const { data, error } = await supabaseService
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .select(
      "id, owner_id, name, description, meta, thumbnail_path, source_layout_revision_id, resolution_state, created_from_intake_session_id, created_at, updated_at"
    )
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapProjectRecord(data);
}

export async function markProjectReuseInvalidated(projectId: string, ownerId: string) {
  return updateProject(projectId, ownerId, {
    resolutionState: "reuse_invalidated"
  });
}

export async function deleteProject(projectId: string, ownerId: string) {
  const { data, error } = await supabaseService
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export async function listPublishedSnapshots(limit: number) {
  const { data, error } = await supabaseService
    .from("shared_projects")
    .select(
      "id, token, project_id, project_version_id, permissions, expires_at, is_gallery_visible, published_at, preview_meta, updated_at, projects!inner(id, name, description, meta, thumbnail_path)"
    )
    .eq("is_gallery_visible", true)
    .eq("permissions", "view")
    .is("expires_at", null)
    .not("project_version_id", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (row) => {
      const project = row.projects as unknown as ShowcaseProjectRow;
      return {
        id: row.id,
        token: row.token,
        project_id: row.project_id,
        project_version_id: row.project_version_id ?? null,
        preview_meta: row.preview_meta ?? null,
        published_at: row.published_at ?? row.updated_at,
        thumbnail: await resolveProjectThumbnail(project.thumbnail_path, project.meta)
      };
    })
  );
}
