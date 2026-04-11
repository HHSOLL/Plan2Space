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
              <span>My Rooms</span>
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            className="mt-8 text-5xl font-cormorant font-light tracking-tight sm:text-6xl"
          >
              Projects and saved rooms.
              <br />
              Start a new room when you are ready.
            </motion.h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-[#d7cbc1]">
              Your saved rooms, drafts, and published scene snapshots live here. New creation starts in the builder,
              then opens directly in the 3D editor.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => router.push("/studio/builder?intent=custom")}
                className="inline-flex items-center gap-3 rounded-full bg-[#f7e8d7] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#1b1714] transition hover:bg-white"
              >
                Start a room
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => router.push("/gallery")}
                className="inline-flex items-center gap-3 rounded-full border border-white/20 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f7efe5] transition hover:border-white/50 hover:bg-white/5"
              >
                Explore lookbook
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_44px_rgba(68,52,34,0.1)] backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">Saved rooms</div>
              <div className="mt-4 text-4xl font-cormorant">{projects.length}</div>
              <p className="mt-3 text-sm leading-7 text-[#61574e]">Saved rooms, drafts, and shareable scenes in your studio.</p>
            </div>
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_44px_rgba(68,52,34,0.1)] backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">Create path</div>
              <div className="mt-4 flex items-center gap-3 text-2xl font-cormorant">
                <Compass className="h-5 w-5 text-[#c06e3d]" />
                Builder → Editor → Publish
              </div>
              <p className="mt-3 text-sm leading-7 text-[#61574e]">
                Floorplan intake is now compatibility-only for older rooms and no longer appears in new project flow.
              </p>
            </div>
          </div>
        </header>

        <section className="mt-14">
          <div className="mb-8 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8a7c70]">
            <Box className="h-4 w-4" />
            <span>Recent Rooms</span>
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
            <p className="text-[10px] uppercase tracking-[0.5em] font-bold">Studio Empty</p>
            <button
              type="button"
              onClick={() => router.push("/studio/builder?intent=custom")}
              className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/80 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2f261d] transition hover:border-black/35 hover:bg-white"
            >
              Create first room
              <ArrowRight className="h-4 w-4" />
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
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#999999]">Confirm Deletion</p>
                <h3 className="text-2xl font-cormorant font-light">
                  Delete “{pendingDelete.name}”?
                </h3>
                <p className="text-[11px] text-[#666666] leading-relaxed">
                  This action cannot be undone. The project and its local data will be removed.
                </p>
              </div>

              <div className="mt-8 flex items-center gap-3">
                <button
                  onClick={() => setPendingDelete(null)}
                  className="flex-1 py-3 border border-[#e5e5e0] text-[10px] font-bold uppercase tracking-[0.3em] text-[#666666] hover:text-black hover:border-black transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!pendingDelete) return;
                    await deleteProject(pendingDelete.id);
                    setPendingDelete(null);
                  }}
                  className="flex-1 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-red-600 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
