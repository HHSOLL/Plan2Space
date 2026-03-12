"use client";

import { backendFetch } from "../../lib/backend/client";

export type AssetGenerationProvider = "triposr" | "meshy";

export type GeneratedAsset = {
  assetId: string;
  assetUrl: string;
  label: string;
  description: string;
  category: string;
};

export async function enqueueAssetGeneration(payload: {
  image: string;
  fileName?: string;
  provider?: AssetGenerationProvider;
}) {
  return backendFetch<{ jobId: string; status: "queued" }>(
    "/v1/assets/generate",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}
