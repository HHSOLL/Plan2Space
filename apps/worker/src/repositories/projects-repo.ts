import { supabaseService } from "../services/supabase";

export async function attachGeneratedRevisionToProjectIfMissing(projectId: string, revisionId: string) {
  const { data: project, error: projectError } = await supabaseService
    .from("projects")
    .select("id, source_layout_revision_id, resolution_state")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return;

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };

  if (!project.source_layout_revision_id) {
    updates.source_layout_revision_id = revisionId;
  }
  if (!project.resolution_state) {
    updates.resolution_state = "generated";
  }

  if (Object.keys(updates).length === 1) return;

  const { error } = await supabaseService
    .from("projects")
    .update(updates)
    .eq("id", projectId);

  if (error) throw error;
}
