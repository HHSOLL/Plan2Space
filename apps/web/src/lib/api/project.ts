"use client";

import { backendFetch } from "../backend/client";
import type { ProjectAssetSummary } from "../builder/catalog";
import type { Project } from "../stores/useProjectStore";
import type { Floor, LightingSettings, Opening, ScaleInfo, SceneAsset, Wall } from "../stores/useSceneStore";

export type SaveProjectPayload = {
  topology: {
    scale: number;
    scaleInfo?: ScaleInfo;
    walls: Wall[];
    openings: Opening[];
    floors?: Floor[];
  };
  assets: SceneAsset[];
  materials: {
    wallIndex: number;
    floorIndex: number;
  };
  lighting?: LightingSettings;
  thumbnailDataUrl?: string | null;
  assetSummary?: ProjectAssetSummary | null;
  projectName?: string;
  projectDescription?: string | null;
  message?: string;
};

export async function saveProject(id: string, payload: SaveProjectPayload) {
  return backendFetch<{ version: unknown }>(`/v1/projects/${id}/versions`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createProjectDraft(payload: {
  name: string;
  description?: string | null;
}) {
  return backendFetch<Project>("/v1/projects", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchLatestProjectVersion(projectId: string) {
  const localPath = `/api/v1/projects/${projectId}/versions/latest`;
  try {
    const response = await fetch(localPath, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    if (response.ok) {
      return (await response.json()) as { version: Record<string, unknown> | null };
    }
  } catch {
    // Fallback to Railway API below.
  }

  return backendFetch<{ version: Record<string, unknown> | null }>(`/v1/projects/${projectId}/versions/latest`);
}
