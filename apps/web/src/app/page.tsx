"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, DraftingCompass, Layers3, MoveUpRight, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";
import { AuthPopup } from "../components/overlay/AuthPopup";
import { useAuthStore } from "../lib/stores/useAuthStore";
import { useLanguageStore } from "../lib/stores/useLanguageStore";

const CATEGORY_IMAGES = [
  "/home/img1.jpg",
  "/home/img2.jpg",
  "/home/img3.jpg",
  "/home/img4.jpg"
] as const;

const SHOWCASE_IMAGES = [
  "/home/img4.jpg",
  "/home/img5.jpg",
  "/home/img6.jpg",
  "/home/img7.jpg"
] as const;

const COPY = {
  en: {
    heroEyebrow: "Deskterior-first builder",
    heroTitle: "Design a desk and room story with editorial calm.",
    heroBody:
      "Plan2Space now opens like a premium interior collection. Start from a room shell, explore desk setups, then move into builder and editor with the same scene.",
    heroPrimary: "Template Quick Start",
    heroSecondary: "Custom Room Builder",
    entryEyebrow: "How to start",
    entryTitle: "Choose one primary path and enter the builder flow.",
    entryCards: [
      {
        title: "Start from template",
        body: "Pick a pre-composed room shell and go straight into the 4-step builder.",
        button: "Choose template",
        image: "/home/img5.jpg",
        nextPath: "/studio/builder?intent=template"
      },
      {
        title: "Create custom room",
        body: "Start with shape and dimensions, then define openings and finishes manually.",
        button: "Create room",
        image: "/home/img3.jpg",
        nextPath: "/studio/builder?intent=custom"
      }
    ],
    entryTertiary: "Open projects",
    heroCardEyebrow: "Featured setup",
    heroCardTitle: "Quiet tech corner",
    heroCardBody: "Warm wood, diffuse light, and layered display surfaces for focused deskterior composition.",
    benefits: [
      { title: "Builder-ready", body: "Room shell creation without upload friction.", icon: DraftingCompass },
      { title: "Surface-aware", body: "Desk and shelf placement that feels intentional.", icon: Layers3 },
      { title: "Walk review", body: "Top view and spatial validation in one flow.", icon: Sparkles },
      { title: "Saved scenes", body: "Publishable snapshots with viewer-ready detail.", icon: ShieldCheck }
    ],
    categoriesEyebrow: "Workspace directions",
    categoriesTitle: "Choose a composition language before you place a single asset.",
    categories: [
      { title: "Monochrome Focus", body: "Dark desktop, glass monitor stand, and plant-led contrast.", image: CATEGORY_IMAGES[0] },
      { title: "Collector Shelf", body: "Layered desk objects, pegboard storage, and cozy utility.", image: CATEGORY_IMAGES[1] },
      { title: "Warm Archive", body: "Soft lamp glow, framed prints, and calm brown timber.", image: CATEGORY_IMAGES[2] },
      { title: "Clean Utility", body: "Bright wall system with tidy accessories and open breathing room.", image: CATEGORY_IMAGES[3] }
    ],
    editorialEyebrow: "Editorial setup note",
    editorialTitle: "Deskterior should feel curated, not randomly filled.",
    editorialBody:
      "Use the builder to define envelope and circulation first, then stage objects with hierarchy. Screens, speakers, shelves, and task lighting should read like a composed system.",
    editorialPrimary: "Launch Builder",
    editorialSecondary: "View Gallery",
    showcaseEyebrow: "Highlighted scenes",
    showcaseTitle: "A darker shelf for publishable setups.",
    showcaseCta: "View all",
    showcaseButton: "Open in builder",
    showcaseCards: [
      { title: "Daylight Utility", tag: "monitor shelf", image: SHOWCASE_IMAGES[0] },
      { title: "Object Library", tag: "desk styling", image: SHOWCASE_IMAGES[1] },
      { title: "Soft Studio Rack", tag: "speaker-focused", image: SHOWCASE_IMAGES[2] },
      { title: "Sunlit Maker Desk", tag: "collector corner", image: SHOWCASE_IMAGES[3] }
    ],
    finalTitle: "Move from inspiration to an editable scene.",
    finalBody: "Use the builder when you want control, and keep gallery/community public when you only want to browse."
  },
  ko: {
    heroEyebrow: "Deskterior-first builder",
    heroTitle: "에디토리얼 무드로 방과 데스크 장면을 함께 설계하세요.",
    heroBody:
      "이제 Plan2Space 홈은 프리미엄 인테리어 컬렉션처럼 시작합니다. 방 shell을 먼저 만들고, 데스크 구성을 참고한 뒤 같은 scene 위에서 builder와 editor로 이어집니다.",
    heroPrimary: "템플릿으로 빠르게 시작",
    heroSecondary: "커스텀 방 만들기",
    entryEyebrow: "시작하는 방법",
    entryTitle: "먼저 하나의 시작 경로를 선택하고 builder 흐름으로 들어가세요.",
    entryCards: [
      {
        title: "템플릿으로 시작하기",
        body: "구성된 room shell을 선택하고 4단계 builder로 바로 이동합니다.",
        button: "공간 선택",
        image: "/home/img5.jpg",
        nextPath: "/studio/builder?intent=template"
      },
      {
        title: "커스텀 공간 만들기",
        body: "모양, 치수, 문/창문, 스타일을 직접 지정해 방을 생성합니다.",
        button: "공간 만들기",
        image: "/home/img3.jpg",
        nextPath: "/studio/builder?intent=custom"
      }
    ],
    entryTertiary: "내 프로젝트 열기",
    heroCardEyebrow: "Featured setup",
    heroCardTitle: "조용한 테크 코너",
    heroCardBody: "우드 톤, 확산 조명, 레이어드 선반 구조로 집중감 있는 deskterior를 만듭니다.",
    benefits: [
      { title: "Builder-ready", body: "업로드 없이 바로 시작하는 room shell 작성.", icon: DraftingCompass },
      { title: "Surface-aware", body: "책상과 선반 위 배치가 자연스럽게 정리됩니다.", icon: Layers3 },
      { title: "Walk review", body: "Top view와 공간 검증을 같은 흐름에서 처리.", icon: Sparkles },
      { title: "Saved scenes", body: "공유 가능한 스냅샷과 viewer 상세 확인.", icon: ShieldCheck }
    ],
    categoriesEyebrow: "Workspace directions",
    categoriesTitle: "자산을 놓기 전에, 어떤 장면 언어로 갈지 먼저 선택하세요.",
    categories: [
      { title: "모노크롬 포커스", body: "다크 데스크탑과 식물 대비로 차분한 집중감을 만듭니다.", image: CATEGORY_IMAGES[0] },
      { title: "컬렉터 셸프", body: "오브제와 보드 스토리지가 층위감 있게 쌓이는 구성입니다.", image: CATEGORY_IMAGES[1] },
      { title: "웜 아카이브", body: "램프 광원과 프린트, 브라운 우드의 온도를 살립니다.", image: CATEGORY_IMAGES[2] },
      { title: "클린 유틸리티", body: "밝은 벽 시스템과 정리된 액세서리 중심의 구조입니다.", image: CATEGORY_IMAGES[3] }
    ],
    editorialEyebrow: "Editorial setup note",
    editorialTitle: "Deskterior는 채우는 것이 아니라 큐레이션하는 것입니다.",
    editorialBody:
      "먼저 builder에서 외곽과 동선을 잡고, 그 다음 오브제를 계층적으로 배치하세요. 스크린, 스피커, 선반, 태스크 조명은 하나의 장면 시스템처럼 읽혀야 합니다.",
    editorialPrimary: "Builder 열기",
    editorialSecondary: "Gallery 보기",
    showcaseEyebrow: "Highlighted scenes",
    showcaseTitle: "발행 가능한 장면을 위한 다크 쇼케이스.",
    showcaseCta: "전체 보기",
    showcaseButton: "Builder에서 열기",
    showcaseCards: [
      { title: "데이라이트 유틸리티", tag: "monitor shelf", image: SHOWCASE_IMAGES[0] },
      { title: "오브제 라이브러리", tag: "desk styling", image: SHOWCASE_IMAGES[1] },
      { title: "소프트 스튜디오 랙", tag: "speaker-focused", image: SHOWCASE_IMAGES[2] },
      { title: "선라이트 메이커 데스크", tag: "collector corner", image: SHOWCASE_IMAGES[3] }
    ],
    finalTitle: "무드 참고에서 편집 가능한 scene까지 바로 연결하세요.",
    finalBody: "직접 만들고 싶을 때는 builder로, 둘러보기만 할 때는 gallery/community로 들어가면 됩니다."
  }
} as const;

export default function HomePage() {
  const router = useRouter();
  const { session } = useAuthStore();
  const { language } = useLanguageStore();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authNextPath, setAuthNextPath] = useState<string | undefined>(undefined);
  const isAuthenticated = Boolean(session?.user);
  const copy = COPY[language];

  const requireAuth = (nextPath: string) => {
    if (isAuthenticated) {
      router.push(nextPath);
      return;
    }
    setAuthNextPath(nextPath);
    setIsAuthOpen(true);
  };

  return (
    <>
      <div className="min-h-screen bg-[#ece3d8] text-[#17120d]">
        <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:px-10">
          <section className="overflow-hidden rounded-[38px] border border-[#d9cbbb] bg-[#b29e86] shadow-[0_30px_80px_rgba(53,37,19,0.18)]">
            <div className="grid min-h-[680px] lg:grid-cols-[1.5fr_0.72fr]">
              <div className="relative min-h-[520px] overflow-hidden">
                <Image
                  src="/home/img7.jpg"
                  alt="Sunlit deskterior hero"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 72vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(27,18,11,0.42)_0%,rgba(27,18,11,0.18)_40%,rgba(27,18,11,0.02)_100%)]" />
                <div className="absolute left-6 top-6 rounded-full border border-white/20 bg-black/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/92 backdrop-blur-md sm:left-8 sm:top-8">
                  {copy.heroEyebrow}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 lg:p-10">
                  <div className="max-w-2xl rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(19,14,10,0.12)_0%,rgba(19,14,10,0.36)_100%)] p-6 backdrop-blur-md sm:p-8">
                    <h1 className="max-w-xl font-cormorant text-5xl font-light leading-[0.94] tracking-[-0.02em] text-white sm:text-6xl lg:text-7xl">
                      {copy.heroTitle}
                    </h1>
                    <p className="mt-5 max-w-xl text-sm leading-7 text-white/80 sm:text-[15px]">{copy.heroBody}</p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => requireAuth("/studio/builder?intent=template")}
                        className="inline-flex items-center justify-center gap-3 rounded-full bg-white px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1d1711] transition-transform hover:-translate-y-0.5"
                      >
                        {copy.heroPrimary}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => requireAuth("/studio/builder?intent=custom")}
                        className="inline-flex items-center justify-center gap-3 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/18"
                      >
                        {copy.heroSecondary}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => requireAuth("/studio")}
                      className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75 transition hover:text-white"
                    >
                      {copy.entryTertiary}
                      <MoveUpRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative flex min-h-[320px] flex-col justify-end bg-[#d9cab5] p-5 sm:p-6">
                <div className="relative h-full min-h-[320px] overflow-hidden rounded-[30px] border border-black/8 bg-[#d8c9b6] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
                  <Image
                    src="/home/img6.jpg"
                    alt="Featured desk setup"
                    fill
                    sizes="(max-width: 1024px) 100vw, 28vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,14,10,0.06)_0%,rgba(18,14,10,0.62)_100%)]" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/72">
                      {copy.heroCardEyebrow}
                    </div>
                    <h2 className="mt-3 font-cormorant text-4xl font-light leading-none text-white">{copy.heroCardTitle}</h2>
                    <p className="mt-3 max-w-sm text-sm leading-6 text-white/80">{copy.heroCardBody}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10 rounded-[34px] border border-[#d7c9b7] bg-white/70 p-6 shadow-[0_20px_56px_rgba(68,52,34,0.08)] backdrop-blur sm:p-8">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7d6f5f]">{copy.entryEyebrow}</div>
            <h2 className="mt-3 font-cormorant text-4xl font-light text-[#17120d] sm:text-5xl">{copy.entryTitle}</h2>
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {copy.entryCards.map((card) => (
                <article
                  key={card.title}
                  className="group overflow-hidden rounded-[28px] border border-black/10 bg-[#f8f4ee] shadow-[0_14px_36px_rgba(60,39,17,0.08)]"
                >
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <Image
                      src={card.image}
                      alt={card.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="space-y-4 px-6 py-6">
                    <h3 className="font-cormorant text-4xl font-light text-[#17120d]">{card.title}</h3>
                    <p className="text-sm leading-7 text-[#5f5245]">{card.body}</p>
                    <button
                      type="button"
                      onClick={() => requireAuth(card.nextPath)}
                      className="inline-flex items-center gap-2 rounded-full border border-[#17120d] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#17120d] transition hover:bg-[#17120d] hover:text-white"
                    >
                      {card.button}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-px overflow-hidden rounded-[28px] bg-[#080808] text-white sm:grid-cols-2 xl:grid-cols-4">
            {copy.benefits.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="bg-black px-6 py-6">
                  <Icon className="h-5 w-5 text-white/90" />
                  <h3 className="mt-4 text-lg font-medium">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/62">{item.body}</p>
                </article>
              );
            })}
          </section>

          <section className="mt-20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#786957]">{copy.categoriesEyebrow}</div>
                <h2 className="mt-3 max-w-3xl font-cormorant text-4xl font-light leading-tight text-[#19130e] sm:text-5xl">
                  {copy.categoriesTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => router.push("/gallery")}
                className="inline-flex items-center gap-2 self-start rounded-full border border-[#d4c4b2] bg-white/65 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2b2117] transition-colors hover:bg-white"
              >
                {copy.showcaseCta}
                <MoveUpRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {copy.categories.map((item) => (
                <article
                  key={item.title}
                  className="group overflow-hidden rounded-[28px] border border-white/50 bg-white/72 shadow-[0_16px_40px_rgba(60,39,17,0.08)]"
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="px-5 py-5">
                    <h3 className="font-cormorant text-3xl font-light text-[#18120d]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#5f5245]">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-16 grid gap-8 rounded-[34px] bg-[#f7f1e8] px-6 py-8 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:px-10 lg:py-10">
            <div className="max-w-xl">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a7b69]">{copy.editorialEyebrow}</div>
              <h2 className="mt-4 font-cormorant text-4xl font-light leading-tight text-[#1b1510] sm:text-5xl">
                {copy.editorialTitle}
              </h2>
              <p className="mt-5 text-sm leading-7 text-[#615346] sm:text-[15px]">{copy.editorialBody}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => requireAuth("/studio/builder")}
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-[#120f0c] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
                >
                  <WandSparkles className="h-4 w-4" />
                  {copy.editorialPrimary}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/gallery")}
                  className="inline-flex items-center justify-center gap-3 rounded-full border border-[#d7c7b4] bg-white px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#201811]"
                >
                  {copy.editorialSecondary}
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
              <div className="relative min-h-[360px] overflow-hidden rounded-[28px]">
                <Image
                  src="/home/img5.jpg"
                  alt="Curated desk styling"
                  fill
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover"
                />
              </div>
              <div className="grid gap-4">
                <div className="relative min-h-[172px] overflow-hidden rounded-[24px]">
                  <Image
                    src="/home/img2.jpg"
                    alt="Layered desk accessories"
                    fill
                    sizes="(max-width: 1024px) 100vw, 24vw"
                    className="object-cover"
                  />
                </div>
                <div className="rounded-[24px] bg-[#111111] p-6 text-white">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/52">Deskterior cue</div>
                  <p className="mt-4 font-cormorant text-3xl font-light leading-tight">
                    Light, storage, and display should read like one composition.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-16 overflow-hidden rounded-[34px] bg-[#080808] px-6 py-8 text-white sm:px-8 lg:px-10 lg:py-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/42">{copy.showcaseEyebrow}</div>
                <h2 className="mt-4 font-cormorant text-4xl font-light sm:text-5xl">{copy.showcaseTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => router.push("/gallery")}
                className="inline-flex items-center gap-2 self-start rounded-full border border-white/18 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/10"
              >
                {copy.showcaseCta}
                <MoveUpRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-4">
              {copy.showcaseCards.map((item) => (
                <article key={item.title} className="overflow-hidden rounded-[28px] border border-white/10 bg-white/4">
                  <div className="relative aspect-[4/4.6] overflow-hidden">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 1280px) 50vw, 25vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="px-5 py-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/44">{item.tag}</div>
                    <h3 className="mt-3 font-cormorant text-3xl font-light text-white">{item.title}</h3>
                    <button
                      type="button"
                      onClick={() => requireAuth("/studio/builder")}
                      className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/14 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 transition-colors hover:bg-white/8"
                    >
                      {copy.showcaseButton}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-16 rounded-[30px] border border-[#d6c7b4] bg-white/60 px-6 py-8 backdrop-blur-sm sm:px-8">
            <h2 className="font-cormorant text-4xl font-light text-[#1b1510] sm:text-5xl">{copy.finalTitle}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#635547] sm:text-[15px]">{copy.finalBody}</p>
          </section>
        </main>
      </div>

      <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} nextPath={authNextPath} />
    </>
  );
}
