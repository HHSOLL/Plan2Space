import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../../types/database";

const INVALID_SESSION_PATTERNS = [
  /invalid refresh token/i,
  /refresh token not found/i,
  /refresh token.*invalid/i,
  /session.*not found/i
];

export function isRecoverableSessionError(error: unknown): boolean {
  if (!error) return false;

  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : "";

  return INVALID_SESSION_PATTERNS.some((pattern) => pattern.test(message));
}

export async function clearInvalidBrowserSession(supabase: SupabaseClient<Database>) {
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
}

