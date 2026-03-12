import { backendFetch } from "../../lib/backend/client";

export type JobStatusResponse = {
  id: string;
  type: string;
  floorplanId?: string | null;
  status: "queued" | "running" | "retrying" | "succeeded" | "failed" | "dead_letter";
  attempts: number;
  progress: number;
  errorCode?: string | null;
  error?: string | null;
  recoverable?: boolean;
  providerErrors?: string[];
  providerStatus?: Array<{ provider: string; configured: boolean; status: "enabled" | "skipped"; reason: string | null }>;
  details?: string | null;
  result?: Record<string, unknown> | null;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJobStatus(jobId: string) {
  return backendFetch<JobStatusResponse>(`/v1/jobs/${jobId}`);
}

export async function retryJob(jobId: string) {
  return backendFetch<{ id: string; status: string }>(`/v1/jobs/${jobId}/retry`, {
    method: "POST"
  });
}

export async function pollJobUntilTerminal(
  jobId: string,
  options: { intervalMs?: number; timeoutMs?: number; timeoutMessage?: string } = {}
) {
  const intervalMs = options.intervalMs ?? 1200;
  const timeoutMs = options.timeoutMs ?? 240000;
  const timeoutMessage = options.timeoutMessage ?? "Job processing timed out.";
  const startedAt = Date.now();

  while (true) {
    const status = await fetchJobStatus(jobId);
    if (status.status === "succeeded" || status.status === "failed" || status.status === "dead_letter") {
      return status;
    }

    if (Date.now() - startedAt > timeoutMs) {
      const timeoutError = new Error(timeoutMessage) as Error & { status?: number; payload?: unknown };
      timeoutError.status = 504;
      timeoutError.payload = {
        recoverable: true,
        errorCode: "JOB_TIMEOUT",
        details: timeoutMessage,
        providerStatus: status.providerStatus ?? [],
        providerErrors: status.providerErrors ?? []
      };
      throw timeoutError;
    }

    await delay(intervalMs);
  }
}
