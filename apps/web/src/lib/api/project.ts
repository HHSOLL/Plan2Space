"use client";

import { getSupabaseClient } from "../supabase/client";
import type { CustomizationData, FloorPlanData } from "../../../../../types/database";
import type { Opening, ScaleInfo, SceneAsset, Wall } from "../stores/useSceneStore";

type SaveProjectPayload = {
  topology: {
    scale: number;
    scaleInfo?: ScaleInfo;
    walls: Wall[];
    openings: Opening[];
  };
  assets: SceneAsset[];
  materials: {
    wallIndex: number;
    floorIndex: number;
  };
  thumbnailDataUrl?: string | null;
  projectName?: string;
  projectDescription?: string | null;
};

const DEFAULT_WALL_HEIGHT = 2.8;

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header?.match(/data:(.*);base64/);
  const mime = mimeMatch?.[1] ?? "image/png";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function buildFloorPlan(topology: SaveProjectPayload["topology"]): FloorPlanData {
  const { scale, scaleInfo, walls, openings } = topology;
  const wallHeight = walls.reduce((max, wall) => Math.max(max, wall.height || DEFAULT_WALL_HEIGHT), DEFAULT_WALL_HEIGHT);
  const wallThickness = walls.length > 0 ? Math.max(0.02, walls[0]!.thickness * scale) : 0.2;

  return {
    schemaVersion: 1,
    unit: "m",
    coordSystem: {
      plane: "xz",
      upAxis: "y"
    },
    params: {
      wallHeight,
      wallThickness,
      ceilingHeight: wallHeight
    },
    walls: walls.map((wall) => ({
      id: wall.id,
      a: [wall.start[0] * scale, wall.start[1] * scale],
      b: [wall.end[0] * scale, wall.end[1] * scale],
      thickness: wall.thickness * scale,
      height: wall.height
    })),
    openings: openings.map((opening) => ({
      id: opening.id,
      wallId: opening.wallId,
      type: opening.type,
      offset: opening.offset * scale,
      width: opening.width * scale,
      height: opening.height * scale,
      verticalOffset: typeof opening.verticalOffset === "number" ? opening.verticalOffset * scale : undefined,
      sillHeight: typeof opening.sillHeight === "number" ? opening.sillHeight * scale : undefined
    })),
    source: {
      kind: "manual_2d_editor",
      raw: scaleInfo
        ? {
            scaleInfo
          }
        : undefined
    }
  };
}

function buildCustomization(payload: SaveProjectPayload): CustomizationData {
  return {
    schemaVersion: 1,
    furniture: payload.assets.map((asset) => ({
      id: asset.id,
      modelId: asset.assetId,
      position: asset.position,
      rotation: asset.rotation,
      scale: asset.scale,
      metadata: {
        path: asset.assetId
      }
    })),
    surfaceMaterials: {},
    defaults: {
      floor: {
        materialSkuId: `floor:${payload.materials.floorIndex}`
      },
      wall: {
        materialSkuId: `wall:${payload.materials.wallIndex}`
      }
    }
  };
}

export async function saveProject(id: string, payload: SaveProjectPayload) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase env not configured.");
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, meta")
    .eq("id", id)
    .maybeSingle();

  if (projectError) throw projectError;

  if (!project) {
    const name = payload.projectName?.trim();
    const { error: createError } = await supabase.from("projects").insert({
      id,
      owner_id: authData.user.id,
      name: name && name.length > 0 ? name : "Untitled Project",
      description: payload.projectDescription ?? null,
      meta: {
        thumbnailBucket: "floor-plans"
      }
    });
    if (createError) throw createError;
  }

  let thumbnailPath: string | null = null;
  if (payload.thumbnailDataUrl) {
    const blob = dataUrlToBlob(payload.thumbnailDataUrl);
    const path = `${authData.user.id}/${id}/thumbnail-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage.from("floor-plans").upload(path, blob, {
      contentType: blob.type || "image/png",
      upsert: true
    });
    if (!uploadError) {
      thumbnailPath = path;
    }
  }

  if (thumbnailPath) {
    const meta = project?.meta && typeof project.meta === "object" ? project.meta : {};
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        thumbnail_path: thumbnailPath,
        meta: {
          ...meta,
          thumbnailBucket: "floor-plans"
        }
      })
      .eq("id", id);
    if (updateError) throw updateError;
  }

  const floorPlan = buildFloorPlan(payload.topology);
  const customization = buildCustomization(payload);

  const { error: versionError } = await supabase.rpc("create_project_version", {
    p_project_id: id,
    p_message: "Manual save",
    p_floor_plan: floorPlan,
    p_customization: customization,
    p_snapshot_path: thumbnailPath
  });
  if (versionError) throw versionError;
}
