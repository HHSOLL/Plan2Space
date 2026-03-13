import { supabaseService } from "../services/supabase";

export async function upsertSourceAssetForUpload(ownerId: string, payload: {
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  intakeSessionId: string;
}) {
  const { data: existing, error: existingError } = await supabaseService
    .from("source_assets")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("storage_bucket", payload.storageBucket)
    .eq("storage_path", payload.storagePath)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await supabaseService
      .from("source_assets")
      .update({
        mime_type: payload.mimeType,
        metadata: {
          originalFileName: payload.fileName,
          intakeSessionId: payload.intakeSessionId
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabaseService
    .from("source_assets")
    .insert({
      owner_id: ownerId,
      source_kind: "user_upload",
      license_status: "private_temp",
      promotion_consent: false,
      privacy_state: "private_temp",
      provenance_status: "unverified",
      storage_bucket: payload.storageBucket,
      storage_path: payload.storagePath,
      mime_type: payload.mimeType,
      redaction_status: "pending",
      retention_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        originalFileName: payload.fileName,
        intakeSessionId: payload.intakeSessionId
      }
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function updateSourceAssetChecksumsByStoragePath(payload: {
  ownerId: string;
  storageBucket: string;
  storagePath: string;
  checksumSha256?: string;
  mimeType?: string;
  width?: number;
  height?: number;
}) {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };
  if (payload.checksumSha256 !== undefined) updates.checksum_sha256 = payload.checksumSha256;
  if (payload.mimeType !== undefined) updates.mime_type = payload.mimeType;
  if (payload.width !== undefined) updates.width = payload.width;
  if (payload.height !== undefined) updates.height = payload.height;

  const { error } = await supabaseService
    .from("source_assets")
    .update(updates)
    .eq("owner_id", payload.ownerId)
    .eq("storage_bucket", payload.storageBucket)
    .eq("storage_path", payload.storagePath);

  if (error) throw error;
}
