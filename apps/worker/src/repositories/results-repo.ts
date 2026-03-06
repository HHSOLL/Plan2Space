import { supabaseService } from "../services/supabase";

export async function upsertFloorplanResult(payload: {
  floorplanId: string;
  wallCoordinates: unknown[];
  roomPolygons: unknown[];
  scale: number;
  sceneJson: Record<string, unknown>;
  diagnostics?: Record<string, unknown>;
}) {
  const { error } = await supabaseService
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
    );

  if (error) throw error;
}
