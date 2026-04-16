"use client";

import { Bell, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../lib/stores/useAuthStore";

function SettingsCard({
  icon,
  eyebrow,
  title,
  body
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <section className="rounded-[22px] border border-black/10 bg-white p-6 shadow-[0_14px_40px_rgba(36,26,18,0.06)]">
      <div className="flex items-center gap-3 text-[#7a6f63]">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-[#f7f5f1]">
          {icon}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em]">{eyebrow}</div>
      </div>
      <h2 className="mt-4 text-xl font-semibold text-[#171411]">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-[#625a51]">{body}</p>
    </section>
  );
}

export default function MyPage() {
  const router = useRouter();
  const { user, session, isLoading } = useAuthStore();
  const isAuthenticated = Boolean(session?.user);
  const initials = useMemo(() => {
    const source = (user?.name ?? user?.email ?? "M").trim();
    return source.slice(0, 1).toUpperCase();
  }, [user?.email, user?.name]);

  return (
    <div className="min-h-screen bg-[#f6f5f1] px-4 pb-20 pt-10 text-[#171411] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1280px]">
        <header className="grid gap-6 rounded-[28px] border border-black/10 bg-white px-6 py-7 shadow-[0_22px_64px_rgba(44,32,20,0.08)] sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a8177]">마이페이지</div>
            <h1 className="mt-3 text-[32px] font-semibold tracking-tight sm:text-[42px]">
              계정과 기본 환경설정을 관리합니다.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#625a51]">
              로그인 정보, 편집 기본값, 알림 성격처럼 자주 바뀌지 않는 설정만 간단하게 다루는 페이지입니다.
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-[22px] border border-black/10 bg-[#f8f6f1] px-5 py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#171411] text-lg font-semibold text-white">
              {initials}
            </div>
            <div>
              <div className="text-sm font-semibold text-[#171411]">
                {isLoading ? "세션 확인 중" : user?.name ?? "게스트"}
              </div>
              <div className="mt-1 text-xs text-[#7c7268]">{user?.email ?? "로그인 후 계정 정보를 확인할 수 있습니다."}</div>
            </div>
          </div>
        </header>

        {!isAuthenticated ? (
          <section className="mt-8 rounded-[24px] border border-dashed border-black/12 bg-white/72 px-6 py-10 text-center shadow-[0_18px_46px_rgba(44,32,20,0.06)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a8177]">로그인이 필요합니다</div>
            <h2 className="mt-4 text-3xl font-semibold text-[#171411]">계정 정보를 보려면 로그인해 주세요.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#625a51]">
              상단바에서 로그인한 뒤 다시 오면 저장된 공간, 기본 편집 성향, 공지 설정을 이 화면에서 볼 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-6 inline-flex rounded-full border border-black/10 bg-white px-5 py-3 text-[11px] font-semibold text-[#52483f] transition hover:border-black/20 hover:bg-[#faf7f2]"
            >
              홈으로 이동
            </button>
          </section>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <SettingsCard
              icon={<UserRound className="h-5 w-5" />}
              eyebrow="프로필"
              title="계정 이름과 이메일"
              body="현재 로그인한 이름과 이메일을 확인하는 영역입니다. 프로필 편집 흐름은 추후 연결하고, 우선은 읽기 중심으로 단순하게 유지합니다."
            />
            <SettingsCard
              icon={<SlidersHorizontal className="h-5 w-5" />}
              eyebrow="기본값"
              title="편집 기본 환경"
              body="상단뷰 시작, 방 스케일 단위, 자주 쓰는 자산 카테고리 같은 기본 편집 설정을 추후 이 카드에서 관리합니다."
            />
            <SettingsCard
              icon={<Bell className="h-5 w-5" />}
              eyebrow="알림"
              title="공유와 발행 알림"
              body="공유 링크 발행, 커뮤니티 노출, 저장 실패 같은 주요 상태만 받아보는 단순한 알림 구성을 기준으로 유지합니다."
            />
          </div>
        )}

        <section className="mt-8 rounded-[24px] border border-black/10 bg-[#faf8f4] px-6 py-6 shadow-[0_18px_46px_rgba(44,32,20,0.05)]">
          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7f7468]">
            <ShieldCheck className="h-4 w-4" />
            보안 및 운영 메모
          </div>
          <p className="mt-4 text-sm leading-7 text-[#625a51]">
            비밀번호 재설정, 외부 로그인 연동, 커뮤니티 노출 기본 정책 같은 고정 설정은 이 페이지에서 점진적으로 확장합니다.
            지금은 계정 요약과 기본 환경설정 성격만 보이도록 최소한으로 유지합니다.
          </p>
        </section>
      </div>
    </div>
  );
}
