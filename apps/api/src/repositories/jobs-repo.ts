import { supabaseService } from "../services/supabase";

export async function createFloorplanJob(payload: {
  floorplanId: string;
  projectId: string;
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
        projectId: payload.projectId,
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
    .select("id, project_id")
    .eq("id", job.floorplan_id)
    .maybeSingle();
  if (floorplanError) throw floorplanError;
  if (!floorplan) return null;

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
