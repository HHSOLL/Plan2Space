"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-stone-950 via-stone-950 to-black text-stone-100">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">Something went wrong</div>
          <h1 className="mt-2 font-serif text-3xl text-white">오류가 발생했습니다</h1>
          <p className="mt-3 text-sm text-stone-400">
            잠시 후 다시 시도해 주세요. 문제가 지속되면 새로고침 또는 다시 로그인해 보세요.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">Details</div>
          <div className="mt-3 break-words font-mono text-xs text-stone-300">
            {error.message || "Unknown error"}
          </div>
          {error.digest ? (
            <div className="mt-2 text-[11px] text-stone-500">digest: {error.digest}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-black hover:bg-stone-200"
          >
            Try again
          </button>
          <Link
            href="/studio"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/20 px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-white hover:bg-black/30"
          >
            Go to studio
          </Link>
          <Link
            href="/auth"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/20 px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-white hover:bg-black/30"
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
