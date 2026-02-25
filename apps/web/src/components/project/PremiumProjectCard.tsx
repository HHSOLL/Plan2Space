"use client";

import React from "react";
import { motion } from "framer-motion";
import { Folder, Clock, Trash2 } from "lucide-react";
import type { Project } from "../../lib/stores/useProjectStore";

interface PremiumProjectCardProps {
    project: Project;
    onSelect: (id: string) => void;
    onDelete: (project: Project) => void;
}

const PremiumProjectCardComponent = React.forwardRef<HTMLDivElement, PremiumProjectCardProps>(
    function PremiumProjectCard({ project, onSelect, onDelete }, ref) {
        return (
            <motion.div
                ref={ref}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="arch-card group flex flex-col h-full rounded-sm overflow-hidden"
            >
                {/* Thumbnail */}
                <div
                    className="relative aspect-[16/10] overflow-hidden bg-[#f3f3f1] cursor-pointer"
                    onClick={() => onSelect(project.id)}
                >
                    {project.thumbnail ? (
                        <img
                            src={project.thumbnail}
                            alt={project.name}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center p-12">
                            <Folder className="w-8 h-8 text-black/5" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-8 flex-1 flex flex-col justify-between border-t border-[#e5e5e0]">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-[#999999] tracking-[0.3em] uppercase">
                                Project №{project.id.slice(0, 3).toUpperCase()}
                            </span>
                            <div className="flex items-center gap-1.5 text-black/20">
                                <Clock className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                    {new Date(project.updated_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xl font-cormorant font-light group-hover:text-black transition-colors">
                                {project.name}
                            </h3>
                            <p className="text-[10px] text-[#666666] font-medium uppercase tracking-[0.1em] line-clamp-2 leading-relaxed h-10">
                                {project.description || "No project description provided."}
                            </p>
                        </div>
                    </div>

                    <div className="pt-8 flex items-center gap-4">
                        <button
                            onClick={() => onSelect(project.id)}
                            className="flex-1 py-4 border border-[#1a1a1a] text-[9px] font-bold uppercase tracking-[0.3em] hover:bg-[#1a1a1a] hover:text-white transition-all"
                        >
                            View Case
                        </button>
                        <button
                            onClick={() => onDelete(project)}
                            className="p-4 border border-[#e5e5e0] text-[#999999] hover:text-red-500 hover:border-red-500/50 transition-all"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }
);

PremiumProjectCardComponent.displayName = "PremiumProjectCard";

export { PremiumProjectCardComponent as PremiumProjectCard };
export default PremiumProjectCardComponent;
