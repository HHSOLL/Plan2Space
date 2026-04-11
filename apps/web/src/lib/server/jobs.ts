import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../../types/database";

type JobRow = Pick<
  Database["public"]["Tables"]["jobs"]["Row"],
  | "id"
  | "type"
  | "floorplan_id"
  | "status"
  | "attempts"
  | "max_attempts"
  | "progress"
  | "error_code"
  | "error"
  | "recoverable"
  | "provider_errors"
  | "provider_status"
  | "details"
  | "result"
  | "payload"
  | "created_at"
  | "updated_at"
>;

export type JobRecord = {
  id: string;
  type: string;
  floorplanId: string | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  progress: number;
  errorCode: string | null;
  error: string | null;
  recoverable?: boolean;
  providerErrors: unknown[];
  providerStatus: unknown[];
  details: string | null;
  result: unknown;
  created_at: string;
  updated_at: string;
};

export class JobApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function createPrivilegedSupabaseClient(userScopedSupabase: SupabaseClient<Database>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return userScopedSupabase;
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getPayloadOwnerId(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  return typeof record.ownerId === "string" ? record.ownerId : null;
}

function getPayloadIntakeSessionId(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  return typeof record.intakeSessionId === "string" ? record.intakeSessionId : null;
}

async function isFloorplanJobOwnedBy(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  floorplanId: string
) {
  const floorplan = await supabase
    .from("floorplans")
    .select("project_id")
    .eq("id", floorplanId)
    .maybeSingle();

  if (floorplan.error) {
    throw new JobApiError(500, floorplan.error.message);
  }
  if (!floorplan.data?.project_id) {
    return false;
  }

  const project = await supabase
    .from("projects")
    .select("id")
    .eq("id", floorplan.data.project_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (project.error) {
    throw new JobApiError(500, project.error.message);
  }

  return Boolean(project.data?.id);
}

async function isIntakeSessionJobOwnedBy(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  intakeSessionId: string
) {
  const intakeSession = await supabase
    .from("intake_sessions")
    .select("id")
    .eq("id", intakeSessionId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (intakeSession.error) {
    throw new JobApiError(500, intakeSession.error.message);
  }

  const intakeData = (intakeSession as { data?: { id?: string } | null }).data ?? null;
  return Boolean(intakeData?.id);
}

function toJobRecord(job: JobRow): JobRecord {
  return {
    id: job.id,
    type: job.type,
    floorplanId: job.floorplan_id,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
    progress: job.progress ?? 0,
    errorCode: job.error_code ?? null,
    error: job.error ?? null,
    recoverable: job.recoverable ?? undefined,
    providerErrors: Array.isArray(job.provider_errors) ? job.provider_errors : [],
    providerStatus: Array.isArray(job.provider_status) ? job.provider_status : [],
    details: job.details ?? null,
    result: job.result ?? null,
    created_at: job.created_at,
    updated_at: job.updated_at
  };
}

export async function getJobForOwner(
  userScopedSupabase: SupabaseClient<Database>,
  ownerId: string,
  jobId: string
) {
  const supabase = createPrivilegedSupabaseClient(userScopedSupabase);

  const lookup = await supabase
    .from("jobs")
    .select(
      "id, type, floorplan_id, status, attempts, max_attempts, progress, error_code, error, recoverable, provider_errors, provider_status, details, result, payload, created_at, updated_at"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (lookup.error) {
    throw new JobApiError(500, lookup.error.message);
  }
  if (!lookup.data) {
    return null;
  }

  if (lookup.data.type === "ASSET_GENERATION") {
    return getPayloadOwnerId(lookup.data.payload) === ownerId ? toJobRecord(lookup.data) : null;
  }

  if (!lookup.data.floorplan_id) {
    const intakeSessionId = getPayloadIntakeSessionId(lookup.data.payload);
    if (!intakeSessionId) {
      return null;
    }

    const isOwner = await isIntakeSessionJobOwnedBy(supabase, ownerId, intakeSessionId);
    return isOwner ? toJobRecord(lookup.data) : null;
  }

  const isFloorplanOwner = await isFloorplanJobOwnedBy(supabase, ownerId, lookup.data.floorplan_id);
  if (isFloorplanOwner) {
    return toJobRecord(lookup.data);
  }

  const intakeSessionId = getPayloadIntakeSessionId(lookup.data.payload);
  if (!intakeSessionId) {
    return null;
  }

  const isIntakeSessionOwner = await isIntakeSessionJobOwnedBy(supabase, ownerId, intakeSessionId);
  return isIntakeSessionOwner ? toJobRecord(lookup.data) : null;
}
