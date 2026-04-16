"use client";

import { useEffect, useMemo, useState } from "react";
import { useProjectStore, type Project } from "../../lib/stores/useProjectStore";
import { PremiumProjectCard } from "../../components/project/PremiumProjectCard";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Box, Compass, Layers3, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { getProjectAssetSummary } from "../../lib/builder/catalog";

type StudioFilter = "all" | "recent" | "styled" | "empty";

function isRecentProject(updatedAt: string) {
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= 1000 * 60 * 60 * 24 * 14;
}

export default function StudioPage() {
  const router = useRouter();
  const { projects, isLoading, loadProjects, deleteProject } = useProjectStore();

  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [activeFilter, setActiveFilter] = useState<StudioFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const projectRows = useMemo(
    () =>
      projects.map((project) => {
        const assetSummary = getProjectAssetSummary(project.metadata);
        return {
          project,
          assetSummary,
          totalAssets: assetSummary?.totalAssets ?? 0,
          isRecent: isRecentProject(project.updated_at)
        };
      }),
    [projects]
  );

  const visibleProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return projectRows
      .filter((entry) => {
        if (activeFilter === "recent" && !entry.isRecent) return false;
        if (activeFilter === "styled" && entry.totalAssets === 0) return false;
        if (activeFilter === "empty" && entry.totalAssets > 0) return false;
        if (query.length === 0) return true;
        const haystack = [entry.project.name, entry.project.description ?? ""].join(" ").toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => new Date(b.project.updated_at).getTime() - new Date(a.project.updated_at).getTime());
  }, [activeFilter, projectRows, searchQuery]);

  const stats = useMemo(
    () => ({
      total: projectRows.length,
      styled: projectRows.filter((entry) => entry.totalAssets > 0).length,
      recent: projectRows.filter((entry) => entry.isRecent).length
    }),
    [projectRows]
  );

  const filterTabs: Array<{ id: StudioFilter; label: string }> = [
    { id: "all", label: "전체" },
    { id: "recent", label: "최근 편집" },
    { id: "styled", label: "가구 배치됨" },
    { id: "empty", label: "빈 공간" }
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f6f5f1] px-4 pb-20 pt-6 text-[#171411] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_340px]">
          <div className="rounded-[28px] border border-black/10 bg-white/80 p-7 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">
              <Sparkles className="h-4 w-4" />
              <span>내 공간</span>
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-[32px] font-semibold tracking-tight text-[#171411] sm:text-[44px]"
            >
              저장한 프로젝트를 갤러리 톤으로 정리해서 보는 아카이브
            </motion.h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#625a51]">
              저장한 공간, 임시 초안, 발행 스냅샷을 한 곳에서 확인합니다. 새 생성은 빌더에서 시작해 3D 에디터로
              바로 이어집니다.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push("/studio/builder?intent=custom")}
                className="inline-flex items-center gap-3 rounded-full bg-[#171411] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[#2a241e]"
              >
                새 방 만들기
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => router.push("/studio/select?mode=empty")}
                className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#171411] transition hover:border-black/20 hover:bg-[#faf7f2]"
              >
                공간 선택
              </button>
              <button
                type="button"
                onClick={() => router.push("/gallery")}
                className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#171411] transition hover:border-black/20 hover:bg-[#faf7f2]"
              >
                갤러리 보기
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[24px] border border-black/10 bg-white/82 p-5 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">저장 공간</div>
              <div className="mt-4 text-3xl font-semibold">{stats.total}</div>
              <p className="mt-2 text-sm leading-6 text-[#61574e]">내 스튜디오에 보관된 전체 프로젝트 수</p>
            </div>
            <div className="rounded-[24px] border border-black/10 bg-white/82 p-5 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">가구 배치됨</div>
              <div className="mt-4 text-3xl font-semibold">{stats.styled}</div>
              <p className="mt-2 text-sm leading-6 text-[#61574e]">씬 안에 자산이 실제로 들어간 프로젝트 수</p>
            </div>
            <div className="rounded-[24px] border border-black/10 bg-white/82 p-5 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">최근 편집</div>
              <div className="mt-4 flex items-center gap-3 text-2xl font-semibold">
                <Compass className="h-5 w-5 text-[#c06e3d]" />
                {stats.recent}
              </div>
              <p className="mt-2 text-sm leading-6 text-[#61574e]">
                지난 2주 안에 다시 연 프로젝트 수입니다.
              </p>
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-[24px] border border-black/10 bg-white/76 p-5 shadow-[0_18px_46px_rgba(68,52,34,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`rounded-full px-4 py-2.5 text-[11px] font-semibold transition ${
                    activeFilter === tab.id
                      ? "bg-[#171411] text-white"
                      : "border border-black/10 bg-[#faf7f2] text-[#625a51] hover:border-black/20"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <label className="flex w-full items-center gap-3 rounded-full border border-black/10 bg-[#faf7f2] px-4 py-3 text-[#8a8177] lg:max-w-[320px]">
              <Search className="h-4 w-4" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="프로젝트 이름 검색"
                className="w-full bg-transparent text-sm text-[#171411] outline-none placeholder:text-[#9a9188]"
              />
            </label>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">
            <Layers3 className="h-4 w-4" />
            <span>프로젝트 아카이브</span>
          </div>

          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {visibleProjects.map(({ project }) => (
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

        {!isLoading && visibleProjects.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            className="flex flex-col items-center justify-center py-40 space-y-6"
          >
            <Box size={64} strokeWidth={0.5} />
            <p className="text-[10px] uppercase tracking-[0.5em] font-bold">
              {projects.length === 0 ? "저장된 공간 없음" : "조건에 맞는 공간 없음"}
            </p>
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
              onClick={() => router.push("/studio/select?mode=empty")}
              className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/80 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2f261d] transition hover:border-black/35 hover:bg-white"
            >
              공간 선택
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
