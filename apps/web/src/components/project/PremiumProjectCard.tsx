"use client";

import React from "react";
import { motion } from "framer-motion";
import { Folder, Clock, Trash2 } from "lucide-react";
import { getCatalogPreviewClasses, getProjectAssetSummary } from "../../lib/builder/catalog";
import type { Project } from "../../lib/stores/useProjectStore";

interface PremiumProjectCardProps {
    project: Project;
    onSelect: (id: string) => void;
    onDelete: (project: Project) => void;
}

const PremiumProjectCardComponent = React.forwardRef<HTMLDivElement, PremiumProjectCardProps>(
    function PremiumProjectCard({ project, onSelect, onDelete }, ref) {
        const assetSummary = getProjectAssetSummary(project.metadata);
        const previewTheme = getCatalogPreviewClasses(assetSummary?.primaryTone ?? "sand");
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
                        <div className={`absolute inset-0 p-6 ${previewTheme.surface}`}>
                            <div className="flex h-full flex-col justify-between">
                                <div className="flex items-start justify-between gap-3">
                                    <div className={`rounded-full border px-3 py-2 text-[9px] font-bold uppercase tracking-[0.24em] ${previewTheme.chip}`}>
                                        {assetSummary?.primaryCollection ?? "빌더 공간"}
                                    </div>
                                    <Folder className="w-8 h-8 text-black/10" />
                                </div>
                                {assetSummary && assetSummary.highlightedItems.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] opacity-55">
                                            배치 제품
                                        </div>
                                        <div className="space-y-2">
                                            {assetSummary.highlightedItems.slice(0, 2).map((item) => (
                                                <div key={`${project.id}-${item.assetId}-${item.catalogItemId ?? "asset"}`} className="flex items-center justify-between gap-3 text-sm">
                                                    <span className="line-clamp-1">{item.label}</span>
                                                    <span className="text-[11px] font-semibold opacity-65">x{item.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-8 flex-1 flex flex-col justify-between border-t border-[#e5e5e0]">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-[#999999] tracking-[0.3em] uppercase">
                                프로젝트 №{project.id.slice(0, 3).toUpperCase()}
                            </span>
                            <div className="flex items-center gap-1.5 text-black/20">
                                <Clock className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                    {new Date(project.updated_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xl font-light group-hover:text-black transition-colors">
                                {project.name}
                            </h3>
                            <p className="text-[10px] text-[#666666] font-medium uppercase tracking-[0.1em] line-clamp-2 leading-relaxed h-10">
                                {project.description || "프로젝트 설명이 없습니다."}
                            </p>
                            {assetSummary ? (
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {assetSummary.collections.slice(0, 2).map((collection) => (
                                        <span
                                            key={`${project.id}-${collection.label}`}
                                            className="rounded-full border border-black/10 bg-[#f7f3ec] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#7b6e61]"
                                        >
                                            {collection.label} {collection.count}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="pt-8 flex items-center gap-4">
                        <button
                            onClick={() => onSelect(project.id)}
                            className="flex-1 py-4 border border-[#1a1a1a] text-[9px] font-bold uppercase tracking-[0.3em] hover:bg-[#1a1a1a] hover:text-white transition-all"
                        >
                            열기
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
