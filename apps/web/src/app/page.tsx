"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, DraftingCompass, Layers3, MoveUpRight, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";
import { AuthPopup } from "../components/overlay/AuthPopup";
import { useAuthStore } from "../lib/stores/useAuthStore";

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
    heroEyebrow: "Room-first builder",
    heroTitle: "Create a room, edit the scene, and publish in one flow.",
    heroBody:
      "Plan2Space starts with room setup. Define shape and dimensions, place openings, pick finishes, then continue to editor for furniture placement and sharing.",
    heroPrimary: "Start from template",
    heroSecondary: "Create custom room",
    entryEyebrow: "How to start",
    entryTitle: "Select a starting path and enter the 4-step builder.",
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
    heroCardEyebrow: "Published scene",
    heroCardTitle: "Warm living room",
    heroCardBody: "Room shell, opening placement, and material decisions are ready for editor and viewer.",
    benefits: [
      { title: "Builder-ready", body: "Room shell creation without upload friction.", icon: DraftingCompass },
      { title: "Placement-aware", body: "Furniture placement and scene editing stay in one canvas.", icon: Layers3 },
      { title: "Walk review", body: "Top view and spatial validation in one flow.", icon: Sparkles },
      { title: "Saved scenes", body: "Publishable snapshots with viewer-ready detail.", icon: ShieldCheck }
    ],
    categoriesEyebrow: "Room directions",
    categoriesTitle: "Choose the room mood before you place products.",
    categories: [
      { title: "Calm Neutral", body: "Neutral walls and warm flooring for flexible furniture composition.", image: CATEGORY_IMAGES[0] },
      { title: "Family Utility", body: "Storage-first layout with clear circulation zones.", image: CATEGORY_IMAGES[1] },
      { title: "Warm Comfort", body: "Soft lighting and timber accents for living spaces.", image: CATEGORY_IMAGES[2] },
      { title: "Clean Modern", body: "Bright surfaces and minimal clutter for high visibility.", image: CATEGORY_IMAGES[3] }
    ],
    editorialEyebrow: "Editor guide",
    editorialTitle: "Use builder first, then place products in editor.",
    editorialBody:
      "After room setup, add products in editor, move/rotate for alignment, and publish for read-only viewer sharing.",
    editorialPrimary: "Open builder",
    editorialSecondary: "View Gallery",
    showcaseEyebrow: "Highlighted scenes",
    showcaseTitle: "Published scenes ready for read-only viewing.",
    showcaseCta: "View all",
    showcaseButton: "Open scene",
    showcaseCards: [
      { title: "Daylight Living", tag: "read-only viewer", image: SHOWCASE_IMAGES[0] },
      { title: "Storage-forward Room", tag: "product placement", image: SHOWCASE_IMAGES[1] },
      { title: "Compact Studio", tag: "camera review", image: SHOWCASE_IMAGES[2] },
      { title: "Warm Family Space", tag: "published scene", image: SHOWCASE_IMAGES[3] }
    ],
    finalTitle: "Move from inspiration to an editable scene.",
    finalBody: "Builder, editor, gallery, and community all connect to the same scene model and read-only viewer."
  },
  ko: {
    heroEyebrow: "룸 빌더",
    heroTitle: "방을 만들고, 편집하고, 발행하세요.",
    heroBody:
      "Plan2Space는 방 생성에서 시작합니다. 모양/치수/문창/스타일을 설정한 뒤 editor에서 가구를 배치하고 공유 링크로 발행합니다.",
    heroPrimary: "템플릿으로 빠르게 시작",
    heroSecondary: "커스텀 방 만들기",
    entryEyebrow: "시작하는 방법",
    entryTitle: "시작 경로를 선택하고 4단계 빌더로 진입하세요.",
    entryCards: [
      {
        title: "템플릿으로 시작하기",
        body: "구성된 방 구조를 선택하고 4단계 빌더로 바로 이동합니다.",
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
    heroCardEyebrow: "발행된 장면",
    heroCardTitle: "따뜻한 거실 장면",
    heroCardBody: "방 쉘, 문창 배치, 재질 선택이 완료된 장면입니다.",
    benefits: [
      { title: "빌더 준비", body: "업로드 없이 바로 방 쉘을 생성합니다.", icon: DraftingCompass },
      { title: "배치 편집", body: "가구 배치와 정렬을 같은 캔버스에서 처리합니다.", icon: Layers3 },
      { title: "시점 검토", body: "항공뷰/상단뷰/워크뷰로 공간을 확인합니다.", icon: Sparkles },
      { title: "공유 장면", body: "발행 후 읽기 전용 뷰어로 동일하게 확인합니다.", icon: ShieldCheck }
    ],
    categoriesEyebrow: "공간 방향",
    categoriesTitle: "제품을 놓기 전에 공간 무드를 먼저 선택하세요.",
    categories: [
      { title: "차분한 뉴트럴", body: "중성 벽면과 우드 바닥으로 배치 유연성을 확보합니다.", image: CATEGORY_IMAGES[0] },
      { title: "패밀리 유틸리티", body: "수납 중심 구성과 명확한 동선을 만듭니다.", image: CATEGORY_IMAGES[1] },
      { title: "웜 컴포트", body: "은은한 조명과 따뜻한 재질로 거실 분위기를 만듭니다.", image: CATEGORY_IMAGES[2] },
      { title: "클린 모던", body: "밝은 표면과 낮은 시각 잡음으로 가시성을 높입니다.", image: CATEGORY_IMAGES[3] }
    ],
    editorialEyebrow: "에디터 가이드",
    editorialTitle: "빌더 완료 후 에디터에서 제품을 배치하세요.",
    editorialBody:
      "빌더에서 방을 확정한 다음 에디터에서 이동/회전/정렬을 수행하고 저장/발행까지 같은 흐름으로 진행합니다.",
    editorialPrimary: "빌더 열기",
    editorialSecondary: "갤러리 보기",
    showcaseEyebrow: "추천 장면",
    showcaseTitle: "읽기 전용 뷰어로 바로 볼 수 있는 발행 장면",
    showcaseCta: "전체 보기",
    showcaseButton: "장면 열기",
    showcaseCards: [
      { title: "데이라이트 리빙", tag: "읽기 전용 뷰어", image: SHOWCASE_IMAGES[0] },
      { title: "수납 중심 공간", tag: "제품 배치", image: SHOWCASE_IMAGES[1] },
      { title: "컴팩트 스튜디오", tag: "카메라 검토", image: SHOWCASE_IMAGES[2] },
      { title: "웜 패밀리 스페이스", tag: "발행 장면", image: SHOWCASE_IMAGES[3] }
    ],
    finalTitle: "영감부터 편집/발행/조회까지 하나의 흐름으로 연결하세요.",
    finalBody: "빌더, 에디터, 갤러리, 커뮤니티가 동일한 장면 모델과 읽기 전용 뷰어를 공유합니다."
  }
} as const;

export default function HomePage() {
  const router = useRouter();
  const { session } = useAuthStore();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authNextPath, setAuthNextPath] = useState<string | undefined>(undefined);
  const isAuthenticated = Boolean(session?.user);
  const copy = COPY.ko;

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
                  alt="따뜻한 채광의 공간 장면"
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
                    <h1 className="max-w-xl text-5xl font-light leading-[0.94] tracking-[-0.02em] text-white sm:text-6xl lg:text-7xl">
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
                    alt="추천 공간 장면"
                    fill
                    sizes="(max-width: 1024px) 100vw, 28vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,14,10,0.06)_0%,rgba(18,14,10,0.62)_100%)]" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/72">
                      {copy.heroCardEyebrow}
                    </div>
                    <h2 className="mt-3 text-4xl font-light leading-none text-white">{copy.heroCardTitle}</h2>
                    <p className="mt-3 max-w-sm text-sm leading-6 text-white/80">{copy.heroCardBody}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10 rounded-[34px] border border-[#d7c9b7] bg-white/70 p-6 shadow-[0_20px_56px_rgba(68,52,34,0.08)] backdrop-blur sm:p-8">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7d6f5f]">{copy.entryEyebrow}</div>
            <h2 className="mt-3 text-4xl font-light text-[#17120d] sm:text-5xl">{copy.entryTitle}</h2>
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
                    <h3 className="text-4xl font-light text-[#17120d]">{card.title}</h3>
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
                <h2 className="mt-3 max-w-3xl text-4xl font-light leading-tight text-[#19130e] sm:text-5xl">
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
                    <h3 className="text-3xl font-light text-[#18120d]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#5f5245]">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-16 grid gap-8 rounded-[34px] bg-[#f7f1e8] px-6 py-8 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:px-10 lg:py-10">
            <div className="max-w-xl">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a7b69]">{copy.editorialEyebrow}</div>
              <h2 className="mt-4 text-4xl font-light leading-tight text-[#1b1510] sm:text-5xl">
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
                  alt="Curated room styling"
                  fill
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover"
                />
              </div>
              <div className="grid gap-4">
                <div className="relative min-h-[172px] overflow-hidden rounded-[24px]">
                  <Image
                    src="/home/img2.jpg"
                    alt="Layered room accessories"
                    fill
                    sizes="(max-width: 1024px) 100vw, 24vw"
                    className="object-cover"
                  />
                </div>
                <div className="rounded-[24px] bg-[#111111] p-6 text-white">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/52">공간 힌트</div>
                  <p className="mt-4 text-3xl font-light leading-tight">
                    조명, 수납, 배치가 하나의 장면처럼 읽혀야 합니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-16 overflow-hidden rounded-[34px] bg-[#080808] px-6 py-8 text-white sm:px-8 lg:px-10 lg:py-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/42">{copy.showcaseEyebrow}</div>
                <h2 className="mt-4 text-4xl font-light sm:text-5xl">{copy.showcaseTitle}</h2>
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
                    <h3 className="mt-3 text-3xl font-light text-white">{item.title}</h3>
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
            <h2 className="text-4xl font-light text-[#1b1510] sm:text-5xl">{copy.finalTitle}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#635547] sm:text-[15px]">{copy.finalBody}</p>
          </section>
        </main>
      </div>

      <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} nextPath={authNextPath} />
    </>
  );
}
