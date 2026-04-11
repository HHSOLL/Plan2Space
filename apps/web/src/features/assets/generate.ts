"use client";

export type AssetGenerationProvider = "triposr" | "meshy";

export type GeneratedAsset = {
  assetId: string;
  assetUrl: string;
  label: string;
  description: string;
  category: string;
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

export async function enqueueAssetGeneration(payload: {
  image: string;
  fileName?: string;
  provider?: AssetGenerationProvider;
}) {
  return requestJson<{ jobId: string; status: "queued" }>("/api/v1/assets/generate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
