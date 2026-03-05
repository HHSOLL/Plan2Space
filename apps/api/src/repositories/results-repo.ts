import { supabaseService } from "../services/supabase";

export async function getResultByFloorplanId(floorplanId: string) {
  const { data, error } = await supabaseService
    .from("floorplan_results")
    .select("id, floorplan_id, wall_coordinates, room_polygons, scale, scene_json, diagnostics, created_at")
    .eq("floorplan_id", floorplanId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getLatestVersion(projectId: string) {
  const { data, error } = await supabaseService
    .from("project_versions")
    .select("id, version, message, floor_plan, customization, created_at")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertFloorplanResult(payload: {
  floorplanId: string;
  wallCoordinates: unknown[];
  roomPolygons: unknown[];
  scale: number;
  sceneJson: Record<string, unknown>;
  diagnostics?: Record<string, unknown>;
}) {
  const { data, error } = await supabaseService
    .from("floorplan_results")
    .upsert(
      {
        floorplan_id: payload.floorplanId,
        wall_coordinates: payload.wallCoordinates,
        room_polygons: payload.roomPolygons,
        scale: payload.scale,
        scene_json: payload.sceneJson,
        diagnostics: payload.diagnostics ?? null
      },
      {
        onConflict: "floorplan_id"
      }
    )
    .select("id, floorplan_id")
    .single();

  if (error) throw error;
  return data;
}
