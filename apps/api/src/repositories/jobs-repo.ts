import { supabaseService } from "../services/supabase";

export async function createFloorplanJob(payload: {
  floorplanId: string;
  projectId?: string | null;
  intakeSessionId?: string | null;
  objectPath: string;
  mimeType: string;
  width?: number;
  height?: number;
}) {
  const { data, error } = await supabaseService
    .from("jobs")
    .insert({
      type: "FLOORPLAN_PIPELINE",
      floorplan_id: payload.floorplanId,
      payload: {
        floorplanId: payload.floorplanId,
        projectId: payload.projectId ?? null,
        intakeSessionId: payload.intakeSessionId ?? null,
        objectPath: payload.objectPath,
        mimeType: payload.mimeType,
        width: payload.width,
        height: payload.height
      },
      status: "queued",
      attempts: 0,
      max_attempts: 3,
      progress: 0,
      run_at: new Date().toISOString()
    })
    .select("id, status")
    .single();

  if (error) throw error;
  return data;
}

export async function getJobById(jobId: string) {
  const { data, error } = await supabaseService
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function retryJob(jobId: string) {
  const { data: existing, error: existingError } = await supabaseService
    .from("jobs")
    .select("id, attempts")
    .eq("id", jobId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) return null;

  const delaySeconds = Math.min(Math.pow(2, existing.attempts) * 5, 900);
  const runAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

  const { data, error } = await supabaseService
    .from("jobs")
    .update({
      status: "retrying",
      run_at: runAt,
      error: null,
      error_code: null,
      recoverable: null,
      provider_errors: null,
      provider_status: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId)
    .select("id, status")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getJobByIdWithProjectOwner(jobId: string, ownerId: string) {
  const job = await getJobById(jobId);
  if (!job || !job.floorplan_id) return null;

  const { data: floorplan, error: floorplanError } = await supabaseService
    .from("floorplans")
    .select("id, project_id, intake_session_id")
    .eq("id", job.floorplan_id)
    .maybeSingle();
  if (floorplanError) throw floorplanError;
  if (!floorplan) return null;

  if (floorplan.project_id) {
    const { data: project, error: projectError } = await supabaseService
      .from("projects")
      .select("id")
      .eq("id", floorplan.project_id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) return null;

    return job;
  }

  if (!floorplan.intake_session_id) return null;

  const { data: intakeSession, error: intakeSessionError } = await supabaseService
    .from("intake_sessions")
    .select("id")
    .eq("id", floorplan.intake_session_id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (intakeSessionError) throw intakeSessionError;
  if (!intakeSession) return null;

  return job;
}

export async function getJobByIdForOwner(jobId: string, ownerId: string) {
  return getJobByIdWithProjectOwner(jobId, ownerId);
}

export async function createMatchEvent(payload: {
  intakeSessionId: string;
  candidateRevisionId?: string | null;
  candidateVariantId?: string | null;
  decision: "auto_reuse" | "disambiguation_required" | "queued" | "manual_select" | "negative_feedback" | "failed";
  confidence?: number | null;
  signals?: Record<string, unknown>;
  feedback?: Record<string, unknown>;
}) {
  const { error } = await supabaseService
    .from("floorplan_match_events")
    .insert({
      intake_session_id: payload.intakeSessionId,
      candidate_revision_id: payload.candidateRevisionId ?? null,
      candidate_variant_id: payload.candidateVariantId ?? null,
      decision: payload.decision,
      confidence: payload.confidence ?? null,
      signals: payload.signals ?? {},
      feedback: payload.feedback ?? {}
    });

  if (error) throw error;
}
