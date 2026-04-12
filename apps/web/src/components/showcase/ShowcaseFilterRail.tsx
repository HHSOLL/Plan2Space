import Link from "next/link";
import {
  normalizeShowcaseFilters,
  type ShowcaseDensityFilter,
  type ShowcaseFilters,
  type ShowcaseRoomFilter,
  type ShowcaseToneFilter
} from "../../lib/api/showcase";

export type ShowcaseSearchParams = Record<string, string | string[] | undefined>;

export const ROOM_FILTER_OPTIONS: Array<{ id: ShowcaseRoomFilter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "living", label: "거실" },
  { id: "workspace", label: "작업실" },
  { id: "bedroom", label: "침실" },
  { id: "flex", label: "멀티룸" }
];

export const TONE_FILTER_OPTIONS: Array<{ id: ShowcaseToneFilter; label: string }> = [
  { id: "all", label: "전체 톤" },
  { id: "sand", label: "샌드" },
  { id: "olive", label: "올리브" },
  { id: "slate", label: "슬레이트" },
  { id: "ember", label: "엠버" }
];

export const DENSITY_FILTER_OPTIONS: Array<{ id: ShowcaseDensityFilter; label: string }> = [
  { id: "all", label: "전체 밀도" },
  { id: "minimal", label: "미니멀" },
  { id: "layered", label: "레이어드" },
  { id: "collected", label: "컬렉션" }
];

function buildFilterHref(pathname: string, filters: ShowcaseFilters, patch: Partial<ShowcaseFilters>) {
  const nextFilters = normalizeShowcaseFilters({ ...filters, ...patch });
  const params = new URLSearchParams();

  if (nextFilters.room !== "all") params.set("room", nextFilters.room);
  if (nextFilters.tone !== "all") params.set("tone", nextFilters.tone);
  if (nextFilters.density !== "all") params.set("density", nextFilters.density);

  const query = params.toString();
  return query.length > 0 ? `${pathname}?${query}` : pathname;
}

export function buildPageHref(pathname: string, filters: ShowcaseFilters, cursor: string | null, totalHint: number) {
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

export function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? undefined : value;
}

export function parseTotalHint(rawValue: string | null) {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
}

function ShowcaseFilterRow({
  label,
  pathname,
  filters,
  field,
  options
}: {
  label: string;
  pathname: string;
  filters: ShowcaseFilters;
  field: "room" | "tone" | "density";
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-[#8a8177]">
      <span className="mr-2">{label}</span>
      {options.map((option) => {
        const isActive = filters[field] === option.id;

        return (
          <Link
            key={option.id}
            href={buildFilterHref(pathname, filters, { [field]: option.id })}
            className={`shrink-0 rounded-md px-4 py-2.5 text-[11px] font-semibold transition ${
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
  );
}

export function ShowcaseFilterRail({
  pathname,
  filters,
  activeFilterCount
}: {
  pathname: string;
  filters: ShowcaseFilters;
  activeFilterCount: number;
}) {
  return (
    <div className="mt-7 space-y-3">
      <ShowcaseFilterRow
        label="공간 유형"
        pathname={pathname}
        filters={filters}
        field="room"
        options={ROOM_FILTER_OPTIONS}
      />
      <ShowcaseFilterRow
        label="톤"
        pathname={pathname}
        filters={filters}
        field="tone"
        options={TONE_FILTER_OPTIONS}
      />
      <div className="flex flex-wrap items-center gap-2">
        <ShowcaseFilterRow
          label="밀도"
          pathname={pathname}
          filters={filters}
          field="density"
          options={DENSITY_FILTER_OPTIONS}
        />
        {activeFilterCount > 0 ? (
          <Link
            href={pathname}
            className="ml-2 inline-flex items-center rounded-md px-2 py-2 text-[11px] font-semibold text-[#7b6f64] transition hover:text-[#171411]"
          >
            필터 초기화
          </Link>
        ) : null}
      </div>
    </div>
  );
}
