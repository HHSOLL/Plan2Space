import { env } from "../config/env";
import { supabaseService } from "../services/supabase";

type CreateGeneratedAssetPayload = {
  ownerId: string;
  fileName: string;
  provider: "triposr" | "meshy";
  buffer: ArrayBuffer;
};

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export async function createGeneratedAsset(payload: CreateGeneratedAssetPayload) {
  const assetId = crypto.randomUUID();
  const safeName = sanitizeFileName(payload.fileName) || "generated-asset.glb";
  const storagePath = `${payload.ownerId}/generated/${assetId}-${safeName.endsWith(".glb") ? safeName : `${safeName}.glb`}`;

  const upload = await supabaseService.storage.from(env.ASSET_STORAGE_BUCKET).upload(storagePath, Buffer.from(payload.buffer), {
    contentType: "model/gltf-binary",
    upsert: true
  });
  if (upload.error) throw upload.error;

  const insert = await supabaseService.from("assets").insert({
    id: assetId,
    owner_id: payload.ownerId,
    name: payload.fileName || "Generated Asset",
    description: `Generated via ${payload.provider}`,
    category: "custom",
    tags: ["generated", payload.provider],
    glb_path: storagePath,
    meta: {
      schemaVersion: 1,
      unit: "m",
      extra: {
        provider: payload.provider
      }
    },
    is_public: false
  });
  if (insert.error) throw insert.error;

  const publicUrl = supabaseService.storage.from(env.ASSET_STORAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;

  return {
    assetId,
    assetUrl: publicUrl,
    label: payload.fileName || "Generated Asset",
    description: `Generated via ${payload.provider}`,
    category: "Custom"
  };
}
