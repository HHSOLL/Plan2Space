import { supabaseService } from "../services/supabase";

export async function getSourceAssetByStoragePath(storageBucket: string, storagePath: string) {
  const { data, error } = await supabaseService
    .from("source_assets")
    .select("id, owner_id, provenance_status, promotion_consent")
    .eq("storage_bucket", storageBucket)
    .eq("storage_path", storagePath)
    .maybeSingle();

  if (error) throw error;
  return data;
}
