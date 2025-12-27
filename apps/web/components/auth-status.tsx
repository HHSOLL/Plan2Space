"use client";

import Link from "next/link";
import { useSupabaseSession } from "../lib/supabase/use-session";

export function AuthStatus() {
  const { supabase, session, loading } = useSupabaseSession();

  if (!supabase) {
    return <span className="text-xs text-stone-400">Supabase 미설정</span>;
  }
  if (loading) {
    return <span className="text-xs text-stone-400">세션 확인 중...</span>;
  }
  if (!session) {
    return (
      <Link href="/auth" className="text-xs font-semibold text-stone-700 hover:text-stone-900">
        로그인
      </Link>
    );
  }

  return (
    <button
      onClick={() => supabase.auth.signOut()}
      className="text-xs font-semibold text-stone-700 hover:text-stone-900"
    >
      로그아웃
    </button>
  );
}
