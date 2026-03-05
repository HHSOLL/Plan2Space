"use client";

import { useEffect, useState } from "react";
import { useProjectStore, type Project } from "../../lib/stores/useProjectStore";
import { PremiumProjectCard } from "../../components/project/PremiumProjectCard";
import { NewProjectModal } from "../../components/overlay/NewProjectModal";
import { motion, AnimatePresence } from "framer-motion";
import { Box } from "lucide-react";
import { useRouter } from "next/navigation";

export default function StudioPage() {
  const router = useRouter();
  const {
    projects,
    isLoading,
    error,
    loadProjects,
    deleteProject,
  } = useProjectStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  return (
    <div className="relative min-h-screen bg-[#fdfdfc] text-[#1a1a1a] overflow-x-hidden pt-24 md:pt-32 selection:bg-black/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 md:gap-12 mb-12 md:mb-20 pb-8 md:pb-12 border-b border-[#e5e5e0]">
          <div className="space-y-4 md:space-y-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 text-[#999999] uppercase tracking-[0.4em] text-[10px] font-bold"
            >
              <Box size={14} />
              <span>Project Collection</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-cormorant font-light tracking-tight"
            >
              PLAN2SPACE STUDIO
            </motion.h1>
          </div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => setIsModalOpen(true)}
            className="w-full md:w-auto px-8 md:px-12 py-4 md:py-5 bg-black text-white text-[10px] font-bold tracking-[0.25em] md:tracking-[0.3em] uppercase hover:bg-stone-800 transition-all shadow-sm"
          >
            New Project
          </motion.button>
        </header>

        {/* Project Grid */}
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {projects.map((project, idx) => (
              <PremiumProjectCard
                key={project.id}
                project={project}
                onSelect={(id) => router.push(`/project/${id}`)}
                onDelete={(p) => setPendingDelete(p)}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {!isLoading && projects.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            className="flex flex-col items-center justify-center py-64 space-y-6"
          >
            <Box size={64} strokeWidth={0.5} />
            <p className="text-[10px] uppercase tracking-[0.5em] font-bold">Workspace Empty</p>
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading && projects.length === 0 && (
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-[3/4] rounded-sm bg-[#f3f3f1] animate-pulse" />
            ))}
          </div>
        )}
      </div>

      {/* Floating Back Button removed - use global navbar */}

      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

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
