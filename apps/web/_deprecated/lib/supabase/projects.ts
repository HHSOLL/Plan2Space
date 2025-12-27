import type { SupabaseClient } from "@supabase/supabase-js";
import type { DesignDoc } from "@webinterior/shared/types";

const PROJECTS_BUCKET = "project-thumbnails";

type ProjectRow = {
  id: string;
  name: string;
  design_doc: DesignDoc;
  updated_at: string;
  thumbnail_path: string | null;
};

export type ProjectRecord = {
  id: string;
  name: string;
  updatedAt: string;
  designDoc: DesignDoc;
  thumbnailUrl: string | null;
  thumbnailPath: string | null;
};

type SaveProjectInput = {
  supabase: SupabaseClient;
  userId: string;
  projectId?: string | null;
  name: string;
  designDoc: DesignDoc;
  screenshotUrl?: string | null;
};

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function getThumbnailUrl(supabase: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(PROJECTS_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

function mapRow(row: ProjectRow, thumbnailUrl: string | null): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    designDoc: row.design_doc,
    thumbnailUrl,
    thumbnailPath: row.thumbnail_path
  };
}

export async function fetchProjects(supabase: SupabaseClient): Promise<ProjectRecord[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id,name,design_doc,updated_at,thumbnail_path")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as ProjectRow[];
  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const url = row.thumbnail_path ? await getThumbnailUrl(supabase, row.thumbnail_path) : null;
      return mapRow(row, url);
    })
  );
  return withUrls;
}

export async function saveProject(input: SaveProjectInput): Promise<ProjectRecord> {
  const { supabase, userId, projectId, name, designDoc, screenshotUrl } = input;
  const updatedAt = new Date().toISOString();

  let row: ProjectRow | null = null;

  if (projectId) {
    const { data, error } = await supabase
      .from("projects")
      .update({ name, design_doc: designDoc, updated_at: updatedAt })
      .eq("id", projectId)
      .select("id,name,design_doc,updated_at,thumbnail_path")
      .single();
    if (error) throw error;
    row = data as ProjectRow;
  } else {
    const { data, error } = await supabase
      .from("projects")
      .insert({ owner_id: userId, name, design_doc: designDoc, updated_at: updatedAt })
      .select("id,name,design_doc,updated_at,thumbnail_path")
      .single();
    if (error) throw error;
    row = data as ProjectRow;
  }

  if (!row) {
    throw new Error("Project save failed.");
  }

  if (screenshotUrl) {
    const blob = await dataUrlToBlob(screenshotUrl);
    const path = `${userId}/${row.id}.png`;
    const { error: uploadError } = await supabase.storage.from(PROJECTS_BUCKET).upload(path, blob, {
      contentType: "image/png",
      upsert: true
    });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("projects")
      .update({ thumbnail_path: path, updated_at: updatedAt })
      .eq("id", row.id)
      .select("id,name,design_doc,updated_at,thumbnail_path")
      .single();
    if (error) throw error;
    row = data as ProjectRow;
  }

  const thumbnailUrl = row.thumbnail_path ? await getThumbnailUrl(supabase, row.thumbnail_path) : null;
  return mapRow(row, thumbnailUrl);
}

export async function deleteProject(supabase: SupabaseClient, project: ProjectRecord): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", project.id);
  if (error) throw error;
  if (project.thumbnailPath) {
    await supabase.storage.from(PROJECTS_BUCKET).remove([project.thumbnailPath]);
  }
}
