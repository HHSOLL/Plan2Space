import { supabaseService } from "../services/supabase";

export async function updateIntakeSession(payload: {
  intakeSessionId: string;
  status?: string;
  selectedLayoutRevisionId?: string | null;
  generatedFloorplanId?: string | null;
  resolutionPayload?: Record<string, unknown>;
}) {
  const { error } = await supabaseService
    .from("intake_sessions")
    .update({
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.selectedLayoutRevisionId !== undefined
        ? { selected_layout_revision_id: payload.selectedLayoutRevisionId }
        : {}),
      ...(payload.generatedFloorplanId !== undefined ? { generated_floorplan_id: payload.generatedFloorplanId } : {}),
      ...(payload.resolutionPayload !== undefined ? { resolution_payload: payload.resolutionPayload } : {}),
      updated_at: new Date().toISOString()
    })
    .eq("id", payload.intakeSessionId);

  if (error) throw error;
}
