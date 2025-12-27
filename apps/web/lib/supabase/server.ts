import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../types/database";

export function createSupabaseServerClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log("Supabase URL:", url);
    console.log("Supabase Anon Key:", anonKey);

  if (!url || !anonKey) {
    throw new Error("Supabase env not configured.");
  }

  const cookieStore = cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // When called from a Server Component, cookies are read-only.
          // Middleware is responsible for refreshing the session and setting cookies.
        }
      }
    }
  });
}

