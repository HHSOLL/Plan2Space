"use client";

import { ChevronDown, LayoutGrid, Search, Sparkles, Star } from "lucide-react";
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
  if (surfaceCount <= 0) return "바닥";
  if (surfaceCount === 1) return "표면";
  return `면 ${surfaceCount}`;
}

function formatDimensionsLabel(item: LibraryCatalogItem) {
  const dimensions = item.dimensionsMm;
  if (!dimensions) return null;
  return `${dimensions.width}x${dimensions.depth}x${dimensions.height} mm`;
}

function AssetCard({
  item,
  placed,
  onAdd
}: {
  item: LibraryCatalogItem;
  placed: boolean;
  onAdd: (item: LibraryCatalogItem) => void;
}) {
  const preview = getCatalogPreviewClasses(item.tone);
  const dimensionsLabel = formatDimensionsLabel(item);
  const supportLabel = getSurfaceSupportLabel(item);
  const secondaryLine = item.price ?? dimensionsLabel ?? item.collection;
  const tertiaryLine =
    secondaryLine === dimensionsLabel ? supportLabel : dimensionsLabel ?? supportLabel;

  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      className="group text-left"
      aria-label={`${item.label} 추가`}
    >
      <article className="flex flex-col">
        <div
          className={`relative aspect-[4/5] overflow-hidden rounded-[16px] border border-black/10 ${preview.surface} transition duration-200 group-hover:border-black/20 group-hover:shadow-[0_10px_24px_rgba(17,19,22,0.08)]`}
        >
          <span
            className={`absolute left-2 top-2 inline-flex max-w-[calc(100%-1rem)] truncate rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] ${preview.chip}`}
          >
            {item.collection}
          </span>
          {placed ? (
            <span className="absolute right-2 top-2 rounded-full border border-emerald-700/10 bg-emerald-50 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-800">
              배치됨
            </span>
          ) : null}
          <div className="absolute inset-x-4 bottom-4 h-4 rounded-full bg-black/10 blur-lg" />
          <div className="absolute inset-x-3 bottom-3 h-5 rounded-[10px] border border-black/10 bg-white/45" />
          <div className="absolute bottom-5 left-1/2 h-9 w-9 -translate-x-1/2 rounded-[12px] border border-black/10 bg-white/65 shadow-[0_10px_18px_rgba(0,0,0,0.08)]" />
        </div>

        <div className="mt-2 space-y-1 px-0.5">
          <p className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#171411]">{item.label}</p>
          <p className="line-clamp-1 text-[10px] leading-4 text-[#61594f]">{secondaryLine}</p>
          <p className="line-clamp-1 text-[10px] leading-4 text-[#9a9186]">{tertiaryLine}</p>
        </div>
      </article>
    </button>
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
  const activeCategoryMeta = categories.find((category) => category.id === activeCategory) ?? categories[0] ?? null;
  const isPlaced = (item: LibraryCatalogItem) => placedItemKeys.has(item.id) || placedItemKeys.has(item.assetId);
  const featuredCount = hasActiveFilters ? 0 : featuredItems.length;

  return (
    <div className="flex h-full flex-col bg-white text-[#171411]">
      <div className="border-b border-black/10 px-4 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#948b80]" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="무엇을 찾으시나요?"
            className="w-full rounded-full border border-transparent bg-[#f4f4f1] py-3 pl-10 pr-4 text-sm text-[#171411] outline-none transition placeholder:text-[#948b80] focus:border-black/10 focus:bg-white"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f867a]">카테고리</div>
            <div className="mt-1 inline-flex items-center gap-1 text-lg font-semibold text-[#171411]">
              <span>{activeCategoryMeta?.label ?? "전체"}</span>
              <ChevronDown className="h-4 w-4 text-[#8f867a]" />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f867a]">장면 제품</div>
            <div className="mt-1 text-sm font-semibold text-[#171411]">{assetCount}개</div>
          </div>
        </div>

        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryChange(category.id)}
              className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                activeCategory === category.id
                  ? "bg-[#171411] text-white"
                  : "bg-[#f4f4f1] text-[#61594f] hover:bg-[#ecebe7]"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAddStarterSet}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#171411] transition hover:bg-[#f4f4f1]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            빠른 세트
          </button>
          {spotlightItem ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#f4f4f1] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#61594f]">
              <Star className="h-3.5 w-3.5" />
              추천 {spotlightItem.label}
            </span>
          ) : null}
          {!hasActiveFilters && featuredCount > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#f4f4f1] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#61594f]">
              <LayoutGrid className="h-3.5 w-3.5" />
              추천 {featuredCount}개
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 min-[390px]:grid-cols-3">
            {items.map((item) => (
              <AssetCard key={item.id} item={item} placed={isPlaced(item)} onAdd={onAddItem} />
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-[20px] border border-dashed border-black/10 bg-[#faf9f7] p-6 text-center">
            <LayoutGrid className="h-5 w-5 text-[#948b80]" />
            <p className="mt-3 text-sm leading-6 text-[#625a51]">
              조건에 맞는 제품이 없습니다. 검색어나 카테고리를 다시 조정해 주세요.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-black/10 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f867a]">
        카탈로그 {catalogCount}개
      </div>
    </div>
  );
}
