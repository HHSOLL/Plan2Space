import { supabaseService } from "../services/supabase";

export async function updateFloorplanStatus(floorplanId: string, status: string, errorPayload: { errorCode?: string; error?: string } = {}) {
  const { error } = await supabaseService
    .from("floorplans")
    .update({
      status,
      error_code: errorPayload.errorCode ?? null,
      error: errorPayload.error ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("id", floorplanId);

  if (error) throw error;
}

export async function getFloorplanById(floorplanId: string) {
  const { data, error } = await supabaseService
    .from("floorplans")
    .select("id, project_id, intake_session_id, object_path, mime_type")
    .eq("id", floorplanId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
