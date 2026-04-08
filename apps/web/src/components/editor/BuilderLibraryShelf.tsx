"use client";

import { Compass, LayoutGrid, Package, Search, Sparkles, Star } from "lucide-react";
import type {
  LibraryCatalogCategory,
  LibraryCatalogCategoryId,
  LibraryCatalogItem
} from "../../lib/builder/catalog";
import { getCatalogToneClasses } from "../../lib/builder/catalog";

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
  const tone = getCatalogToneClasses(item.tone);
  return (
    <div className={`rounded-[24px] border p-4 transition hover:border-white/30 hover:bg-white/[0.08] ${tone.tile}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{item.category}</p>
            <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${tone.badge}`}>
              {item.collection}
            </span>
          </div>
          <h3 className="mt-2 text-base font-medium text-white">{item.label}</h3>
        </div>
        <div className="flex flex-col items-end gap-2">
          {placed ? (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-200">
              In Room
            </span>
          ) : null}
          {item.assetId.startsWith("placeholder:") ? (
            <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
              Prototype
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/55">{item.description}</p>
      <button
        type="button"
        onClick={() => onAdd(item)}
        className="mt-4 inline-flex items-center justify-center rounded-full border border-white/10 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-black transition hover:bg-white/90"
      >
        {actionLabel}
      </button>
    </div>
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
  const spotlightTone = spotlightItem ? getCatalogToneClasses(spotlightItem.tone) : null;
  const isPlaced = (item: LibraryCatalogItem) => placedItemKeys.has(item.id) || placedItemKeys.has(item.assetId);
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
          <Package className="h-4 w-4" />
          Curated Library
        </div>
        <p className="mt-3 text-sm text-white/55">
          Browse the room kit, drop in a starter layout, or refine the shelf by category and search.
        </p>

        <div className="mt-4 grid gap-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                  <Sparkles className="h-3.5 w-3.5" />
                  Starter Set
                </div>
                <div className="mt-2 text-base font-medium text-white">Stage the room in one move</div>
              </div>
              <button
                type="button"
                onClick={onAddStarterSet}
                className="rounded-full border border-white/10 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-black transition hover:bg-white/90"
              >
                Add Set
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[18px] border border-white/10 bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">Catalog</div>
                <div className="mt-2 text-lg font-medium text-white">{catalogCount}</div>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">Placed</div>
                <div className="mt-2 text-lg font-medium text-white">{assetCount}</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search chairs, tables, lighting..."
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/25 outline-none transition focus:border-white/25"
            />
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onCategoryChange(category.id)}
                className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                  activeCategory === category.id
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/[0.04] text-white/65 hover:border-white/30"
                }`}
              >
                {category.label} {category.count}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {spotlightItem ? (
          <div className={`rounded-[28px] border p-5 ${spotlightTone?.tile ?? "border-white/10 bg-white/[0.04]"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#dbc8a7]">
                <Compass className="h-3.5 w-3.5" />
                Spotlight Pick
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
                  {spotlightItem.category}
                </span>
                <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${spotlightTone?.badge ?? ""}`}>
                  {spotlightItem.collection}
                </span>
              </div>
            </div>
            <h3 className="mt-4 text-xl font-medium text-white">{spotlightItem.label}</h3>
            <p className="mt-3 text-sm leading-6 text-white/60">{spotlightItem.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {isPlaced(spotlightItem) ? (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">
                  Already in room
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onAddItem(spotlightItem)}
                className="rounded-full border border-white/10 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-black transition hover:bg-white/90"
              >
                Add To Room
              </button>
            </div>
          </div>
        ) : null}

        {!hasActiveFilters && featuredItems.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
              <Star className="h-3.5 w-3.5" />
              Featured Picks
            </div>
            <div className="grid gap-3">
              {featuredItems.slice(0, 3).map((item) => (
                <AssetCard
                  key={item.id}
                  item={item}
                  placed={isPlaced(item)}
                  actionLabel="Quick Add"
                  onAdd={onAddItem}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
              <LayoutGrid className="h-3.5 w-3.5" />
              Shelf Results
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{items.length} items</span>
          </div>

          {items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item) => (
                <AssetCard
                  key={item.id}
                  item={item}
                  placed={isPlaced(item)}
                  actionLabel="Add"
                  onAdd={onAddItem}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-white/15 bg-white/[0.03] p-6 text-center text-sm leading-6 text-white/45">
              <LayoutGrid className="mx-auto h-5 w-5 text-white/30" />
              <p className="mt-3">No assets match this filter. Clear the search or switch categories.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
