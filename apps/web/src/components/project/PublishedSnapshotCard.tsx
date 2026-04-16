import Link from "next/link";
import { Layers3 } from "lucide-react";
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
  const totalAssets = previewMeta?.assetSummary?.totalAssets ?? 0;
  const primaryCollection = previewMeta?.assetSummary?.primaryCollection ?? "가구 배치";
  const secondaryLabel = totalAssets > 0 ? `제품 ${totalAssets}개` : "읽기 전용 뷰어";

  return (
    <Link
      href={`/shared/${token}`}
      className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-black/10 bg-white shadow-[0_10px_26px_rgba(38,24,14,0.08)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_18px_42px_rgba(38,24,14,0.12)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[#ebe5db]">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={projectName}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
          />
        ) : (
          <div className={`absolute inset-0 flex flex-col justify-end p-5 ${previewTheme.surface}`}>
            <div className="text-lg font-medium">{projectName}</div>
          </div>
        )}

        <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/32 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur">
          <Layers3 className="h-3.5 w-3.5" />
          {previewMeta?.versionNumber ? `장면 v${previewMeta.versionNumber}` : "발행 장면"}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="text-[16px] font-semibold leading-6 text-[#171411]">{projectName}</h3>
          <div className="mt-1 text-[13px] text-[#8a8177]">{secondaryLabel}</div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[#625a51]">
          <span>{primaryCollection}</span>
          <span>{new Date(publishedAt).toLocaleDateString("ko-KR")}</span>
        </div>
      </div>
    </Link>
  );
}
