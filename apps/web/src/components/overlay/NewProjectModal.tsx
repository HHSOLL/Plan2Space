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
              Builder-first launch
            </div>
            <h2 className="mt-6 max-w-xl font-cormorant text-5xl font-light leading-[1.02] text-[#f7efe6]">
              Start new rooms from the builder, not from floorplan upload.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/60">
              The default creation path now opens the IKEA-style room builder first. Older floorplan projects now open
              in compatibility mode only and are no longer part of new project creation.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
                  <Box className="h-4 w-4" />
                  Recommended
                </div>
                <div className="mt-4 text-2xl font-cormorant text-[#f7efe6]">Room Builder</div>
                <p className="mt-3 text-sm leading-6 text-white/55">
                  Create a room shell, choose finishes, then move directly into top and walk editing.
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
                  <Upload className="h-4 w-4" />
                  Secondary
                </div>
                <div className="mt-4 text-2xl font-cormorant text-[#f7efe6]">Studio Library</div>
                <p className="mt-3 text-sm leading-6 text-white/55">
                  Browse existing spaces and project entry points before launching a new builder session.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleOpenBuilder}
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#f4e4d3] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.26em] text-[#1f1711] transition hover:bg-white"
              >
                Open Room Builder
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleOpenStudio}
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                Go to Studio
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
