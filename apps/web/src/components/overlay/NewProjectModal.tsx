"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Box, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function NewProjectModal({ isOpen, onClose, onCreated }: NewProjectModalProps) {
  const router = useRouter();

  const handleOpenBuilder = () => {
    onCreated?.();
    onClose();
    router.push("/studio/builder");
  };

  const handleOpenStudio = () => {
    onClose();
    router.push("/studio");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 px-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/10 bg-[#15120f] p-8 text-white shadow-[0_32px_80px_rgba(0,0,0,0.35)] sm:p-10"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/55">
              공간 우선 시작
            </div>
            <h2 className="mt-6 max-w-xl text-4xl font-semibold leading-[1.1] text-[#f7efe6] sm:text-5xl">
              새 프로젝트는 룸 빌더에서 바로 시작합니다.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/60">
              기본 생성 경로는 방 모양/치수/문창/스타일을 먼저 설정한 뒤 에디터로 진입합니다. 기존 레거시 경로는
              신규 생성 화면에서 노출하지 않습니다.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
                  <Box className="h-4 w-4" />
                  권장
                </div>
                <div className="mt-4 text-2xl font-semibold text-[#f7efe6]">룸 빌더</div>
                <p className="mt-3 text-sm leading-6 text-white/55">
                  방 쉘을 만들고 스타일을 선택한 뒤 바로 3D 편집으로 이동합니다.
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
                  <Upload className="h-4 w-4" />
                  보조
                </div>
                <div className="mt-4 text-2xl font-semibold text-[#f7efe6]">스튜디오 보관함</div>
                <p className="mt-3 text-sm leading-6 text-white/55">
                  기존 프로젝트를 열거나 발행된 공간을 탐색할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleOpenBuilder}
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#f4e4d3] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.26em] text-[#1f1711] transition hover:bg-white"
              >
                룸 빌더 열기
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleOpenStudio}
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                스튜디오로 이동
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
