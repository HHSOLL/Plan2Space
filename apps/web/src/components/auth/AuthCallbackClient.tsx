"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { resolveBrowserAppOrigin } from "../../lib/auth/browser-origin";
import { clearInvalidBrowserSession } from "../../lib/auth/session-recovery";
import { getSupabaseClient } from "../../lib/supabase/client";

function resolveNext(nextParam: string | null) {
  return nextParam && nextParam.startsWith("/") ? nextParam : "/studio";
}

function withAuthStatus(origin: string, nextPath: string, status: "success" | "error", message?: string) {
  const url = new URL(nextPath, origin);
  url.searchParams.set("auth", status);
  if (message) {
    url.searchParams.set("auth_message", message);
  }
  return url.toString();
}

type AuthCallbackClientProps = {
  code: string | null;
  error: string | null;
  errorDescription: string | null;
  nextPath: string | null;
};

export function AuthCallbackClient({ code, error, errorDescription, nextPath }: AuthCallbackClientProps) {
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current || typeof window === "undefined") {
      return;
    }

    hasStartedRef.current = true;

    const exchangeCode = async () => {
      const origin = resolveBrowserAppOrigin() ?? window.location.origin;
      const safeNextPath = resolveNext(nextPath);
      const supabase = getSupabaseClient();

      if (error) {
        if (supabase) {
          await clearInvalidBrowserSession(supabase);
        }
        const errorMessage = errorDescription ?? error;
        window.location.replace(withAuthStatus(origin, safeNextPath, "error", errorMessage));
        return;
      }

      if (!code) {
        window.location.replace(new URL(safeNextPath, origin).toString());
        return;
      }

      if (!supabase) {
        window.location.replace(
          withAuthStatus(origin, safeNextPath, "error", "Supabase 환경 변수가 설정되지 않았습니다.")
        );
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        await clearInvalidBrowserSession(supabase);
        window.location.replace(withAuthStatus(origin, safeNextPath, "error", exchangeError.message));
        return;
      }

      window.location.replace(withAuthStatus(origin, safeNextPath, "success"));
    };

    void exchangeCode();
  }, [code, error, errorDescription, nextPath]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="flex items-center gap-3 rounded-full border border-stone-200 bg-white/80 px-5 py-3 text-sm text-stone-700 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Signing you in...
      </div>
    </div>
  );
}
