"use client";

import { backendFetch } from "../backend/client";
import type { Floor, Opening, ScaleInfo, SceneAsset, Wall } from "../stores/useSceneStore";

type SaveProjectPayload = {
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
