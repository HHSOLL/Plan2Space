"use client";

import { useEffect, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { resolveBrowserAppOrigin } from "../../lib/auth/browser-origin";
import { clearInvalidBrowserSession, isRecoverableSessionError } from "../../lib/auth/session-recovery";
import { getSupabaseClient } from "../../lib/supabase/client";

function resolveNext(nextParam: string | null) {
  return nextParam && nextParam.startsWith("/") ? nextParam : "/";
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
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current || typeof window === "undefined") {
      return;
    }

    hasStartedRef.current = true;

    const exchangeCode = async () => {
      const origin = resolveBrowserAppOrigin() ?? window.location.origin;
      const safeNextPath = resolveNext(nextPath);
      const supabase = getSupabaseClient();
      let timeoutId: number | undefined;

      const redirectWithStatus = (status: "success" | "error", message?: string) => {
        if (hasRedirectedRef.current) return;
        hasRedirectedRef.current = true;
        window.location.replace(withAuthStatus(origin, safeNextPath, status, message));
      };

      const redirectToNext = () => {
        if (hasRedirectedRef.current) return;
        hasRedirectedRef.current = true;
        window.location.replace(new URL(safeNextPath, origin).toString());
      };

      const resolveExistingSession = async (session?: Session | null) => {
        if (session?.access_token) {
          redirectWithStatus("success");
          return true;
        }

        const { data, error: sessionError } = await supabase!.auth.getSession();
        if (sessionError) {
          if (isRecoverableSessionError(sessionError)) {
            await clearInvalidBrowserSession(supabase!);
            return false;
          }
          redirectWithStatus("error", sessionError.message);
          return true;
        }

        if (data.session?.access_token) {
          redirectWithStatus("success");
          return true;
        }

        return false;
      };

      if (error) {
        if (supabase) {
          await clearInvalidBrowserSession(supabase);
        }
        const errorMessage = errorDescription ?? error;
        redirectWithStatus("error", errorMessage);
        return;
      }

      if (!code) {
        if (!supabase || !(await resolveExistingSession())) {
          redirectToNext();
        }
        return;
      }

      if (!supabase) {
        redirectWithStatus("error", "Supabase 환경 변수가 설정되지 않았습니다.");
        return;
      }

      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event, session) => {
        void resolveExistingSession(session);
      });

      if (await resolveExistingSession()) {
        subscription.unsubscribe();
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        if (await resolveExistingSession()) {
          subscription.unsubscribe();
          return;
        }
        redirectWithStatus("error", exchangeError.message);
        subscription.unsubscribe();
        return;
      }

      if (await resolveExistingSession()) {
        subscription.unsubscribe();
        return;
      }

      timeoutId = window.setTimeout(async () => {
        if (await resolveExistingSession()) {
          subscription.unsubscribe();
          return;
        }
        await clearInvalidBrowserSession(supabase);
        redirectWithStatus("error", "로그인 세션을 확인하지 못했습니다. 다시 시도해주세요.");
        subscription.unsubscribe();
      }, 8000);

      return () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        subscription.unsubscribe();
      };
    };

    let cleanup: (() => void) | undefined;
    void exchangeCode().then((result) => {
      cleanup = result;
    });

    return () => {
      cleanup?.();
    };
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
