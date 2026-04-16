"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthPopup } from "../components/overlay/AuthPopup";
import { useAuthStore } from "../lib/stores/useAuthStore";

type StartCardProps = {
  badge: string;
  imageSrc: string;
  title: string;
  buttonLabel: string;
  onClick: () => void;
};

function StartCard({ badge, imageSrc, title, buttonLabel, onClick }: StartCardProps) {
  return (
    <article className="overflow-hidden bg-white">
      <div className="relative aspect-[1.3/0.85] bg-[#d9d9d7]">
        <Image src={imageSrc} alt={title} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
        <div className="absolute left-8 top-7 rounded-[9px] border border-[#979797] bg-white px-8 py-4 text-[18px] font-semibold text-[#3e3e3e]">
          {badge}
        </div>
      </div>
      <div className="space-y-10 px-8 py-10">
        <h2 className="max-w-[700px] text-[38px] font-semibold leading-[1.18] tracking-[-0.05em] text-[#1d1d1d] sm:text-[44px]">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClick}
          className="rounded-full border border-[#262626] px-12 py-6 text-[20px] font-semibold tracking-[-0.02em] text-[#1f1f1f] transition hover:bg-[#111111] hover:text-white"
        >
          {buttonLabel}
        </button>
      </div>
    </article>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { session } = useAuthStore();
  const isAuthenticated = Boolean(session?.user);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authNextPath, setAuthNextPath] = useState<string | undefined>(undefined);

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
      <div className="min-h-screen bg-white px-5 pb-24 pt-10 text-[#181818] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1820px]">
          <h1 className="text-[58px] font-semibold tracking-[-0.06em] text-[#181818] sm:text-[72px]">시작하는 방법</h1>

          <section className="mt-16 grid gap-10 xl:grid-cols-2">
            <StartCard
              badge="퀵 스타트"
              imageSrc="/home/img7.jpg"
              title="비어 있거나 가구가 있는 공간에서 아이디어를 테스트해보세요"
              buttonLabel="공간 선택"
              onClick={() => requireAuth("/studio/select?mode=empty")}
            />
            <StartCard
              badge="맞춤형"
              imageSrc="/home/img3.jpg"
              title="집안 레이아웃에 맞는 공간 만들기"
              buttonLabel="공간 만들기"
              onClick={() => requireAuth("/studio/builder?intent=custom")}
            />
          </section>
        </div>
      </div>

      <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} nextPath={authNextPath} />
    </>
  );
}
