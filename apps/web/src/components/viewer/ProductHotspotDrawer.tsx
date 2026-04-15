import { ArrowUpRight, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { getCatalogPreviewClasses } from "../../lib/builder/catalog";
import type { ProductHotspot } from "../../lib/viewer/hotspots";

type ProductHotspotDrawerProps = {
  hotspots: ProductHotspot[];
  selectedHotspotId: string | null;
  onSelectHotspot: (id: string) => void;
  children?: ReactNode;
};

function formatDimensionsMm(
  dimensions: { width: number; depth: number; height: number } | null
) {
  if (!dimensions) return null;
  return `W ${dimensions.width} / D ${dimensions.depth} / H ${dimensions.height} mm`;
}

export function ProductHotspotDrawer({
  hotspots,
  selectedHotspotId,
  onSelectHotspot,
  children
}: ProductHotspotDrawerProps) {
  const selectedHotspot = hotspots.find((hotspot) => hotspot.id === selectedHotspotId) ?? null;
  const selectedPreview = selectedHotspot ? getCatalogPreviewClasses(selectedHotspot.tone) : null;
  const selectedDimensions = formatDimensionsMm(selectedHotspot?.dimensionsMm ?? null);

  return (
    <aside className="p2s-workspace-panel p-4 sm:p-5 xl:order-1 xl:sticky xl:top-8 xl:self-start">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7e7367]">
            <Sparkles className="h-4 w-4" />
            제품 정보
          </div>
          <p className="mt-2 text-xs leading-6 text-[#6a6055]">
            장면의 마커를 클릭하거나 목록에서 제품을 선택하세요.
          </p>
        </div>
        <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#695f55]">
          {hotspots.length}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        <div className={`rounded-[20px] border border-black/10 p-4 ${selectedPreview?.surface ?? "bg-white"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e7367]">선택 제품</div>
            <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#6e6458]">
              {selectedHotspot ? `핫스팟 #${selectedHotspot.index + 1}` : "선택 대기"}
            </span>
          </div>
          {selectedHotspot ? (
            <div className="mt-3">
              {selectedHotspot.thumbnail ? (
                <div className="mb-3 overflow-hidden rounded-[14px] border border-black/10 bg-white/70">
                  <img
                    src={selectedHotspot.thumbnail}
                    alt={selectedHotspot.name}
                    className="h-36 w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="text-lg font-semibold leading-tight text-[#1f1b16]">{selectedHotspot.name}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6e6458]">
                  {selectedHotspot.category}
                </span>
                <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6e6458]">
                  {selectedHotspot.collection}
                </span>
                <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6e6458]">
                  {selectedHotspot.anchorType.replaceAll("_", " ")}
                </span>
                {selectedHotspot.scaleLocked ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#8a6a2c]">
                    실측 고정
                  </span>
                ) : null}
              </div>
              {selectedHotspot.price ? (
                <p className="mt-4 text-lg font-semibold text-[#1f1b16]">{selectedHotspot.price}</p>
              ) : (
                <p className="mt-4 text-lg font-semibold text-[#1f1b16]">가격 정보 확인 필요</p>
              )}
              <div className="mt-3 grid gap-2 text-[11px] text-[#5f564b]">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white/70 px-2.5 py-2">
                  <span className="uppercase tracking-[0.12em] text-[#84796d]">브랜드/재질</span>
                  <span className="font-semibold text-[#1f1b16]">
                    {selectedHotspot.brand ?? selectedHotspot.material ?? "브랜드/재질 정보 없음"}
                  </span>
                </div>
                {selectedDimensions ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white/70 px-2.5 py-2">
                    <span className="uppercase tracking-[0.12em] text-[#84796d]">실제 규격</span>
                    <span className="font-semibold text-right text-[#1f1b16]">{selectedDimensions}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white/70 px-2.5 py-2">
                  <span className="uppercase tracking-[0.12em] text-[#84796d]">옵션/규격</span>
                  <span className="font-semibold text-[#1f1b16]">{selectedHotspot.options ?? "기본 옵션"}</span>
                </div>
              </div>
              {selectedHotspot.finishColor || selectedHotspot.finishMaterial ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedHotspot.finishColor ? (
                    <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6e6458]">
                      색상 {selectedHotspot.finishColor}
                    </span>
                  ) : null}
                  {selectedHotspot.finishMaterial ? (
                    <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6e6458]">
                      재질 {selectedHotspot.finishMaterial}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {selectedHotspot.detailNotes ? (
                <div className="mt-3 rounded-[14px] border border-black/10 bg-white/75 px-3 py-3 text-xs leading-6 text-[#5f564b]">
                  {selectedHotspot.detailNotes}
                </div>
              ) : null}
              {selectedHotspot.externalUrl ? (
                <a
                  href={selectedHotspot.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-black/15 bg-[#f3eee5] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1f1b16] transition hover:bg-[#ebe4d7]"
                >
                  상품 페이지 열기
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : (
                <div className="mt-3 inline-flex w-full items-center justify-center rounded-[14px] border border-black/10 bg-white/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7c70]">
                  원본 상품 링크 없음
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[#61574d]">
              아직 선택된 제품이 없습니다. 캔버스 또는 목록에서 선택해 상세를 확인하세요.
            </p>
          )}
        </div>

        <div className="rounded-[18px] border border-black/10 bg-white p-4">
          <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e7367]">
            <span>핫스팟 목록</span>
            <span>{hotspots.length}</span>
          </div>
          {hotspots.length > 0 ? (
            <div className="mt-3 max-h-[340px] space-y-2.5 overflow-y-auto pr-1">
              {hotspots.map((hotspot) => {
                const preview = getCatalogPreviewClasses(hotspot.tone);
                const isActive = hotspot.id === selectedHotspotId;
                return (
                  <button
                    key={hotspot.id}
                    type="button"
                    onClick={() => onSelectHotspot(hotspot.id)}
                    aria-pressed={isActive}
                    aria-label={`핫스팟 ${hotspot.index + 1} 제품 확인: ${hotspot.name}`}
                    className={`group flex w-full items-stretch gap-3 rounded-[18px] border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 ${
                      isActive
                        ? "border-black/15 bg-[#f8f4ed] shadow-[0_14px_30px_rgba(29,24,18,0.08)]"
                        : "border-black/10 bg-[#fcfbf8] hover:border-black/20 hover:bg-white"
                    }`}
                  >
                    <div className={`relative h-[86px] w-[92px] shrink-0 overflow-hidden rounded-[14px] border border-black/10 ${preview.surface}`}>
                      {hotspot.thumbnail ? (
                        <img src={hotspot.thumbnail} alt={hotspot.name} className="h-full w-full object-cover" />
                      ) : (
                        <>
                          <div className="absolute inset-x-3 bottom-3 h-6 rounded-full bg-black/10 blur-md" />
                          <div className="absolute inset-x-4 bottom-4 h-8 rounded-[14px] border border-black/10 bg-white/50" />
                          <div className="absolute bottom-6 left-1/2 h-8 w-8 -translate-x-1/2 rounded-[12px] border border-black/10 bg-white/60" />
                        </>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 py-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[#1f1b16]">{hotspot.name}</div>
                          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f655a]">
                            {hotspot.collection}
                          </div>
                          {hotspot.brand ? (
                            <div className="mt-1 truncate text-xs text-[#6f655a]">{hotspot.brand}</div>
                          ) : null}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${
                            isActive
                              ? "bg-[#171411] text-white"
                              : "border border-black/10 bg-white text-[#6f655a]"
                          }`}
                        >
                          #{hotspot.index + 1}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-black/10 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#736659]">
                          {hotspot.category}
                        </span>
                        <span className="rounded-full border border-black/10 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#736659]">
                          {hotspot.anchorType.replaceAll("_", " ")}
                        </span>
                        {hotspot.price ? (
                          <span className="rounded-full border border-black/10 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#736659]">
                            {hotspot.price}
                          </span>
                        ) : null}
                        {hotspot.dimensionsMm ? (
                          <span className="rounded-full border border-black/10 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#736659]">
                            {hotspot.dimensionsMm.width}x{hotspot.dimensionsMm.depth}x{hotspot.dimensionsMm.height} mm
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[#61574d]">이 장면에는 표시 가능한 제품 핫스팟이 없습니다.</p>
          )}
        </div>

        {children}
      </div>
    </aside>
  );
}
