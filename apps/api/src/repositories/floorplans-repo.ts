import { supabaseService } from "../services/supabase";

export async function createFloorplan(payload: {
  projectId: string;
  objectPath: string;
  originalFileName: string;
  mimeType: string;
  width?: number;
  height?: number;
}) {
  const { data, error } = await supabaseService
    .from("floorplans")
    .insert({
      project_id: payload.projectId,
      object_path: payload.objectPath,
      original_file_name: payload.originalFileName,
      mime_type: payload.mimeType,
      width: payload.width ?? null,
      height: payload.height ?? null,
      status: "queued"
    })
    .select("id, project_id, object_path, status, created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function getFloorplanById(floorplanId: string) {
  const { data, error } = await supabaseService
    .from("floorplans")
    .select("id, project_id, object_path, original_file_name, mime_type, status, created_at, updated_at")
    .eq("id", floorplanId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getLatestSucceededFloorplan(projectId: string) {
  const { data, error } = await supabaseService
    .from("floorplans")
    .select("id, project_id, object_path, status, created_at")
    .eq("project_id", projectId)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateFloorplanStatus(floorplanId: string, status: string, failure: { errorCode?: string; error?: string } = {}) {
  const { error } = await supabaseService
    .from("floorplans")
    .update({
      status,
      error_code: failure.errorCode ?? null,
      error: failure.error ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("id", floorplanId);

  if (error) throw error;
}
