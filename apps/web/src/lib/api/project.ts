"use client";

import { backendFetch } from "../backend/client";
import type { ProjectAssetSummary } from "../builder/catalog";
import type { Project } from "../stores/useProjectStore";
import type { Floor, Opening, ScaleInfo, SceneAsset, Wall } from "../stores/useSceneStore";

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
  return backendFetch<{ version: Record<string, unknown> | null }>(`/v1/projects/${projectId}/versions/latest`);
}
