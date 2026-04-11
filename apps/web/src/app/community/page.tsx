import Link from "next/link";
import { ArrowRight, ArrowUpRight, Link2, MessagesSquare, Sparkles, Users } from "lucide-react";
import { PublishedSnapshotCard } from "../../components/project/PublishedSnapshotCard";
import { getCatalogPreviewClasses } from "../../lib/builder/catalog";
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
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

export default async function CommunityPage({ searchParams }: { searchParams?: SearchParams }) {
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
  const filteredSnapshots = snapshots;
  const featured = filteredSnapshots[0] ?? null;
  const feed = filteredSnapshots.slice(1, 7);
  const archive = filteredSnapshots.slice(7, 13);
  const collectionPulse = Array.from(
    filteredSnapshots
      .flatMap((snapshot) => snapshot.previewMeta?.assetSummary?.collections ?? [])
      .reduce<Map<string, number>>((map, collection) => {
        map.set(collection.label, (map.get(collection.label) ?? 0) + collection.count);
        return map;
      }, new Map())
      .entries()
  )
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
  const activeCollections = new Set(
    filteredSnapshots.flatMap((snapshot) => snapshot.previewMeta?.assetSummary?.collections.map((collection) => collection.label) ?? [])
  ).size;
  const latestPublish = filteredSnapshots[0]?.published_at ?? null;
  const featuredTheme = getCatalogPreviewClasses(featured?.previewMeta?.assetSummary?.primaryTone ?? "sand");
  const activeFilterCount =
    Number(filters.room !== "all") + Number(filters.tone !== "all") + Number(filters.density !== "all");
  const loadedCount = snapshots.length;
  const matchesLoadedCount = filteredSnapshots.length;
  const loadMoreHref = nextCursor ? buildPageHref("/community", filters, nextCursor, totalPublished) : null;

  return (
    <div className="min-h-screen bg-[#f5f1e8] px-4 pb-20 pt-24 text-[#171411] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[34px] bg-[#191512] p-8 text-[#f9f4ec] shadow-[0_34px_90px_rgba(0,0,0,0.22)] sm:p-10">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d8baa0]">
              <Users className="h-4 w-4" />
              <span>Community circulation</span>
            </div>
            <h1 className="mt-8 text-5xl font-cormorant font-light tracking-tight sm:text-6xl">
              Public rooms moving through the pinned viewer.
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-[#d7cbc1]">
              Community is now grounded in real published snapshots. Every room here comes from the builder-first editor
              and opens the exact read-only version that was shared.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/gallery"
                className="inline-flex items-center gap-3 rounded-full bg-[#f7e8d7] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#1b1714] transition hover:bg-white"
              >
                Open archive
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/studio/builder"
                className="inline-flex items-center gap-3 rounded-full border border-white/20 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f7efe5] transition hover:border-white/50 hover:bg-white/5"
              >
                Publish a room
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_44px_rgba(68,52,34,0.1)] backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">Rooms in circulation</div>
              <div className="mt-4 text-4xl font-cormorant">
                {showcaseError ? "Unavailable" : totalPublished}
              </div>
              <p className="mt-3 text-sm leading-7 text-[#61574e]">
                {showcaseError
                  ? "The public feed could not be loaded, so circulation cannot be measured right now."
                  : activeFilterCount > 0
                    ? hasMore
                      ? `Showing ${matchesLoadedCount} matches on this page (of ${totalPublished} published rooms).`
                      : `${matchesLoadedCount} matches across ${totalPublished} published rooms.`
                    : hasMore
                      ? `Showing ${loadedCount} rooms on this page of ${totalPublished} published rooms.`
                      : "Permanent view-only builder snapshots currently visible to everyone."}
              </p>
            </div>
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_44px_rgba(68,52,34,0.1)] backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">Active collections</div>
              <div className="mt-4 text-4xl font-cormorant">{showcaseError ? "Unavailable" : activeCollections}</div>
              <p className="mt-3 text-sm leading-7 text-[#61574e]">
                {showcaseError
                  ? "Collection analytics are hidden until the showcase feed is healthy again."
                  : "Collection families represented by the currently visible community slice."}
              </p>
            </div>
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_44px_rgba(68,52,34,0.1)] backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">Publishing contract</div>
              <div className="mt-4 text-xl font-cormorant">Pinned snapshot only</div>
              <p className="mt-3 text-sm leading-7 text-[#61574e]">
                Community entries stay fixed to their published version instead of following later draft edits.
                {latestPublish ? ` Latest publish ${formatDate(latestPublish)}.` : null}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-8 rounded-[30px] border border-black/10 bg-white/74 p-6 shadow-[0_16px_44px_rgba(68,52,34,0.08)]">
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">
            <Sparkles className="h-4 w-4" />
            <span>Filter circulation</span>
            {activeFilterCount > 0 ? (
              <Link
                href="/community"
                className="ml-auto text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f6358] transition hover:text-[#171411]"
              >
                Clear filters
              </Link>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a8177]">
              <span className="mr-2">Room type</span>
              {roomFilterOptions.map((option) => {
                const isActive = filters.room === option.id;
                return (
                  <Link
                    key={option.id}
                    href={buildFilterHref("/community", filters, { room: option.id })}
                    className={`rounded-full px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                      isActive
                        ? "bg-[#171411] text-white"
                        : "border border-black/10 bg-[#faf7f2] text-[#625a51] hover:border-black/20 hover:bg-white"
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
                    href={buildFilterHref("/community", filters, { tone: option.id })}
                    className={`rounded-full px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                      isActive
                        ? "bg-[#171411] text-white"
                        : "border border-black/10 bg-[#faf7f2] text-[#625a51] hover:border-black/20 hover:bg-white"
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
                    href={buildFilterHref("/community", filters, { density: option.id })}
                    className={`rounded-full px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                      isActive
                        ? "bg-[#171411] text-white"
                        : "border border-black/10 bg-[#faf7f2] text-[#625a51] hover:border-black/20 hover:bg-white"
                    }`}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {showcaseError ? (
          <section className="mt-14 rounded-[34px] border border-[#c06e3d]/20 bg-[#fff8f3] p-10 shadow-[0_24px_80px_rgba(58,40,20,0.08)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#b56a3e]">Community unavailable</div>
            <h2 className="mt-4 text-4xl font-cormorant font-light text-[#171411]">The public community feed could not be loaded.</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#61574e]">
              {showcaseError} Treat this as a publish pipeline or API problem, not as an empty community.
            </p>
          </section>
        ) : filteredSnapshots.length === 0 && snapshots.length > 0 ? (
          <section className="mt-14 rounded-[34px] border border-dashed border-black/12 bg-white/76 p-10 shadow-[0_24px_80px_rgba(58,40,20,0.06)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8a7c70]">
              {hasMore ? "No matches loaded yet" : "No matching rooms"}
            </div>
            <h2 className="mt-4 text-4xl font-cormorant font-light text-[#171411]">
              {hasMore ? "The current filters have not matched the loaded archive pages yet." : "Nothing in circulation matches these filters."}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#61574e]">
              {hasMore
                ? "Load more archive pages to continue scanning the public feed, or clear filters to widen the visible view."
                : "Widen the room type, tone, or scene fill to bring more published snapshots back into view."}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {hasMore && nextCursor ? (
                <Link
                  href={loadMoreHref}
                  className="inline-flex rounded-full border border-black/10 bg-[#faf7f2] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#52483f] transition hover:border-black/20 hover:bg-white"
                >
                  Load more
                </Link>
              ) : null}
              <Link
                href="/community"
                className="inline-flex rounded-full border border-black/10 bg-[#faf7f2] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#52483f] transition hover:border-black/20 hover:bg-white"
              >
                Clear filters
              </Link>
            </div>
          </section>
        ) : featured ? (
          <section className="mt-14 grid gap-8 xl:grid-cols-[1.06fr_0.94fr]">
            <Link
              href={`/shared/${featured.token}`}
              className="group overflow-hidden rounded-[34px] border border-black/10 bg-white/78 shadow-[0_24px_80px_rgba(58,40,20,0.1)] transition hover:-translate-y-1 hover:shadow-[0_32px_100px_rgba(58,40,20,0.14)]"
            >
              <div className="grid h-full md:grid-cols-[0.95fr_1.05fr]">
                <div className="relative min-h-[320px] border-b border-black/8 md:min-h-full md:border-b-0 md:border-r">
                  {featured.thumbnail ? (
                    <img
                      src={featured.thumbnail}
                      alt={featured.previewMeta?.projectName ?? "Featured snapshot"}
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className={`absolute inset-0 flex flex-col justify-between p-8 ${featuredTheme.surface}`}>
                      <div className={`inline-flex w-fit rounded-full border px-3 py-2 text-[9px] font-bold uppercase tracking-[0.22em] ${featuredTheme.chip}`}>
                        {featured.previewMeta?.assetSummary?.primaryCollection ?? "Featured Snapshot"}
                      </div>
                      <div className="space-y-3">
                        {(featured.previewMeta?.assetSummary?.highlightedItems ?? []).slice(0, 3).map((item) => (
                          <div key={item.catalogItemId ?? item.assetId} className="flex items-center justify-between gap-3 text-sm">
                            <span className="line-clamp-1">{item.label}</span>
                            <span className="text-[11px] font-semibold opacity-65">x{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur">
                    <MessagesSquare className="h-3.5 w-3.5" />
                    Featured room
                  </div>
                </div>

                <div className="flex flex-col justify-between p-8">
                  <div>
                    <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#8a7c70]">
                      <span>Latest circulation</span>
                      <span>{formatDate(featured.published_at)}</span>
                    </div>
                    <h2 className="mt-5 text-4xl font-cormorant font-light leading-tight text-[#171411]">
                      {featured.previewMeta?.projectName ?? "Shared Room"}
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-[#5f554b]">
                      {featured.previewMeta?.projectDescription ?? "Pinned community-ready room snapshot from the builder-first editor."}
                    </p>
                    {(featured.previewMeta?.assetSummary?.collections?.length ?? 0) > 0 ? (
                      <div className="mt-6 flex flex-wrap gap-2">
                        {featured.previewMeta?.assetSummary?.collections.slice(0, 4).map((collection) => (
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
              </div>
            </Link>

            <div className="rounded-[34px] border border-black/10 bg-white/76 p-8 shadow-[0_24px_80px_rgba(58,40,20,0.1)]">
              <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8a7c70]">
                <Sparkles className="h-4 w-4" />
                <span>Collection pulse</span>
              </div>
              {collectionPulse.length > 0 ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  {collectionPulse.map((collection) => (
                    <div
                      key={collection.label}
                      className="rounded-[22px] border border-black/10 bg-[#f7f2ea] px-4 py-4 text-[#4f463d]"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a7c70]">{collection.label}</div>
                      <div className="mt-2 text-2xl font-cormorant">{collection.count}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-6 text-sm leading-7 text-[#61574e]">
                  Collection signals appear here once published rooms contain catalogued pieces.
                </p>
              )}

              <div className="mt-8 rounded-[24px] border border-black/10 bg-[#fbf8f2] p-5">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">
                  <Link2 className="h-4 w-4" />
                  Pinned public feed
                </div>
                <p className="mt-3 text-sm leading-7 text-[#61574e]">
                  This feed stays grounded in the same pinned share snapshots that power the public viewer and gallery archive.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-14 grid gap-8 xl:grid-cols-[0.88fr_1.12fr]">
          <div className="rounded-[34px] border border-black/10 bg-white/76 p-8 shadow-[0_24px_80px_rgba(58,40,20,0.08)]">
            <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8a7c70]">
              <MessagesSquare className="h-4 w-4" />
              <span>Recent rooms</span>
            </div>
            {showcaseError ? (
              <div className="mt-6 rounded-[24px] border border-[#c06e3d]/20 bg-[#fff8f3] p-8 text-sm leading-7 text-[#61574e]">
                The recent room feed is unavailable because the showcase API did not respond correctly.
              </div>
            ) : feed.length > 0 ? (
              <div className="mt-6 space-y-4">
                {feed.map((snapshot) => (
                  <Link
                    key={snapshot.id}
                    href={`/shared/${snapshot.token}`}
                    className="group block rounded-[24px] border border-black/10 bg-[#faf7f2] p-5 transition hover:border-black/20 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a7c70]">
                          {formatDate(snapshot.published_at)}
                        </div>
                        <h3 className="mt-3 text-2xl font-cormorant font-light text-[#171411]">
                          {snapshot.previewMeta?.projectName ?? "Shared Room"}
                        </h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-7 text-[#61574e]">
                          {snapshot.previewMeta?.projectDescription ?? "Pinned builder snapshot ready for community viewing."}
                        </p>
                      </div>
                      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[#5f554b] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                    {(snapshot.previewMeta?.assetSummary?.collections?.length ?? 0) > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {snapshot.previewMeta?.assetSummary?.collections.slice(0, 3).map((collection) => (
                          <span
                            key={collection.label}
                            className="rounded-full border border-black/10 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#736659]"
                          >
                            {collection.label} {collection.count}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-black/12 bg-[#faf7f2] p-8 text-sm leading-7 text-[#61574e]">
                {hasMore
                  ? "Load more archive pages to surface additional recent rooms under the current filters."
                  : "Recent room cards appear here once the current filters leave more than one published match."}
              </div>
            )}
          </div>

          <div className="rounded-[34px] border border-black/10 bg-white/76 p-8 shadow-[0_24px_80px_rgba(58,40,20,0.08)]">
            <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8a7c70]">
              <Sparkles className="h-4 w-4" />
              <span>Archive picks</span>
            </div>
            {showcaseError ? (
              <div className="mt-6 rounded-[24px] border border-[#c06e3d]/20 bg-[#fff8f3] p-8 text-sm leading-7 text-[#61574e]">
                Fix the showcase transport before treating the archive as empty.
              </div>
            ) : archive.length > 0 ? (
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {archive.map((snapshot) => (
                  <PublishedSnapshotCard
                    key={snapshot.id}
                    token={snapshot.token}
                    thumbnail={snapshot.thumbnail}
                    previewMeta={snapshot.previewMeta}
                    publishedAt={snapshot.published_at}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-black/12 bg-[#faf7f2] p-8 text-sm leading-7 text-[#61574e]">
                {hasMore
                  ? "Load more archive pages to find additional archive picks under the current filters."
                  : "Archive picks return as soon as the current filter view contains more published rooms."}
              </div>
            )}
          </div>
        </section>

        {!showcaseError && matchesLoadedCount > 0 && hasMore && Boolean(loadMoreHref) ? (
          <div className="mt-10 flex justify-center">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {loadMoreHref ? (
                <Link
                  href={loadMoreHref}
                  className="inline-flex items-center rounded-full border border-black/10 bg-white/86 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#52483f] transition hover:border-black/20 hover:bg-white"
                >
                  Next page
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {!showcaseError && matchesLoadedCount > 0 && !hasMore ? (
          <p className="mt-10 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a7c70]">
            End of published archive
          </p>
        ) : null}
      </div>
    </div>
  );
}
