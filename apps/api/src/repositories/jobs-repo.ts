import { supabaseService } from "../services/supabase";

export async function createAssetGenerationJob(payload: {
  ownerId: string;
  image: string;
  fileName?: string;
  provider?: "triposr" | "meshy";
}) {
  const { data, error } = await supabaseService
    .from("jobs")
    .insert({
      type: "ASSET_GENERATION",
      payload: {
        ownerId: payload.ownerId,
        image: payload.image,
        fileName: payload.fileName ?? null,
        provider: payload.provider ?? null
      },
      status: "queued",
      attempts: 0,
      max_attempts: 3,
      progress: 0,
      run_at: new Date().toISOString(),
      result: null
    })
    .select("id, status")
    .single();

  if (error) throw error;
  return data;
}
