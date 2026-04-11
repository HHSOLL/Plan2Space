import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../../types/database";
import { buildProjectAssetSummary, getProjectAssetSummary } from "../builder/catalog";
import { mapProjectVersionToSceneDocument } from "../domain/scene-document";
import { loadCatalogItems } from "./catalog";
import { getLatestProjectVersion } from "./project-versions";
import { normalizeSharePermission, type SharePermission } from "../share/permissions";
import { buildSharePreviewMeta } from "../share/preview";

export type SharedProjectRow = Database["public"]["Tables"]["shared_projects"]["Row"];

export type ShareType = "temporary" | "permanent";

type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  meta: Record<string, unknown> | null;
};

export class ShareApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function generateShareToken() {
  return `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
}

async function requireProjectOwner(
  supabase: SupabaseClient<Database>,
  projectId: string,
  ownerId: string
): Promise<ProjectRow> {
  const projectLookup = await supabase
    .from("projects")
    .select("id, owner_id, name, description, meta")
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (projectLookup.error) {
    throw new ShareApiError(500, projectLookup.error.message);
  }
  if (!projectLookup.data) {
    throw new ShareApiError(404, "Project not found.");
  }

  return projectLookup.data as ProjectRow;
}

export async function requireAuthenticatedUserId(supabase: SupabaseClient<Database>) {
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user) {
    throw new ShareApiError(401, "Unauthorized");
  }
  return auth.data.user.id;
}

export async function listProjectShares(
  supabase: SupabaseClient<Database>,
  projectId: string,
  ownerId: string
) {
  await requireProjectOwner(supabase, projectId, ownerId);

  const lookup = await supabase
    .from("shared_projects")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (lookup.error) {
    throw new ShareApiError(500, lookup.error.message);
  }

  return (lookup.data ?? []) as SharedProjectRow[];
}

export async function createProjectShare(
  supabase: SupabaseClient<Database>,
  input: {
    projectId: string;
    ownerId: string;
    shareType: ShareType;
    permissions: SharePermission;
    publishToGallery: boolean;
  }
) {
  const project = await requireProjectOwner(supabase, input.projectId, input.ownerId);
  const permission = normalizeSharePermission(input.permissions);
  const selectedVersion = await getLatestProjectVersion(supabase, {
    projectId: input.projectId,
    ownerId: input.ownerId
  });
  if (!selectedVersion?.id) {
    throw new ShareApiError(400, "Save the room once before creating a snapshot link.");
  }

  const canPublishToGallery = input.shareType === "permanent" && permission === "view" && input.publishToGallery;

  const expiresAt =
    input.shareType === "temporary" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
  const mappedScene = mapProjectVersionToSceneDocument(selectedVersion as unknown as Record<string, unknown>);
  const fallbackAssetSummary = getProjectAssetSummary({ assetSummary: project.meta?.assetSummary ?? null });
  const versionScopedSummary =
    mappedScene && mappedScene.document.nodes.length > 0
      ? buildProjectAssetSummary(
          await loadCatalogItems(),
          mappedScene.document.nodes.map((node) => ({
            assetId: node.assetId,
            catalogItemId: node.metadata?.catalogItemId ?? node.catalogItemId ?? null
          }))
        )
      : fallbackAssetSummary;

  const previewMeta = buildSharePreviewMeta({
    projectName: project.name.trim() || "Untitled Room",
    projectDescription: project.description ?? null,
    versionNumber: typeof selectedVersion.version === "number" ? selectedVersion.version : null,
    assetSummary: versionScopedSummary
  });

  const insert = await supabase
    .from("shared_projects")
    .insert({
      project_id: input.projectId,
      project_version_id: selectedVersion.id,
      token: generateShareToken(),
      permissions: permission,
      expires_at: expiresAt,
      is_gallery_visible: canPublishToGallery,
      published_at: canPublishToGallery ? new Date().toISOString() : null,
      created_by: input.ownerId,
      preview_meta: previewMeta
    })
    .select("*")
    .single();

  if (insert.error) {
    throw new ShareApiError(500, insert.error.message);
  }

  return insert.data as SharedProjectRow;
}

export async function updateProjectShareVisibility(
  supabase: SupabaseClient<Database>,
  input: {
    projectId: string;
    shareId: string;
    ownerId: string;
    isGalleryVisible: boolean;
  }
) {
  await requireProjectOwner(supabase, input.projectId, input.ownerId);

  const current = await supabase
    .from("shared_projects")
    .select("*")
    .eq("id", input.shareId)
    .eq("project_id", input.projectId)
    .maybeSingle();

  if (current.error) {
    throw new ShareApiError(500, current.error.message);
  }
  if (!current.data) {
    throw new ShareApiError(404, "Share link not found.");
  }

  const canPublish = !current.data.expires_at && normalizeSharePermission(current.data.permissions) === "view";
  if (input.isGalleryVisible && !canPublish) {
    throw new ShareApiError(400, "Only permanent view links can be published.");
  }

  const update = await supabase
    .from("shared_projects")
    .update({
      is_gallery_visible: input.isGalleryVisible,
      published_at: input.isGalleryVisible ? new Date().toISOString() : null
    })
    .eq("id", input.shareId)
    .eq("project_id", input.projectId)
    .select("*")
    .single();

  if (update.error) {
    throw new ShareApiError(500, update.error.message);
  }

  return update.data as SharedProjectRow;
}

export async function deleteProjectShare(
  supabase: SupabaseClient<Database>,
  input: {
    projectId: string;
    shareId: string;
    ownerId: string;
  }
) {
  await requireProjectOwner(supabase, input.projectId, input.ownerId);

  const deletion = await supabase
    .from("shared_projects")
    .delete()
    .eq("id", input.shareId)
    .eq("project_id", input.projectId)
    .select("id")
    .maybeSingle();

  if (deletion.error) {
    throw new ShareApiError(500, deletion.error.message);
  }
  if (!deletion.data?.id) {
    throw new ShareApiError(404, "Share link not found.");
  }
}
