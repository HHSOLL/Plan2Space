import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../../types/database";

export type ProjectRecord = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  thumbnail?: string;
  metadata?: Record<string, unknown>;
  current_version_id?: string | null;
  created_at: string;
  updated_at: string;
};

type SelectedProjectRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  | "id"
  | "owner_id"
  | "name"
  | "description"
  | "thumbnail_path"
  | "meta"
  | "current_version_id"
  | "created_at"
  | "updated_at"
>;

export class ProjectApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function resolveThumbnailBucket(metadata: Record<string, unknown> | null | undefined) {
  if (metadata && typeof metadata.thumbnailBucket === "string" && metadata.thumbnailBucket.length > 0) {
    return metadata.thumbnailBucket;
  }
  return process.env.PROJECT_MEDIA_BUCKET ?? process.env.NEXT_PUBLIC_PROJECT_MEDIA_BUCKET ?? "project-media";
}

async function resolveProjectThumbnail(
  supabase: SupabaseClient<Database>,
  thumbnailPath: string | null,
  metadata: Record<string, unknown> | null | undefined
) {
  if (!thumbnailPath) return undefined;

  const signed = await supabase.storage.from(resolveThumbnailBucket(metadata)).createSignedUrl(thumbnailPath, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) {
    return undefined;
  }

  return signed.data.signedUrl;
}

async function mapProjectRecord(
  supabase: SupabaseClient<Database>,
  project: SelectedProjectRow
): Promise<ProjectRecord> {
  const metadata = (project.meta as unknown as Record<string, unknown> | null) ?? null;

  return {
    id: project.id,
    owner_id: project.owner_id,
    name: project.name,
    description: project.description,
    thumbnail: await resolveProjectThumbnail(supabase, project.thumbnail_path, metadata),
    metadata: metadata ?? undefined,
    current_version_id: project.current_version_id,
    created_at: project.created_at,
    updated_at: project.updated_at
  };
}

function clampLimit(limit: number) {
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function clampOffset(offset: number) {
  return Math.max(Math.trunc(offset), 0);
}

export async function listProjectsByOwner(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  input: { limit?: number; offset?: number }
) {
  const limit = clampLimit(input.limit ?? 20);
  const offset = clampOffset(input.offset ?? 0);

  const lookup = await supabase
    .from("projects")
    .select("id, owner_id, name, description, meta, current_version_id, thumbnail_path, created_at, updated_at", {
      count: "exact"
    })
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (lookup.error) {
    throw new ProjectApiError(500, lookup.error.message);
  }

  const items = await Promise.all((lookup.data ?? []).map((project) => mapProjectRecord(supabase, project)));
  const total = lookup.count ?? 0;
  const nextCursor = total > offset + items.length ? String(offset + items.length) : null;

  return {
    items,
    total,
    nextCursor
  };
}

export async function getProjectByOwner(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  projectId: string
) {
  const lookup = await supabase
    .from("projects")
    .select("id, owner_id, name, description, meta, current_version_id, thumbnail_path, created_at, updated_at")
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (lookup.error) {
    throw new ProjectApiError(500, lookup.error.message);
  }
  if (!lookup.data) {
    throw new ProjectApiError(404, "Project not found.");
  }

  return mapProjectRecord(supabase, lookup.data);
}

export async function createProjectForOwner(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  payload: { name: string; description?: string | null }
) {
  const name = payload.name.trim();
  if (!name) {
    throw new ProjectApiError(400, "Project name is required.");
  }

  const create = await supabase
    .from("projects")
    .insert({
      owner_id: ownerId,
      name,
      description: payload.description ?? null
    })
    .select("id, owner_id, name, description, meta, current_version_id, thumbnail_path, created_at, updated_at")
    .single();

  if (create.error) {
    throw new ProjectApiError(500, create.error.message);
  }

  return mapProjectRecord(supabase, create.data);
}

export async function deleteProjectForOwner(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  projectId: string
) {
  const deletion = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .select("id")
    .maybeSingle();

  if (deletion.error) {
    throw new ProjectApiError(500, deletion.error.message);
  }
  if (!deletion.data?.id) {
    throw new ProjectApiError(404, "Project not found.");
  }
}
