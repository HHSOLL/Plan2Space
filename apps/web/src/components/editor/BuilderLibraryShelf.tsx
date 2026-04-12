"use client";

import { LayoutGrid, Package, Search, Sparkles, Star } from "lucide-react";
import type {
  LibraryCatalogCategory,
  LibraryCatalogCategoryId,
  LibraryCatalogItem
} from "../../lib/builder/catalog";
import { getCatalogPreviewClasses } from "../../lib/builder/catalog";

type BuilderLibraryShelfProps = {
  items: LibraryCatalogItem[];
  featuredItems: LibraryCatalogItem[];
  spotlightItem: LibraryCatalogItem | null;
  categories: LibraryCatalogCategory[];
  query: string;
  activeCategory: LibraryCatalogCategoryId;
  catalogCount: number;
  assetCount: number;
  hasActiveFilters: boolean;
  placedItemKeys: ReadonlySet<string>;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: LibraryCatalogCategoryId) => void;
  onAddStarterSet: () => void;
  onAddItem: (item: LibraryCatalogItem) => void;
};

function getSurfaceSupportLabel(item: LibraryCatalogItem) {
  const surfaceCount = item.supportProfile?.surfaces.length ?? 0;
  if (surfaceCount <= 0) return "바닥 배치";
  if (surfaceCount === 1) return "표면 인식";
  return `지원 면 ${surfaceCount}개`;
}

function AssetCard({
  item,
  placed,
  actionLabel,
  onAdd
}: {
  item: LibraryCatalogItem;
  placed: boolean;
  actionLabel: string;
  onAdd: (item: LibraryCatalogItem) => void;
}) {
  const preview = getCatalogPreviewClasses(item.tone);
  const supportLabel = getSurfaceSupportLabel(item);
  return (
    <article className="group flex min-h-[268px] flex-col overflow-hidden rounded-[22px] border border-black/10 bg-white shadow-[0_12px_30px_rgba(30,24,18,0.07)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_18px_42px_rgba(30,24,18,0.12)]">
      <div className={`relative aspect-[4/3] overflow-hidden border-b border-black/5 ${preview.surface}`}>
        <div className="absolute inset-x-5 bottom-4 h-8 rounded-full bg-black/10 blur-xl transition group-hover:bg-black/15" />
        <div
          className={`absolute left-4 top-4 max-w-[calc(100%-2rem)] rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] backdrop-blur ${preview.chip}`}
        >
          {item.collection}
        </div>
        <div className="absolute right-4 top-4 rounded-full border border-black/10 bg-white/60 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#5e554b] backdrop-blur">
          {supportLabel}
        </div>
        <div className="absolute inset-x-6 bottom-6 h-10 rounded-[16px] border border-black/10 bg-white/50" />
        <div className="absolute bottom-9 left-1/2 h-12 w-12 -translate-x-1/2 rounded-[16px] border border-black/10 bg-white/60 shadow-[0_12px_24px_rgba(0,0,0,0.12)]" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a8177]">{item.category}</p>
            <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-6 text-[#171411]">{item.label}</h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {placed ? (
              <span className="rounded-full border border-emerald-800/15 bg-emerald-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-800">
                배치됨
              </span>
            ) : null}
            {item.assetId.startsWith("placeholder:") ? (
              <span className="rounded-full border border-black/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
                프로토타입
              </span>
            ) : null}
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#625a51]">{item.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 rounded-[18px] border border-black/5 bg-[#f7f3ec] p-3">
          <div>
            <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8a8177]">컬렉션</dt>
            <dd className="mt-1 text-[11px] font-medium text-[#473f35]">{item.collection}</dd>
          </div>
          <div>
            <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8a8177]">배치 기준</dt>
            <dd className="mt-1 text-[11px] font-medium text-[#473f35]">{supportLabel}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => onAdd(item)}
          className="mt-4 inline-flex w-full items-center justify-center rounded-[16px] bg-[#171411] px-3 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-black"
        >
          {actionLabel}
        </button>
      </div>
    </article>
  );
}

export function BuilderLibraryShelf({
  items,
  featuredItems,
  spotlightItem,
  categories,
  query,
  activeCategory,
  catalogCount,
  assetCount,
  hasActiveFilters,
  placedItemKeys,
  onQueryChange,
  onCategoryChange,
  onAddStarterSet,
  onAddItem
}: BuilderLibraryShelfProps) {
  const spotlightPreview = spotlightItem ? getCatalogPreviewClasses(spotlightItem.tone) : null;
  const activeCategoryMeta = categories.find((category) => category.id === activeCategory) ?? categories[0] ?? null;
  const isPlaced = (item: LibraryCatalogItem) => placedItemKeys.has(item.id) || placedItemKeys.has(item.assetId);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-[#f5f2ec] text-[#171411]">
      <div className="border-b border-black/10 bg-white/95 px-4 py-4 shadow-[0_8px_24px_rgba(30,24,18,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a8177]">
              <Package className="h-4 w-4" />
              제품 목록
            </div>
            <p className="mt-2 text-sm leading-6 text-[#625a51]">
              카테고리별로 제품을 탐색하고 현재 장면에 바로 배치할 수 있습니다.
            </p>
          </div>
          <div className="shrink-0 rounded-[18px] border border-black/10 bg-[#f7f4ee] px-3 py-2 text-right">
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8a8177]">배치 수</div>
            <div className="mt-1 text-lg font-semibold leading-none">{assetCount}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8177]" />
            <input
              type="text"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="제품명 또는 카테고리 검색"
              className="w-full rounded-[18px] border border-black/10 bg-[#f7f4ee] py-3 pl-10 pr-4 text-sm text-[#171411] outline-none transition placeholder:text-[#8a8177] focus:border-black/25 focus:bg-white focus-visible:ring-2 focus-visible:ring-[#a48f79]/35"
            />
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onCategoryChange(category.id)}
                className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                  activeCategory === category.id
                    ? "border-[#171411] bg-[#171411] text-white shadow-[0_10px_24px_rgba(29,24,18,0.18)]"
                    : "border-black/10 bg-white text-[#625a51] hover:border-black/20 hover:text-[#171411]"
                }`}
              >
                {category.label} {category.count}
              </button>
            ))}
          </div>

          <div className="flex items-start justify-between gap-3 rounded-[20px] border border-black/10 bg-[#f7f3ec] px-4 py-3">
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8a8177]">현재 목록</div>
              <p className="mt-1 text-sm font-semibold text-[#171411]">
                {activeCategoryMeta?.label ?? "전체 제품"}
                {query.trim().length > 0 ? ` · "${query.trim()}" 검색 결과` : ""}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#625a51]">
                {activeCategoryMeta?.description ?? "현재 조건에서 배치 가능한 제품 목록입니다."}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8a8177]">결과 수</div>
              <div className="mt-1 text-lg font-semibold leading-none text-[#171411]">{items.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onAddStarterSet}
            className="rounded-[22px] border border-black/10 bg-[#171411] p-4 text-left text-white shadow-[0_10px_26px_rgba(30,24,18,0.12)] transition hover:bg-black"
          >
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/65">
              <Sparkles className="h-3.5 w-3.5" />
              빠른 시작
            </div>
            <div className="mt-2 text-sm font-semibold leading-5">추천 세트 추가</div>
            <p className="mt-2 text-xs leading-5 text-white/70">기본 배치 세트를 한 번에 추가해 공간 구성을 시작합니다.</p>
          </button>
          <div className="rounded-[22px] border border-black/10 bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a8177]">카탈로그</div>
            <div className="mt-2 text-2xl font-semibold leading-none">{catalogCount}</div>
            <div className="mt-1 text-xs text-[#625a51]">현재 {items.length}개 표시 중</div>
          </div>
        </div>

        {spotlightItem ? (
          <section className="overflow-hidden rounded-[22px] border border-black/10 bg-white shadow-[0_10px_28px_rgba(30,24,18,0.08)]">
            <div className={`px-4 py-5 ${spotlightPreview?.surface ?? "bg-[#f7f4ee] text-[#171411]"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-65">
                  추천 제품
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${spotlightPreview?.chip ?? "border-black/10 bg-white/60 text-[#625a51]"}`}>
                  {spotlightItem.collection}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold leading-tight">{spotlightItem.label}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-6 opacity-75">{spotlightItem.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 p-3">
              {isPlaced(spotlightItem) ? (
                <span className="rounded-full border border-emerald-800/15 bg-emerald-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800">
                  배치됨
                </span>
              ) : null}
              <span className="rounded-full border border-black/10 bg-[#f7f3ec] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#625a51]">
                {getSurfaceSupportLabel(spotlightItem)}
              </span>
              <button
                type="button"
                onClick={() => onAddItem(spotlightItem)}
                className="ml-auto rounded-[14px] bg-[#171411] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-black"
              >
                추가
              </button>
            </div>
          </section>
        ) : null}

        {!hasActiveFilters && featuredItems.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
              <Star className="h-3.5 w-3.5" />
              추천 목록
            </div>
            <div className="grid grid-cols-2 gap-3">
              {featuredItems.slice(0, 4).map((item) => (
                <AssetCard
                  key={item.id}
                  item={item}
                  placed={isPlaced(item)}
                  actionLabel="빠른 추가"
                  onAdd={onAddItem}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
              <LayoutGrid className="h-3.5 w-3.5" />
              전체 결과
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a8177]">{items.length}개</span>
          </div>

          {items.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => (
                <AssetCard
                  key={item.id}
                  item={item}
                  placed={isPlaced(item)}
                  actionLabel="추가"
                  onAdd={onAddItem}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-black/15 bg-white p-6 text-center text-sm leading-6 text-[#625a51]">
              <LayoutGrid className="mx-auto h-5 w-5 text-[#8a8177]" />
              <p className="mt-3">조건에 맞는 제품이 없습니다. 검색어를 지우거나 카테고리를 변경해 주세요.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
