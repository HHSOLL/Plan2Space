"use client";

import React from "react";
import { motion } from "framer-motion";
import { Clock3, Layers3, Trash2 } from "lucide-react";
import { getCatalogPreviewClasses, getProjectAssetSummary } from "../../lib/builder/catalog";
import type { Project } from "../../lib/stores/useProjectStore";

interface PremiumProjectCardProps {
  project: Project;
  onSelect: (id: string) => void;
  onDelete: (project: Project) => void;
}

const PremiumProjectCardComponent = React.forwardRef<HTMLDivElement, PremiumProjectCardProps>(function PremiumProjectCard(
  { project, onSelect, onDelete },
  ref
) {
  const assetSummary = getProjectAssetSummary(project.metadata);
  const previewTheme = getCatalogPreviewClasses(assetSummary?.primaryTone ?? "sand");
  const secondaryLabel = assetSummary?.totalAssets ? `제품 ${assetSummary.totalAssets}개` : "초안 공간";

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-black/10 bg-white shadow-[0_10px_26px_rgba(38,24,14,0.08)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_18px_42px_rgba(38,24,14,0.12)]"
    >
      <div
        className="relative aspect-[16/10] cursor-pointer overflow-hidden bg-[#ebe5db]"
        onClick={() => onSelect(project.id)}
      >
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
          />
        ) : (
          <div className={`absolute inset-0 flex flex-col justify-end p-5 ${previewTheme.surface}`}>
            <div className="text-lg font-medium">{project.name}</div>
          </div>
        )}

        <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/32 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur">
          <Layers3 className="h-3.5 w-3.5" />
          {assetSummary?.primaryCollection ?? "빌더 공간"}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="text-[16px] font-semibold leading-6 text-[#171411]">{project.name}</h3>
          <div className="mt-1 text-[13px] text-[#8a8177]">{secondaryLabel}</div>
          <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-[#625a51]">
            {project.description || "빌더에서 저장된 공간입니다. 열어서 바로 수정하거나 발행 흐름으로 이어갈 수 있습니다."}
          </p>

          {assetSummary?.collections?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {assetSummary.collections.slice(0, 3).map((collection) => (
                <span
                  key={`${project.id}-${collection.label}`}
                  className="rounded-full border border-black/10 bg-[#f7f3ec] px-2.5 py-1 text-[10px] font-semibold text-[#7b6e61]"
                >
                  {collection.label} {collection.count}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-[#625a51]">
            <Clock3 className="h-3.5 w-3.5" />
            {new Date(project.updated_at).toLocaleDateString("ko-KR")}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete(project)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-[#74695d] transition hover:border-red-300 hover:text-red-500"
              aria-label={`${project.name} 삭제`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onSelect(project.id)}
              className="inline-flex rounded-full border border-black px-4 py-2 text-[11px] font-semibold text-[#171411] transition hover:bg-black hover:text-white"
            >
              열기
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

PremiumProjectCardComponent.displayName = "PremiumProjectCard";

export { PremiumProjectCardComponent as PremiumProjectCard };
export default PremiumProjectCardComponent;
