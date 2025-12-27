import Link from "next/link";

export default function HomePage() {
  return (
    <div className="bg-stone-50 text-stone-900">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(24,24,27,0.08),transparent_60%)]" />
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute -right-40 top-10 h-[28rem] w-[28rem] rounded-full bg-emerald-200/20 blur-3xl" />

        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 md:py-28">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-stone-200 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-stone-600 shadow-sm">
            AI-driven 3D Interior Studio
          </div>

          <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div className="space-y-6">
              <h1 className="font-serif text-5xl leading-[1.05] tracking-tight md:text-7xl">
                plan2space
              </h1>
              <p className="max-w-xl text-lg text-stone-600 md:text-xl">
                도면 한 장으로 3초 내 3D 공간을 생성하고, 브라우저에서 바로 걸어 다니며
                인테리어를 수정하세요.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-full bg-stone-900 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-stone-900/20 transition hover:bg-stone-800"
                >
                  Dashboard로 이동
                </Link>
                <Link
                  href="/projects/create"
                  className="rounded-full border border-stone-300 bg-white px-8 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-400"
                >
                  새 프로젝트 만들기
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-xl backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Pipeline</div>
              <div className="mt-4 space-y-4">
                {[
                  { title: "Upload Blueprint", desc: "JPG/PNG 도면 업로드" },
                  { title: "AI to Plan2D", desc: "Gemini 1.5 Vision → 구조 JSON" },
                  { title: "2D Correction", desc: "드래그/스냅으로 보정" },
                  { title: "3D Walkthrough", desc: "WebGL/WebGPU 렌더" }
                ].map((item, idx) => (
                  <div key={item.title} className="flex items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white">
                      0{idx + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-stone-800">{item.title}</div>
                      <div className="text-xs text-stone-500">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 flex flex-col gap-2">
          <h2 className="font-serif text-3xl text-stone-900">Focused on Tech + UX</h2>
          <p className="text-stone-600">시장/비즈니스 로직 없이 순수하게 3D 경험과 자동화를 완성합니다.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Automation</div>
            <h3 className="mt-3 font-serif text-2xl">AI Blueprint Parsing</h3>
            <p className="mt-2 text-sm text-stone-600">
              도면을 구조 JSON으로 변환하고, 사용자가 2D 편집으로 정확도를 보정합니다.
            </p>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Immersion</div>
            <h3 className="mt-3 font-serif text-2xl">First-Person Walkthrough</h3>
            <p className="mt-2 text-sm text-stone-600">
              WASD 이동, 포인터 락, 충돌 처리로 실제 공간처럼 이동합니다.
            </p>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Customization</div>
            <h3 className="mt-3 font-serif text-2xl">Material + Furniture</h3>
            <p className="mt-2 text-sm text-stone-600">
              벽/바닥 재질을 바꾸고, 가구를 배치해 즉시 결과를 확인합니다.
            </p>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Performance</div>
            <h3 className="mt-3 font-serif text-2xl">WebGL + WebGPU</h3>
            <p className="mt-2 text-sm text-stone-600">
              WebGPU 가능 시 최적 렌더, 미지원 환경은 WebGL2로 폴백합니다.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
