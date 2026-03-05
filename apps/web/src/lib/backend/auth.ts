import { getSupabaseClient } from "../supabase/client";

export async function getAccessToken() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase env not configured.");
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  const token = data.session?.access_token;
  if (!token) {
    throw new Error("로그인이 필요합니다.");
  }

  return token;
}
