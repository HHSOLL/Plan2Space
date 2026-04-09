"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Compass,
  DraftingCompass,
  Layers3,
  Move3D,
  Sparkles
} from "lucide-react";
import { AuthPopup } from "../components/overlay/AuthPopup";
import { LandingHeroCanvas } from "../components/landing/landing-hero-canvas";
import { useAuthStore } from "../lib/stores/useAuthStore";
import { useLanguageStore } from "../lib/stores/useLanguageStore";

const COPY = {
  en: {
    eyebrow: "Calm spatial planning studio",
    title: "Plan a room with clarity before you place a single object.",
    body:
      "Builder-first flow for interior ideation. Define the envelope, set materials, then transition into editor and walk mode without context switching.",
    primary: "Start Builder",
    secondary: "Open Studio",
    statLabel: "Builder-first sessions",
    statValue: "14K+",
    statDescription: "Rooms drafted and iterated with live 3D feedback.",
    sections: {
      how: "How it works",
      howTitle: "A quieter workflow for high-confidence room design.",
      principles: "Design principles",
      principlesTitle: "Balanced structure, premium calm, and spatial focus."
    },
    steps: [
      {
        title: "Define the shell",
        body: "Pick a room template, tune dimensions, and establish openings in minutes."
      },
      {
        title: "Compose in editor",
        body: "Drag, align, and refine furniture with material changes in a single canvas."
      },
      {
        title: "Validate in walk mode",
        body: "Switch perspective to test proportion, movement, and atmosphere before sharing."
      }
    ],
    principles: [
      {
        title: "Spacious hierarchy",
        body: "Readable sections with deliberate spacing and focused interaction zones."
      },
      {
        title: "Material-led decisions",
        body: "Surface choices are made early, so styling and layout evolve together."
      },
      {
        title: "Mode continuity",
        body: "Builder, editor, and walk mode share one scene model from start to finish."
      }
    ],
    finalCtaTitle: "Ready to sketch your next room narrative?",
    finalCtaBody:
      "Open the builder and move from structural planning to fully styled space in one flow."
  },
  ko: {
    eyebrow: "차분한 공간 설계 스튜디오",
    title: "가구를 놓기 전에, 방의 구조를 먼저 명확하게 설계하세요.",
    body:
      "인테리어 아이데이션에 맞춘 builder-first 흐름입니다. 방 외곽과 마감을 먼저 정하고, 같은 맥락에서 editor와 walk mode로 바로 이어집니다.",
    primary: "Builder 시작",
    secondary: "Studio 열기",
    statLabel: "Builder-first sessions",
    statValue: "14K+",
    statDescription: "실시간 3D 피드백으로 설계/수정된 룸 작업 수.",
    sections: {
      how: "How it works",
      howTitle: "복잡함을 줄이고 판단력을 높이는 공간 설계 흐름.",
      principles: "Design principles",
      principlesTitle: "구조적 여백, 프리미엄 톤, 공간 집중도."
    },
    steps: [
      {
        title: "Shell 정의",
        body: "룸 템플릿을 고르고 치수와 개구부를 빠르게 고정합니다."
      },
      {
        title: "Editor 구성",
        body: "한 화면에서 배치, 정렬, 마감 변경을 연속적으로 진행합니다."
      },
      {
        title: "Walk 검증",
        body: "시점을 전환해 동선과 비율, 분위기를 실제처럼 확인합니다."
      }
    ],
    principles: [
      {
        title: "Spacious hierarchy",
        body: "명확한 섹션 구조와 충분한 여백으로 판단 피로를 줄입니다."
      },
      {
        title: "Material-led decisions",
        body: "마감을 초기에 결정해 레이아웃과 스타일을 함께 최적화합니다."
      },
      {
        title: "Mode continuity",
        body: "Builder, editor, walk mode가 하나의 scene 모델로 연결됩니다."
      }
    ],
    finalCtaTitle: "다음 공간 시나리오를 바로 시작할 준비가 됐나요?",
    finalCtaBody:
      "Builder에서 시작해 구조 설계부터 스타일링까지 끊김 없이 진행해보세요."
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
      <div className="relative min-h-screen bg-[radial-gradient(140%_90%_at_50%_0%,#ffffff_0%,#f7f3ec_58%,#f2ece3_100%)] text-[#191613]">
        <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-28 sm:px-6 lg:px-10">
          <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[30px] border border-[#e9e0d4] bg-white/88 p-7 shadow-[0_24px_64px_rgba(88,70,46,0.08)] backdrop-blur sm:p-10">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#eadfce] bg-[#f9f5ef] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8c7b67]">
                <Sparkles className="h-3.5 w-3.5" />
                {copy.eyebrow}
              </div>
              <h1 className="max-w-2xl text-4xl font-light leading-[1.08] tracking-[-0.02em] sm:text-5xl lg:text-6xl">
                {copy.title}
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-[#61584e] sm:text-[15px]">{copy.body}</p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={routeToBuilder}
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-[#1f1a16] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#332a23]"
                >
                  {copy.primary}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => (isAuthenticated ? router.push("/studio") : setIsAuthOpen(true))}
                  className="inline-flex items-center justify-center gap-3 rounded-full border border-[#d8cab6] bg-[#faf6f0] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2f2821] transition-colors hover:border-[#bca98f]"
                >
                  {copy.secondary}
                </button>
              </div>

              <div className="mt-8 rounded-[22px] border border-[#eee5d8] bg-[#fbf7f1] px-5 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#95836f]">
                  {copy.statLabel}
                </div>
                <div className="mt-2 text-3xl font-light text-[#1e1915]">{copy.statValue}</div>
                <p className="mt-2 text-sm text-[#6c6054]">{copy.statDescription}</p>
              </div>
            </div>

            <LandingHeroCanvas onAction={handleCanvasAction} layout="framed" />
          </section>

          <section className="mt-20">
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#94836d]">
                <Compass className="h-3.5 w-3.5" />
                {copy.sections.how}
              </div>
              <h2 className="mt-3 text-3xl font-light text-[#201b17] sm:text-4xl">{copy.sections.howTitle}</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {copy.steps.map((step, index) => {
                const Icon = index === 0 ? DraftingCompass : index === 1 ? Layers3 : Move3D;
                return (
                  <article
                    key={step.title}
                    className="rounded-[26px] border border-[#e8dfd2] bg-white/78 p-6 shadow-[0_14px_40px_rgba(66,50,28,0.06)]"
                  >
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f5ede2] text-[#7b6751]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-xl font-light text-[#1f1a16]">{step.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#645a4f]">{step.body}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mt-20">
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#94836d]">
                <Sparkles className="h-3.5 w-3.5" />
                {copy.sections.principles}
              </div>
              <h2 className="mt-3 text-3xl font-light text-[#201b17] sm:text-4xl">
                {copy.sections.principlesTitle}
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {copy.principles.map((item) => (
                <article key={item.title} className="rounded-[24px] border border-[#e5dbcf] bg-[#fdf9f3] p-6">
                  <h3 className="text-lg font-light text-[#241f1a]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#64594d]">{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-20 rounded-[28px] border border-[#dfd3c3] bg-[#f8f1e6] px-6 py-10 sm:px-10">
            <h2 className="max-w-3xl text-3xl font-light text-[#1f1a16] sm:text-4xl">{copy.finalCtaTitle}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#655a4e]">{copy.finalCtaBody}</p>
            <div className="mt-7">
              <button
                type="button"
                onClick={routeToBuilder}
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#1f1a16] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#332a23]"
              >
                {copy.primary}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        </main>
      </div>

      <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
