export function toJobResponse(job: any) {
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
    created_at: job.created_at,
    updated_at: job.updated_at
  };
}
