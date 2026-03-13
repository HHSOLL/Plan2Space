import { clearInvalidBrowserSession, isRecoverableSessionError } from "../auth/session-recovery";
import { getSupabaseClient } from "../supabase/client";

export async function getAccessToken() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase env not configured.");
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    if (isRecoverableSessionError(error)) {
      await clearInvalidBrowserSession(supabase);
      throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
    }
    throw error;
  }

  const token = data.session?.access_token;
  if (!token) {
    throw new Error("로그인이 필요합니다.");
  }

  return token;
}
