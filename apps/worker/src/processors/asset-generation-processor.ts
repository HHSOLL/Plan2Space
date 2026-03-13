import { createGeneratedAsset } from "../repositories/assets-repo";
import {
  markJobDeadLetter,
  markJobFailed,
  markJobRetrying,
  markJobSucceeded,
  type JobRow
} from "../repositories/jobs-repo";
import { env } from "../config/env";

type AssetProviderKey = "triposr" | "meshy";

type AssetProviderConfig = {
  key: AssetProviderKey;
  apiUrl?: string;
  apiKey?: string;
  statusUrl?: string;
};

const ASSET_PROVIDERS: AssetProviderConfig[] = [
  {
    key: "triposr",
    apiUrl: env.TRIPOSR_API_URL,
    apiKey: env.TRIPOSR_API_KEY,
    statusUrl: env.TRIPOSR_STATUS_URL
  },
  {
    key: "meshy",
    apiUrl: env.MESHY_API_URL,
    apiKey: env.MESHY_API_KEY,
    statusUrl: env.MESHY_STATUS_URL
  }
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractValue<T = unknown>(data: unknown, path: string): T | null {
  if (!data || typeof data !== "object") return null;
  const parts = path.split(".");
  let current: any = data;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) return null;
    current = current[part];
  }
  return current as T;
}

export function extractAssetProviderModelUrl(data: unknown) {
  const candidates = [
    "model_url",
    "glb_url",
    "gltf_url",
    "output_url",
    "url",
    "result.model_url",
    "result.glb_url",
    "result.url",
    "data.model_url",
    "data.url"
  ];
  for (const path of candidates) {
    const value = extractValue<string>(data, path);
    if (value && typeof value === "string") return value;
  }
  return null;
}

export function extractAssetProviderJobId(data: unknown) {
  const candidates = ["job_id", "task_id", "id", "result.id", "data.id"];
  for (const path of candidates) {
    const value = extractValue<string>(data, path);
    if (value && typeof value === "string") return value;
  }
  return null;
}

function parsePayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const ownerId = typeof record.ownerId === "string" ? record.ownerId : null;
  const image = typeof record.image === "string" ? record.image : null;
  const fileName = typeof record.fileName === "string" ? record.fileName : "generated-asset";
  const provider: AssetProviderKey | null =
    record.provider === "triposr" || record.provider === "meshy" ? record.provider : null;

  if (!ownerId || !image) return null;
  return { ownerId, image, fileName, provider };
}

function getProvider(preferred?: AssetProviderKey | null) {
  const preferredProvider = preferred ? ASSET_PROVIDERS.find((provider) => provider.key === preferred) : null;
  if (preferredProvider?.apiUrl && preferredProvider.apiKey) return preferredProvider;
  return ASSET_PROVIDERS.find((provider) => provider.apiUrl && provider.apiKey) ?? null;
}

async function requestProviderGeneration(provider: AssetProviderConfig, image: string) {
  const response = await fetch(provider.apiUrl!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image,
      output: "glb"
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Asset provider request failed (${response.status}).`
    );
  }

  return data;
}

async function pollProviderResult(provider: AssetProviderConfig, externalJobId: string) {
  if (!provider.statusUrl) {
    throw new Error(`Provider ${provider.key} did not return a model URL and has no status URL configured.`);
  }

  for (let attempt = 0; attempt < env.ASSET_GENERATION_MAX_POLLS; attempt += 1) {
    const resolvedUrl = provider.statusUrl.includes("{id}")
      ? provider.statusUrl.replace("{id}", externalJobId)
      : `${provider.statusUrl.replace(/\/$/, "")}/${externalJobId}`;
    const response = await fetch(resolvedUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : `Asset provider polling failed (${response.status}).`
      );
    }

    const modelUrl = extractAssetProviderModelUrl(data);
    if (modelUrl) return modelUrl;

    await delay(env.ASSET_GENERATION_POLL_INTERVAL_MS);
  }

  throw new Error("Asset generation timed out while waiting for provider result.");
}

async function resolveModelUrl(provider: AssetProviderConfig, image: string) {
  const initial = await requestProviderGeneration(provider, image);
  const directUrl = extractAssetProviderModelUrl(initial);
  if (directUrl) return directUrl;

  const externalJobId = extractAssetProviderJobId(initial);
  if (!externalJobId) {
    throw new Error("Provider did not return a model URL or job ID.");
  }

  return pollProviderResult(provider, externalJobId);
}

export async function processAssetGenerationJob(job: JobRow) {
  const payload = parsePayload(job.payload);
  if (!payload) {
    await markJobDeadLetter(job.id, "Invalid asset generation payload.", "INVALID_ASSET_JOB_PAYLOAD");
    return;
  }

  const provider = getProvider(payload.provider);
  if (!provider) {
    await markJobFailed(job.id, {
      errorCode: "PROVIDER_NOT_CONFIGURED",
      error: "No asset generation provider configured.",
      recoverable: false,
      details: "Configure TRIPOSR or Meshy environment variables on the worker."
    });
    return;
  }

  try {
    const modelUrl = await resolveModelUrl(provider, payload.image);
    const modelResponse = await fetch(modelUrl, { cache: "no-store" });
    if (!modelResponse.ok) {
      throw new Error(`Failed to download generated asset (${modelResponse.status}).`);
    }

    const buffer = await modelResponse.arrayBuffer();
    const asset = await createGeneratedAsset({
      ownerId: payload.ownerId,
      fileName: payload.fileName,
      provider: provider.key,
      buffer
    });

    await markJobSucceeded(job.id, {
      asset,
      provider: provider.key
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (job.attempts >= job.max_attempts) {
      await markJobDeadLetter(job.id, message, "ASSET_GENERATION_FAILED");
      return;
    }

    await markJobRetrying(job.id, job.attempts);
  }
}
