"use client";

import { useEffect, useState } from "react";
import { useProjectStore, type Project } from "../../lib/stores/useProjectStore";
import { PremiumProjectCard } from "../../components/project/PremiumProjectCard";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Box, Compass, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export default function StudioPage() {
  const router = useRouter();
  const {
    projects,
    isLoading,
    loadProjects,
    deleteProject,
  } = useProjectStore();

  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f5f1e8] px-4 pb-20 pt-24 text-[#171411] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="grid gap-8 lg:grid-cols-[1fr_0.78fr]">
          <div className="rounded-[34px] bg-[#191512] p-8 text-[#f9f4ec] shadow-[0_34px_90px_rgba(0,0,0,0.22)] sm:p-10">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d8baa0]">
              <Sparkles className="h-4 w-4" />
              <span>내 공간</span>
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            className="mt-8 text-5xl font-light tracking-tight sm:text-6xl"
          >
              저장된 프로젝트와 공간을 관리하세요.
              <br />
              준비되면 새 방을 생성해 시작합니다.
            </motion.h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-[#d7cbc1]">
              저장한 공간, 임시 초안, 발행 스냅샷을 한 곳에서 확인합니다. 새 생성은 빌더에서 시작해 3D 에디터로
              바로 이어집니다.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => router.push("/studio/builder?intent=custom")}
                className="inline-flex items-center gap-3 rounded-full bg-[#f7e8d7] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#1b1714] transition hover:bg-white"
              >
                새 방 만들기
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => router.push("/studio/builder?intent=template")}
                className="inline-flex items-center gap-3 rounded-full border border-white/20 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f7efe5] transition hover:border-white/50 hover:bg-white/5"
              >
                템플릿 선택
              </button>
              <button
                type="button"
                onClick={() => router.push("/gallery")}
                className="inline-flex items-center gap-3 rounded-full border border-white/20 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f7efe5] transition hover:border-white/50 hover:bg-white/5"
              >
                갤러리 보기
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_44px_rgba(68,52,34,0.1)] backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">저장 공간</div>
              <div className="mt-4 text-4xl ">{projects.length}</div>
              <p className="mt-3 text-sm leading-7 text-[#61574e]">스튜디오에 저장된 공간, 초안, 공유 장면 수입니다.</p>
            </div>
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_44px_rgba(68,52,34,0.1)] backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">생성 경로</div>
              <div className="mt-4 flex items-center gap-3 text-2xl ">
                <Compass className="h-5 w-5 text-[#c06e3d]" />
                빌더 → 에디터 → 발행
              </div>
              <p className="mt-3 text-sm leading-7 text-[#61574e]">
                신규 생성은 빌더 중심 메인 경로만 사용하며, 레거시 경로는 운영 호환 범위로만 유지됩니다.
              </p>
            </div>
          </div>
        </header>

        <section className="mt-14">
          <div className="mb-8 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8a7c70]">
            <Box className="h-4 w-4" />
            <span>최근 공간</span>
          </div>

          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {projects.map((project) => (
              <PremiumProjectCard
                key={project.id}
                project={project}
                onSelect={(id) => router.push(`/project/${id}`)}
                onDelete={(p) => setPendingDelete(p)}
              />
            ))}
          </AnimatePresence>
          </div>
        </section>

        {!isLoading && projects.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            className="flex flex-col items-center justify-center py-40 space-y-6"
          >
            <Box size={64} strokeWidth={0.5} />
            <p className="text-[10px] uppercase tracking-[0.5em] font-bold">저장된 공간 없음</p>
            <button
              type="button"
              onClick={() => router.push("/studio/builder?intent=custom")}
              className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/80 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2f261d] transition hover:border-black/35 hover:bg-white"
            >
              첫 공간 만들기
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => router.push("/studio/builder?intent=template")}
              className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/80 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2f261d] transition hover:border-black/35 hover:bg-white"
            >
              템플릿으로 시작
            </button>
          </motion.div>
        )}

        {isLoading && projects.length === 0 && (
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-[3/4] rounded-sm bg-[#f3f3f1] animate-pulse" />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="w-full max-w-md bg-white rounded-sm border border-[#e5e5e0] shadow-2xl p-10"
            >
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#999999]">삭제 확인</p>
                <h3 className="text-2xl font-light">
                  “{pendingDelete.name}”을 삭제할까요?
                </h3>
                <p className="text-[11px] text-[#666666] leading-relaxed">
                  삭제 후에는 되돌릴 수 없습니다. 프로젝트와 로컬 데이터가 함께 제거됩니다.
                </p>
              </div>

              <div className="mt-8 flex items-center gap-3">
                <button
                  onClick={() => setPendingDelete(null)}
                  className="flex-1 py-3 border border-[#e5e5e0] text-[10px] font-bold uppercase tracking-[0.3em] text-[#666666] hover:text-black hover:border-black transition-all"
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    if (!pendingDelete) return;
                    await deleteProject(pendingDelete.id);
                    setPendingDelete(null);
                  }}
                  className="flex-1 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-red-600 transition-all"
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
