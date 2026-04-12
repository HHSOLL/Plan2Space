import Link from "next/link";
import { MessagesSquare, Sparkles, Users } from "lucide-react";
import { PublishedSnapshotCard } from "../../components/project/PublishedSnapshotCard";
import {
  buildPageHref,
  parseTotalHint,
  readSearchParam,
  ShowcaseFilterRail,
  type ShowcaseSearchParams
} from "../../components/showcase/ShowcaseFilterRail";
import {
  normalizeShowcaseFilters,
  type ShowcaseFilters,
  type ShowcaseSnapshotItem
} from "../../lib/api/showcase";
import { fetchShowcaseSnapshotFeed } from "../../lib/server/showcase";

export const revalidate = 0;

type ShowcaseArchiveResult = {
  items: ShowcaseSnapshotItem[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
  error: string | null;
};

const PAGE_SIZE = 24;

function formatDate(value: string | null) {
  if (!value) return "없음";
  return new Date(value).toLocaleDateString("ko-KR");
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
      error: "커뮤니티 장면 목록을 불러오지 못했습니다."
    };
  }
}

function StatusCard({ label, value, description }: { label: string; value: string | number; description: string }) {
  return (
    <div className="rounded-[24px] border border-black/10 bg-white/78 p-6 shadow-[0_16px_44px_rgba(68,52,34,0.08)]">
      <div className="text-[10px] font-semibold tracking-[0.22em] text-[#8a7c70]">{label}</div>
      <div className="mt-4 text-3xl font-semibold text-[#171411]">{value}</div>
      <p className="mt-3 text-sm leading-7 text-[#61574e]">{description}</p>
    </div>
  );
}

export default async function CommunityPage({ searchParams }: { searchParams?: ShowcaseSearchParams }) {
  const filters = normalizeShowcaseFilters({
    room: readSearchParam(searchParams?.room),
    tone: readSearchParam(searchParams?.tone),
    density: readSearchParam(searchParams?.density)
  });
  const currentCursor = readSearchParam(searchParams?.cursor) ?? null;
  const totalHint = parseTotalHint(readSearchParam(searchParams?.total) ?? null);

  const {
    items: snapshots,
    total: totalPublished,
    nextCursor,
    hasMore,
    error: showcaseError
  } = await fetchShowcaseArchivePage(currentCursor, totalHint, filters);

  const activeFilterCount =
    Number(filters.room !== "all") + Number(filters.tone !== "all") + Number(filters.density !== "all");
  const collections = Array.from(
    snapshots
      .flatMap((snapshot) => snapshot.previewMeta?.assetSummary?.collections ?? [])
      .reduce<Map<string, number>>((map, collection) => {
        map.set(collection.label, (map.get(collection.label) ?? 0) + collection.count);
        return map;
      }, new Map())
      .entries()
  );
  const featuredSnapshots = snapshots.slice(0, Math.min(3, snapshots.length));
  const recentSnapshots = snapshots.slice(featuredSnapshots.length);
  const latestPublish = snapshots[0]?.published_at ?? null;
  const loadMoreHref = nextCursor ? buildPageHref("/community", filters, nextCursor, totalPublished) : null;
  const statusDescription = showcaseError
    ? "커뮤니티 목록을 확인할 수 없습니다."
    : activeFilterCount > 0
      ? `현재 조건에 맞는 장면 ${snapshots.length}개를 불러왔습니다.`
      : `현재 공개된 발행 장면 ${totalPublished}개를 탐색할 수 있습니다.`;

  return (
    <div className="min-h-screen bg-[#f3efe8] px-4 pb-20 pt-24 text-[#171411] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <header className="border-b border-black/8 pb-8">
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold tracking-[0.24em] text-[#8a8177]">
            <Users className="h-4 w-4" />
            <span>커뮤니티</span>
          </div>
          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-tight text-[#171411] sm:text-6xl">
                커뮤니티에서 둘러보기
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#625a51]">
                공개된 발행 장면을 큐레이션 기준으로 빠르게 탐색합니다. 모든 카드는 동일한 읽기 전용 뷰어를 엽니다.
              </p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/78 px-4 py-3 text-sm text-[#625a51] shadow-[0_10px_30px_rgba(42,31,21,0.06)]">
              {statusDescription}
            </div>
          </div>

          <ShowcaseFilterRail pathname="/community" filters={filters} activeFilterCount={activeFilterCount} />
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <StatusCard
            label="공개 장면"
            value={showcaseError ? "-" : totalPublished}
            description="커뮤니티와 갤러리에서 동일한 공유 스냅샷을 사용합니다."
          />
          <StatusCard
            label="노출 컬렉션"
            value={showcaseError ? "-" : collections.length}
            description="현재 화면에 노출된 장면 기준으로 집계한 제품 컬렉션 수입니다."
          />
          <StatusCard
            label="최근 발행"
            value={formatDate(latestPublish)}
            description="최근 발행 장면도 동일한 읽기 전용 뷰어 경로로 확인합니다."
          />
        </section>

        {showcaseError ? (
          <section className="mt-10 rounded-[28px] border border-[#c06e3d]/18 bg-[#fff8f3] p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.06)]">
            <div className="text-[10px] font-semibold tracking-[0.22em] text-[#b56a3e]">커뮤니티를 불러올 수 없습니다</div>
            <h2 className="mt-4 text-3xl font-semibold">공개 장면 목록을 확인하지 못했습니다.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">{showcaseError}</p>
          </section>
        ) : snapshots.length === 0 && hasMore ? (
          <section className="mt-10 rounded-[28px] border border-dashed border-black/12 bg-white/72 p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.05)]">
            <div className="text-[10px] font-semibold tracking-[0.22em] text-[#8a7c70]">조건에 맞는 장면을 아직 찾지 못했습니다</div>
            <h2 className="mt-4 text-3xl font-semibold">현재 불러온 범위에서는 결과가 없습니다.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
              더 많은 장면을 불러오거나 필터를 줄여서 다시 확인해 주세요.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {loadMoreHref ? (
                <Link
                  href={loadMoreHref}
                  className="inline-flex rounded-md border border-black/10 bg-white px-4 py-3 text-[11px] font-semibold text-[#52483f] transition hover:border-black/20 hover:bg-[#faf7f2]"
                >
                  더 보기
                </Link>
              ) : null}
              <Link
                href="/community"
                className="inline-flex rounded-md border border-black/10 bg-white px-4 py-3 text-[11px] font-semibold text-[#52483f] transition hover:border-black/20 hover:bg-[#faf7f2]"
              >
                필터 초기화
              </Link>
            </div>
          </section>
        ) : snapshots.length === 0 && activeFilterCount > 0 ? (
          <section className="mt-10 rounded-[28px] border border-dashed border-black/12 bg-white/72 p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.05)]">
            <div className="text-[10px] font-semibold tracking-[0.22em] text-[#8a7c70]">조건과 일치하는 장면이 없습니다</div>
            <h2 className="mt-4 text-3xl font-semibold">필터 조합을 다시 선택해 주세요.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
              공간 유형, 톤, 밀도 조건을 조정하면 다른 커뮤니티 장면을 볼 수 있습니다.
            </p>
            <Link
              href="/community"
              className="mt-6 inline-flex rounded-md border border-black/10 bg-white px-4 py-3 text-[11px] font-semibold text-[#52483f] transition hover:border-black/20 hover:bg-[#faf7f2]"
            >
              필터 초기화
            </Link>
          </section>
        ) : snapshots.length === 0 ? (
          <section className="mt-10 rounded-[28px] border border-dashed border-black/12 bg-white/72 p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.05)]">
            <div className="text-[10px] font-semibold tracking-[0.22em] text-[#8a7c70]">아직 공개된 장면이 없습니다</div>
            <h2 className="mt-4 text-3xl font-semibold">커뮤니티에 노출된 장면이 없습니다.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
              장면이 발행되면 이 페이지에서 동일한 읽기 전용 뷰어로 탐색할 수 있습니다.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-10">
              <div className="mb-6 flex items-center gap-3 text-[10px] font-semibold tracking-[0.24em] text-[#8a7c70]">
                <Sparkles className="h-4 w-4" />
                <span>추천 장면</span>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {featuredSnapshots.map((snapshot) => (
                  <PublishedSnapshotCard
                    key={snapshot.id}
                    token={snapshot.token}
                    thumbnail={snapshot.thumbnail}
                    previewMeta={snapshot.previewMeta}
                    publishedAt={snapshot.published_at}
                  />
                ))}
              </div>
            </section>

            {recentSnapshots.length > 0 ? (
              <section className="mt-12">
                <div className="mb-6 flex items-center gap-3 text-[10px] font-semibold tracking-[0.24em] text-[#8a7c70]">
                  <MessagesSquare className="h-4 w-4" />
                  <span>최신 발행 장면</span>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {recentSnapshots.map((snapshot) => (
                    <PublishedSnapshotCard
                      key={snapshot.id}
                      token={snapshot.token}
                      thumbnail={snapshot.thumbnail}
                      previewMeta={snapshot.previewMeta}
                      publishedAt={snapshot.published_at}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}

        {!showcaseError && snapshots.length > 0 && hasMore && Boolean(loadMoreHref) ? (
          <div className="mt-10 flex justify-center">
            {loadMoreHref ? (
              <Link
                href={loadMoreHref}
                className="inline-flex items-center rounded-md border border-black/10 bg-white/88 px-5 py-3 text-[11px] font-semibold text-[#52483f] transition hover:border-black/20 hover:bg-white"
              >
                다음 장면 더 보기
              </Link>
            ) : null}
          </div>
        ) : null}

        {!showcaseError && snapshots.length > 0 && !hasMore ? (
          <p className="mt-8 text-center text-[10px] font-semibold tracking-[0.2em] text-[#8a7c70]">
            현재 공개된 장면을 모두 확인했습니다
          </p>
        ) : null}
      </div>
    </div>
  );
}
