import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PublishedSnapshotCard } from "../../components/project/PublishedSnapshotCard";
import {
  normalizeShowcaseFilters,
  type ShowcaseDensityFilter,
  type ShowcaseFilters,
  type ShowcaseRoomFilter,
  type ShowcaseSnapshotItem,
  type ShowcaseToneFilter
} from "../../lib/api/showcase";
import { fetchShowcaseSnapshotFeed } from "../../lib/server/showcase";

export const revalidate = 60;

type SearchParams = Record<string, string | string[] | undefined>;

type ShowcaseArchiveResult = {
  items: ShowcaseSnapshotItem[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
  error: string | null;
};

const PAGE_SIZE = 24;

const roomFilterOptions: Array<{ id: ShowcaseRoomFilter; label: string }> = [
  { id: "all", label: "All rooms" },
  { id: "living", label: "Living" },
  { id: "workspace", label: "Workspace" },
  { id: "bedroom", label: "Bedroom" },
  { id: "flex", label: "Flexible" }
];

const toneFilterOptions: Array<{ id: ShowcaseToneFilter; label: string }> = [
  { id: "all", label: "All tones" },
  { id: "sand", label: "Warm sand" },
  { id: "olive", label: "Olive" },
  { id: "slate", label: "Slate" },
  { id: "ember", label: "Ember" }
];

const densityFilterOptions: Array<{ id: ShowcaseDensityFilter; label: string }> = [
  { id: "all", label: "Any fill" },
  { id: "minimal", label: "Quiet" },
  { id: "layered", label: "Layered" },
  { id: "collected", label: "Collected" }
];

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? undefined : value;
}

function parseTotalHint(rawValue: string | null) {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
}

function buildFilterHref(pathname: string, filters: ShowcaseFilters, patch: Partial<ShowcaseFilters>) {
  const nextFilters = normalizeShowcaseFilters({ ...filters, ...patch });
  const params = new URLSearchParams();

  if (nextFilters.room !== "all") params.set("room", nextFilters.room);
  if (nextFilters.tone !== "all") params.set("tone", nextFilters.tone);
  if (nextFilters.density !== "all") params.set("density", nextFilters.density);

  const query = params.toString();
  return query.length > 0 ? `${pathname}?${query}` : pathname;
}

function buildPageHref(pathname: string, filters: ShowcaseFilters, cursor: string | null, totalHint: number) {
  const params = new URLSearchParams();

  if (filters.room !== "all") params.set("room", filters.room);
  if (filters.tone !== "all") params.set("tone", filters.tone);
  if (filters.density !== "all") params.set("density", filters.density);
  if (cursor) {
    params.set("cursor", cursor);
  }
  params.set("total", String(totalHint));

  const query = params.toString();
  return query.length > 0 ? `${pathname}?${query}` : pathname;
}

async function fetchShowcaseArchivePage(
  cursor: string | null,
  totalHint: number | null,
  filters: ShowcaseFilters
): Promise<ShowcaseArchiveResult> {
  try {
    const feed = await fetchShowcaseSnapshotFeed({
      limit: PAGE_SIZE,
      cursor,
      totalHint,
      room: filters.room,
      tone: filters.tone,
      density: filters.density
    });

    return {
      items: feed.items,
      total: feed.total,
      nextCursor: feed.nextCursor,
      hasMore: feed.hasMore,
      error: null
    };
  } catch {
    return {
      items: [],
      total: 0,
      nextCursor: null,
      hasMore: false,
      error: "Showcase feed is unavailable right now."
    };
  }
}

export default async function GalleryPage({ searchParams }: { searchParams?: SearchParams }) {
  const filters = normalizeShowcaseFilters({
    room: firstValue(searchParams?.room),
    tone: firstValue(searchParams?.tone),
    density: firstValue(searchParams?.density)
  });
  const currentCursor = firstValue(searchParams?.cursor) ?? null;
  const totalHint = parseTotalHint(firstValue(searchParams?.total) ?? null);

  const {
    items: snapshots,
    total: totalPublished,
    nextCursor,
    hasMore,
    error: showcaseError
  } = await fetchShowcaseArchivePage(currentCursor, totalHint, filters);

  const activeFilterCount =
    Number(filters.room !== "all") + Number(filters.tone !== "all") + Number(filters.density !== "all");
  const loadedCount = snapshots.length;
  const loadMoreHref = nextCursor ? buildPageHref("/gallery", filters, nextCursor, totalPublished) : null;

  return (
    <div className="min-h-screen bg-[#f3efe8] px-4 pb-20 pt-24 text-[#171411] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <header className="border-b border-black/8 pb-8">
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a8177]">
            <Sparkles className="h-4 w-4" />
            <span>Gallery</span>
          </div>
          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-cormorant font-light tracking-tight text-[#171411] sm:text-6xl">
                Rooms and desk setups ready to open.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#625a51]">
                Browse published spaces, open the viewer, and inspect the pieces inside each room.
              </p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/78 px-4 py-3 text-sm text-[#625a51] shadow-[0_10px_30px_rgba(42,31,21,0.06)]">
              {showcaseError
                ? "Gallery unavailable"
                : activeFilterCount === 0
                  ? hasMore
                    ? `Showing ${loadedCount} rooms on this page of ${totalPublished} published rooms`
                    : `${totalPublished} published rooms in archive`
                  : hasMore
                    ? `${loadedCount} matches on this page (of ${totalPublished} published rooms)`
                    : `${loadedCount} matches in archive (${totalPublished} published rooms total)`}
            </div>
          </div>

          <div className="mt-7 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a8177]">
              <span className="mr-2">Room type</span>
              {roomFilterOptions.map((option) => {
                const isActive = filters.room === option.id;
                return (
                  <Link
                    key={option.id}
                    href={buildFilterHref("/gallery", filters, { room: option.id })}
                    className={`shrink-0 rounded-md px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                      isActive
                        ? "bg-[#171411] text-white"
                        : "border border-black/10 bg-white/88 text-[#625a51] hover:border-black/20 hover:bg-white"
                    }`}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a8177]">
              <span className="mr-2">Tone</span>
              {toneFilterOptions.map((option) => {
                const isActive = filters.tone === option.id;
                return (
                  <Link
                    key={option.id}
                    href={buildFilterHref("/gallery", filters, { tone: option.id })}
                    className={`shrink-0 rounded-md px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                      isActive
                        ? "bg-[#171411] text-white"
                        : "border border-black/10 bg-white/88 text-[#625a51] hover:border-black/20 hover:bg-white"
                    }`}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a8177]">
              <span className="mr-2">Scene fill</span>
              {densityFilterOptions.map((option) => {
                const isActive = filters.density === option.id;
                return (
                  <Link
                    key={option.id}
                    href={buildFilterHref("/gallery", filters, { density: option.id })}
                    className={`shrink-0 rounded-md px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                      isActive
                        ? "bg-[#171411] text-white"
                        : "border border-black/10 bg-white/88 text-[#625a51] hover:border-black/20 hover:bg-white"
                    }`}
                  >
                    {option.label}
                  </Link>
                );
              })}
              {activeFilterCount > 0 ? (
                <Link
                  href="/gallery"
                  className="ml-2 inline-flex items-center rounded-md px-2 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b6f64] transition hover:text-[#171411]"
                >
                  Clear filters
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        <section className="mt-10">
          <div className="mb-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">
            <Sparkles className="h-4 w-4" />
            <span>Published archive</span>
          </div>

          {showcaseError ? (
            <div className="rounded-lg border border-[#c06e3d]/18 bg-[#fff8f3] p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.06)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b56a3e]">Gallery unavailable</div>
              <h2 className="mt-4 text-3xl font-cormorant font-light">The published archive could not be loaded.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">{showcaseError}</p>
            </div>
          ) : snapshots.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {snapshots.map((snapshot) => (
                <PublishedSnapshotCard
                  key={snapshot.id}
                  token={snapshot.token}
                  thumbnail={snapshot.thumbnail}
                  previewMeta={snapshot.previewMeta}
                  publishedAt={snapshot.published_at}
                />
              ))}
            </div>
          ) : hasMore ? (
            <div className="rounded-lg border border-dashed border-black/12 bg-white/72 p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.05)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a7c70]">No matches loaded yet</div>
              <h2 className="mt-4 text-3xl font-cormorant font-light">The current filters have not matched the loaded archive pages.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
                Load more archive pages to scan deeper, or clear filters to widen the visible feed.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {loadMoreHref ? (
                  <Link
                    href={loadMoreHref}
                    className="inline-flex rounded-md border border-black/10 bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#52483f] transition hover:border-black/20 hover:bg-[#faf7f2]"
                  >
                    Load more
                  </Link>
                ) : null}
                <Link
                  href="/gallery"
                  className="inline-flex rounded-md border border-black/10 bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#52483f] transition hover:border-black/20 hover:bg-[#faf7f2]"
                >
                  Clear filters
                </Link>
              </div>
            </div>
          ) : activeFilterCount > 0 ? (
            <div className="rounded-lg border border-dashed border-black/12 bg-white/72 p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.05)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a7c70]">No matching rooms</div>
              <h2 className="mt-4 text-3xl font-cormorant font-light">Nothing matches this filter combination yet.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
                Try another room type, tone, or scene fill to widen the published archive.
              </p>
              <Link
                href="/gallery"
                className="mt-6 inline-flex rounded-md border border-black/10 bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#52483f] transition hover:border-black/20 hover:bg-[#faf7f2]"
              >
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-black/12 bg-white/72 p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.05)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a7c70]">Gallery empty</div>
              <h2 className="mt-4 text-3xl font-cormorant font-light">No published rooms yet.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
                Publish a room from the editor and it will appear here as a read-only scene.
              </p>
            </div>
          )}

          {!showcaseError && snapshots.length > 0 && hasMore && Boolean(loadMoreHref) ? (
            <div className="mt-8 flex justify-center">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {loadMoreHref ? (
                  <Link
                    href={loadMoreHref}
                    className="inline-flex items-center rounded-md border border-black/10 bg-white/88 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#52483f] transition hover:border-black/20 hover:bg-white"
                  >
                    Next page
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {!showcaseError && snapshots.length > 0 && !hasMore ? (
            <p className="mt-8 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a7c70]">
              End of published archive
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
