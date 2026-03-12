import { supabaseService } from "../services/supabase";

export async function getLayoutRevisionVisibleToOwner(layoutRevisionId: string, ownerId: string) {
  const { data, error } = await supabaseService
    .from("layout_revisions")
    .select(
      "id, scope, verification_status, layout_variant_id, created_from_intake_session_id, geometry_hash, topology_hash, room_graph_hash, geometry_json, derived_scene_json, derived_nav_json, derived_camera_json, geometry_schema_version, repair_engine_version, scene_builder_version, created_at, updated_at"
    )
    .eq("id", layoutRevisionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  if (data.scope === "canonical" && data.verification_status === "verified") {
    return data;
  }

  if (!data.created_from_intake_session_id) {
    return null;
  }

  const { data: session, error: sessionError } = await supabaseService
    .from("intake_sessions")
    .select("id")
    .eq("id", data.created_from_intake_session_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session) return null;
  return data;
}
