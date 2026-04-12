"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import type { LibraryCatalogItem } from "../../lib/builder/catalog";
import { StudioMetricGrid } from "./StudioMetricGrid";

type LaunchMetricItem = {
  label: string;
  value: string;
};

type BuilderLaunchStateProps = {
  metrics: LaunchMetricItem[];
  previewItems: LibraryCatalogItem[];
  onOpenBuilder: () => void;
  onBrowseStudio: () => void;
};

export function BuilderLaunchState({
  metrics,
  previewItems,
  onOpenBuilder,
  onBrowseStudio
}: BuilderLaunchStateProps) {
  return (
    <motion.div
      key="builder_launch_state"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: 40 }}
      className="flex h-full w-full items-center justify-center p-3 sm:p-10 lg:p-20"
    >
      <div className="grid h-full w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-dark flex flex-col justify-between rounded-[24px] border border-white/10 p-8 shadow-3xl sm:rounded-[44px] sm:p-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-white/50">
              <Sparkles className="h-3.5 w-3.5" />
              복구 상태
            </div>
            <h2 className="mt-8 max-w-3xl text-3xl font-light tracking-tight sm:text-5xl font-outfit">
              이 프로젝트에는 방 쉘 정보가 없습니다.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">
              빌더에서 유효한 방 구조를 먼저 생성한 뒤 에디터에서 배치, 스타일, 발행까지 진행하세요.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onOpenBuilder}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-black transition hover:bg-white/90"
              >
                빌더에서 복구
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onBrowseStudio}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white/75 transition hover:border-white/30 hover:bg-white/10"
              >
                프로젝트 목록 열기
              </button>
            </div>
          </div>

          <div className="mt-10">
            <StudioMetricGrid
              items={metrics}
              gridClassName="grid gap-3 sm:grid-cols-3"
              cardClassName="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
              labelClassName="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35"
            />
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/30 p-6 backdrop-blur-md sm:rounded-[44px] sm:p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <Sparkles className="h-5 w-5 text-white/55" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">
                복구 안내
              </p>
              <h3 className="mt-2 text-xl font-light font-outfit">
                공간 지오메트리가 없어 에디터를 열 수 없습니다.
              </h3>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-white/45">
            현재 스냅샷에서 벽/바닥 정보를 찾을 수 없을 때만 이 패널이 표시됩니다.
            빌더 또는 프로젝트 목록으로 이동해 동일 계정 컨텍스트에서 복구할 수 있습니다.
          </p>

          <div className="mt-6">
            <StudioMetricGrid items={metrics} />
          </div>

          <div className="mt-6 space-y-3">
            {previewItems.map((item) => (
              <div
                key={item.id}
                className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                      {item.category}
                    </p>
                    <h3 className="mt-2 text-base font-medium text-white">{item.label}</h3>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
                    추천
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/55">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
