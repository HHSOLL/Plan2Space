import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-stone-950 via-stone-950 to-black text-stone-100">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">404</div>
          <h1 className="mt-2 font-sans text-3xl font-semibold text-white">페이지를 찾을 수 없습니다</h1>
          <p className="mt-3 text-sm text-stone-400">
            존재하지 않는 프로젝트이거나 접근 권한이 없을 수 있습니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/studio"
            className="inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-black hover:bg-stone-200"
          >
            스튜디오로 이동
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/20 px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-white hover:bg-black/30"
          >
            홈으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
