"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSupabaseSession } from "../lib/supabase/use-session";

export function AuthPanel({ className }: { className?: string }) {
  const { supabase, session, loading, error } = useSupabaseSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const lastToastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error) return;
    if (lastToastRef.current === error) return;
    lastToastRef.current = error;
    toast.error(error);
  }, [error]);

  const handleSignIn = async () => {
    if (!supabase) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("로그인 완료");
    }
    setSubmitting(false);
  };

  const handleSignUp = async () => {
    if (!supabase) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("회원가입 요청 완료. 이메일을 확인하세요.");
    }
    setSubmitting(false);
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else toast.message("로그아웃되었습니다.");
  };

  return (
    <div className={`rounded-[28px] border border-stone-200/80 bg-white/70 p-7 shadow-[0_22px_70px_-55px_rgba(0,0,0,0.45)] backdrop-blur ${className ?? ""}`}>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">Account</div>
        <h2 className="mt-3 font-serif text-2xl text-stone-900">Sign in to Plan2Space</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          프로젝트 저장 및 개인 폴더(Storage) 접근을 위해 로그인이 필요합니다.
        </p>
      </div>

      {!supabase ? (
        <div className="mt-6 rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
          Supabase 환경 변수가 설정되지 않았습니다.
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white/60 px-4 py-3 text-sm text-stone-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
          세션 확인 중...
        </div>
      ) : null}

      {!loading && session ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-stone-200/70 bg-white/60 px-4 py-3 text-sm text-stone-700">
            <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">Signed in</div>
            <div className="mt-2 truncate font-medium text-stone-900">{session.user.email}</div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-full border border-stone-300 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-stone-800 transition-all duration-300 hover:bg-stone-100 disabled:opacity-40"
          >
            Sign out
          </button>
        </div>
      ) : null}

      {!loading && !session ? (
        <div className="mt-6 space-y-5">
          <div className="space-y-4">
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                className="peer w-full border-b border-stone-300 bg-transparent pb-2 pt-5 text-sm text-stone-900 outline-none transition-colors placeholder:text-transparent focus:border-stone-900"
              />
              <label className="pointer-events-none absolute left-0 top-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500 transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-xs peer-placeholder-shown:font-medium peer-placeholder-shown:tracking-wide peer-placeholder-shown:text-stone-400 peer-focus:top-1 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:tracking-[0.32em] peer-focus:text-stone-600">
                Email
              </label>
            </div>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="peer w-full border-b border-stone-300 bg-transparent pb-2 pt-5 text-sm text-stone-900 outline-none transition-colors placeholder:text-transparent focus:border-stone-900"
              />
              <label className="pointer-events-none absolute left-0 top-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500 transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-xs peer-placeholder-shown:font-medium peer-placeholder-shown:tracking-wide peer-placeholder-shown:text-stone-400 peer-focus:top-1 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:tracking-[0.32em] peer-focus:text-stone-600">
                Password
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleSignIn}
              disabled={submitting || !email || !password || !supabase}
              className="inline-flex items-center justify-center rounded-full bg-stone-900 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-stone-50 transition-all duration-300 hover:bg-stone-800 disabled:opacity-40"
            >
              {submitting ? "Signing..." : "Sign in"}
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              disabled={submitting || !email || !password || !supabase}
              className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-stone-800 transition-all duration-300 hover:bg-stone-100 disabled:opacity-40"
            >
              Create
            </button>
          </div>

          <p className="text-xs leading-relaxed text-stone-500">
            회원가입 후 이메일 인증이 필요할 수 있습니다. (Supabase Auth 설정에 따라 다름)
          </p>
        </div>
      ) : null}
    </div>
  );
}
