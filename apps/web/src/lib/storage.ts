import { getSupabaseClient } from "./supabase/client";

const ASSETS_GLB_BUCKET = "assets-glb";

export function getAssetPublicUrl(path: string): string {
  const supabase = getSupabaseClient();
  if (!supabase) return path;
  const { data } = supabase.storage.from(ASSETS_GLB_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

