import Link from "next/link";
import { ArrowUpRight, Layers3, Link2 } from "lucide-react";
import { getCatalogPreviewClasses } from "../../lib/builder/catalog";
import type { SharePreviewMeta } from "../../lib/share/preview";

type PublishedSnapshotCardProps = {
  token: string;
  thumbnail?: string;
  previewMeta: SharePreviewMeta | null;
  publishedAt: string;
};

export function PublishedSnapshotCard({
  token,
  thumbnail,
  previewMeta,
  publishedAt
}: PublishedSnapshotCardProps) {
  const previewTheme = getCatalogPreviewClasses(previewMeta?.assetSummary?.primaryTone ?? "sand");
  const projectName = previewMeta?.projectName ?? "Shared Room";
  const projectDescription = previewMeta?.projectDescription ?? "Pinned builder snapshot ready for read-only walkthrough.";
  const collections = previewMeta?.assetSummary?.collections ?? [];
  const highlighted = previewMeta?.assetSummary?.highlightedItems ?? [];

  return (
    <Link
      href={`/shared/${token}`}
      className="group flex h-full flex-col overflow-hidden rounded-[30px] border border-black/10 bg-white/80 shadow-[0_22px_70px_rgba(38,24,14,0.09)] transition hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(38,24,14,0.14)]"
    >
      <div className="relative aspect-[16/11] overflow-hidden border-b border-black/8 bg-[#f3eee6]">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={projectName}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div className={`absolute inset-0 flex flex-col justify-between p-6 ${previewTheme.surface}`}>
            <div className="flex items-start justify-between gap-3">
              <div className={`rounded-full border px-3 py-2 text-[9px] font-bold uppercase tracking-[0.22em] ${previewTheme.chip}`}>
                {previewMeta?.assetSummary?.primaryCollection ?? "Pinned Snapshot"}
              </div>
              <Link2 className="h-6 w-6 text-black/15" />
            </div>
            {highlighted.length > 0 ? (
              <div className="space-y-2">
                {highlighted.slice(0, 2).map((item) => (
                  <div key={item.catalogItemId ?? item.assetId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="line-clamp-1">{item.label}</span>
                    <span className="text-[11px] font-semibold opacity-65">x{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-lg font-medium">{projectName}</div>
            )}
          </div>
        )}

        <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur">
          <Layers3 className="h-3.5 w-3.5" />
          {previewMeta?.versionNumber ? `Snapshot v${previewMeta.versionNumber}` : "Published"}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-6">
        <div>
          <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#8a7c70]">
            <span>Showcase</span>
            <span>{new Date(publishedAt).toLocaleDateString()}</span>
          </div>
          <h3 className="mt-4 text-3xl font-cormorant font-light leading-tight text-[#171411]">{projectName}</h3>
          <p className="mt-3 line-clamp-3 text-sm leading-7 text-[#5f554b]">{projectDescription}</p>
          {collections.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {collections.slice(0, 3).map((collection) => (
                <span
                  key={collection.label}
                  className="rounded-full border border-black/10 bg-[#f7f2ea] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#736659]"
                >
                  {collection.label} {collection.count}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-black/10 pt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#52483f]">
          <span>Open pinned viewer</span>
          <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </Link>
  );
}
