"use client";

export type JobStatus = "queued" | "running" | "retrying" | "succeeded" | "failed" | "dead_letter";

export type JobResponse = {
  id: string;
  type: string;
  floorplanId?: string | null;
  status: JobStatus;
  attempts: number;
  maxAttempts?: number;
  progress: number;
  errorCode?: string | null;
  error?: string | null;
  recoverable?: boolean;
  providerErrors?: unknown[];
  providerStatus?: unknown[];
  details?: string | null;
  result?: unknown;
  created_at?: string;
  updated_at?: string;
};

async function requestJson<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include"
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const details = payload && typeof payload === "object" ? (payload as { error?: string }).error : null;
    throw new Error(details || `Request failed (${response.status})`);
  }

  return payload as T;
}

export async function fetchJobStatus(jobId: string) {
  return requestJson<JobResponse>(`/api/v1/jobs/${jobId}`, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });
}
