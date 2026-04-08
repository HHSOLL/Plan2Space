"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, DraftingCompass, Move3D, Sparkles } from "lucide-react";
import { AuthPopup } from "../components/overlay/AuthPopup";
import { LandingHeroCanvas } from "../components/landing/landing-hero-canvas";
import { useAuthStore } from "../lib/stores/useAuthStore";
import { useLanguageStore } from "../lib/stores/useLanguageStore";

const COPY = {
  en: {
    eyebrow: "Builder-first spatial editor",
    title: "Shape the room, style the scene, walk it in real time.",
    body:
      "Plan2Space now starts from an interior builder. Define the shell first, continue in the editor, and move straight into top-view styling or walk mode review.",
    primary: "Start Room Builder",
    secondary: "Open Studio",
    cards: [
      {
        title: "Builder",
        body: "Start from a clean shell. Pick a template, set the envelope, and seed a first layout."
      },
      {
        title: "Editor",
        body: "Drag furniture, swap surfaces, and stage the scene without waiting on an intake pipeline."
      },
      {
        title: "Walk Mode",
        body: "Check proportion, circulation, and atmosphere from inside the finished room."
      }
    ]
  },
  ko: {
    eyebrow: "Builder-first spatial editor",
    title: "방을 먼저 만들고, 스타일링하고, 바로 걸어 들어갑니다.",
    body:
      "이제 Plan2Space의 기본 진입점은 도면 업로드가 아니라 인테리어 빌더입니다. 방 shell을 만든 뒤 에디터로 넘어가고, top view와 walk mode를 바로 오갈 수 있습니다.",
    primary: "Room Builder 시작",
    secondary: "Studio 열기",
    cards: [
      {
        title: "Builder",
        body: "빈 shell에서 시작합니다. 템플릿, 외곽, 마감, starter kit을 먼저 고정합니다."
      },
      {
        title: "Editor",
        body: "업로드 대기 없이 바로 가구를 배치하고 표면과 밀도를 조정합니다."
      },
      {
        title: "Walk Mode",
        body: "완성된 방 안으로 들어가 동선과 분위기를 실제 시점에서 확인합니다."
      }
    ]
  }
} as const;

export default function HomePage() {
  const router = useRouter();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { session } = useAuthStore();
  const { language } = useLanguageStore();
  const isAuthenticated = Boolean(session?.user);
  const copy = COPY[language];

  const routeToBuilder = () => {
    if (!isAuthenticated) {
      setIsAuthOpen(true);
      return;
    }
    router.push("/studio/builder");
  };

  const handleCanvasAction = (id: string) => {
    if (id === "new") {
      routeToBuilder();
      return;
    }

    if (!isAuthenticated && id !== "community") {
      setIsAuthOpen(true);
      return;
    }

    if (id === "dashboard") {
      router.push("/studio");
      return;
    }

    if (id === "community") {
      router.push("/community");
    }
  };

  return (
    <>
      <div className="relative min-h-screen overflow-hidden bg-[#f5f0e8] text-[#171411]">
        <LandingHeroCanvas onAction={handleCanvasAction} />

        <div className="relative z-10">
          <section className="mx-auto flex min-h-screen max-w-[1480px] items-end px-4 pb-12 pt-32 sm:px-6 lg:px-10">
            <div className="grid w-full gap-8 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="max-w-3xl rounded-[36px] border border-black/10 bg-white/62 p-8 shadow-[0_30px_120px_rgba(22,15,10,0.14)] backdrop-blur-xl sm:p-10 lg:p-14">
                <div className="mb-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.34em] text-[#776b61]">
                  <Sparkles className="h-4 w-4" />
                  {copy.eyebrow}
                </div>
                <h1 className="max-w-2xl text-5xl font-light leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
                  {copy.title}
                </h1>
                <p className="mt-6 max-w-xl text-sm leading-7 text-[#62564b] sm:text-[15px]">
                  {copy.body}
                </p>

                <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={routeToBuilder}
                    className="inline-flex items-center justify-center gap-3 rounded-full bg-black px-7 py-4 text-[11px] font-bold uppercase tracking-[0.28em] text-white transition-colors hover:bg-[#2d2721]"
                  >
                    {copy.primary}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => (isAuthenticated ? router.push("/studio") : setIsAuthOpen(true))}
                    className="inline-flex items-center justify-center gap-3 rounded-full border border-black/12 bg-white/65 px-7 py-4 text-[11px] font-bold uppercase tracking-[0.28em] text-[#2d2721] transition-colors hover:border-black/30"
                  >
                    {copy.secondary}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 self-end">
                {copy.cards.map((card, index) => {
                  const Icon = index === 0 ? DraftingCompass : index === 1 ? Sparkles : Move3D;
                  return (
                    <article
                      key={card.title}
                      className="rounded-[28px] border border-black/10 bg-[#fffaf4]/88 p-6 shadow-[0_20px_80px_rgba(25,16,8,0.08)] backdrop-blur-xl"
                    >
                      <div className="mb-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.28em] text-[#877768]">
                        <Icon className="h-4 w-4" />
                        {card.title}
                      </div>
                      <p className="text-sm leading-7 text-[#5c5147]">{card.body}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>

      <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
