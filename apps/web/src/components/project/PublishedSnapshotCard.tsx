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
  const projectName = previewMeta?.projectName ?? "공유 공간";
  const projectDescription = previewMeta?.projectDescription ?? "읽기 전용 뷰어에서 확인 가능한 발행 장면";
  const collections = previewMeta?.assetSummary?.collections ?? [];
  const highlighted = previewMeta?.assetSummary?.highlightedItems ?? [];

  return (
    <Link
      href={`/shared/${token}`}
      className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-black/10 bg-white/86 shadow-[0_16px_42px_rgba(38,24,14,0.08)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_22px_56px_rgba(38,24,14,0.12)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#ebe5db]">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={projectName}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
          />
        ) : (
          <div className={`absolute inset-0 flex flex-col justify-between p-5 ${previewTheme.surface}`}>
            <div className="flex items-start justify-between gap-3">
              <div className={`rounded-md border px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] ${previewTheme.chip}`}>
                {previewMeta?.assetSummary?.primaryCollection ?? "큐레이션 장면"}
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

        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-md border border-white/20 bg-black/32 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur">
          <Layers3 className="h-3.5 w-3.5" />
          {previewMeta?.versionNumber ? `장면 v${previewMeta.versionNumber}` : "발행 장면"}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a7c70]">
              <span>발행 장면</span>
            <span>{new Date(publishedAt).toLocaleDateString()}</span>
          </div>
          <h3 className="mt-3 text-[28px] font-semibold leading-tight text-[#171411]">{projectName}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#5f554b]">{projectDescription}</p>
          {collections.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {collections.slice(0, 3).map((collection) => (
                <span
                  key={collection.label}
                  className="rounded-md border border-black/10 bg-[#f7f2ea] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#736659]"
                >
                  {collection.label} {collection.count}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-black/8 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#52483f]">
          <span>장면 열기</span>
          <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </Link>
  );
}
