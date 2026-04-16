import Image from "next/image";
import Link from "next/link";
import {
  BedDouble,
  BriefcaseBusiness,
  ChefHat,
  ChevronDown,
  LampDesk,
  Sofa,
  ToyBrick
} from "lucide-react";
import type { BuilderTemplateId } from "../../../lib/builder/templates";
import {
  EMPTY_ROOM_TEMPLATE_CARDS,
  FURNISHED_ROOM_TEMPLATE_CARDS,
  type EmptyRoomTemplateCard,
  type FurnishedTemplateCategory,
  type FurnishedRoomTemplateId,
  type FurnishedRoomTemplateCard,
  type TemplateSeedPreset
} from "../../../lib/builder/template-browser";

type SearchParams = {
  mode?: string;
  category?: string;
  density?: string;
};

function buildBuilderHref(input: {
  templateId: BuilderTemplateId;
  width: number;
  depth: number;
  nookWidth?: number;
  nookDepth?: number;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  projectName: string;
  seedPreset?: TemplateSeedPreset;
  scenePresetId?: FurnishedRoomTemplateId;
}) {
  const searchParams = new URLSearchParams({
    intent: "template",
    templateId: input.templateId,
    width: String(input.width),
    depth: String(input.depth),
    wall: String(input.wallMaterialIndex),
    floor: String(input.floorMaterialIndex),
    projectName: input.projectName
  });

  if (typeof input.nookWidth === "number") {
    searchParams.set("nookWidth", String(input.nookWidth));
  }
  if (typeof input.nookDepth === "number") {
    searchParams.set("nookDepth", String(input.nookDepth));
  }
  if (input.seedPreset && input.seedPreset !== "none") {
    searchParams.set("seed", input.seedPreset);
  }
  if (input.scenePresetId) {
    searchParams.set("scenePreset", input.scenePresetId);
  }

  return `/studio/builder?${searchParams.toString()}`;
}

function resolveMode(rawMode: string | undefined) {
  return rawMode === "furnished" ? "furnished" : "empty";
}

function resolveDensity(rawDensity: string | undefined): Exclude<TemplateSeedPreset, "none"> {
  return rawDensity === "partial" ? "partial" : "full";
}

function resolveCategory(rawCategory: string | undefined): FurnishedTemplateCategory {
  if (
    rawCategory === "living" ||
    rawCategory === "kids" ||
    rawCategory === "bedroom" ||
    rawCategory === "workspace" ||
    rawCategory === "dining"
  ) {
    return rawCategory;
  }
  return "all";
}

function categoryIcon(category: FurnishedTemplateCategory) {
  switch (category) {
    case "living":
      return Sofa;
    case "kids":
      return ToyBrick;
    case "bedroom":
      return BedDouble;
    case "workspace":
      return BriefcaseBusiness;
    case "dining":
      return ChefHat;
    case "all":
    default:
      return LampDesk;
  }
}

function BlankRoomPreview({
  wallColor,
  floorColor,
  accentWallColor,
  hasWideWindow,
  hasFrenchDoor,
  templateId
}: Pick<
  EmptyRoomTemplateCard,
  "wallColor" | "floorColor" | "accentWallColor" | "hasWideWindow" | "hasFrenchDoor" | "templateId"
>) {
  const floorPathByTemplate: Record<BuilderTemplateId, string> = {
    "rect-studio": "M82 157 188 118 318 160 208 206 Z",
    "l-shape": "M82 154 156 126 202 140 244 124 318 150 243 176 208 206 Z",
    "cut-shape": "M82 154 193 116 318 156 286 170 208 206 Z",
    "t-shape": "M92 154 168 126 198 136 232 126 308 152 262 166 262 188 204 206 150 188 150 168 Z",
    "u-shape": "M82 154 190 118 318 154 274 170 250 162 226 182 182 182 158 162 124 170 Z",
    "slanted-shape": "M106 140 186 114 284 124 318 156 284 174 204 206 114 182 82 156 Z"
  };

  return (
    <svg viewBox="0 0 400 250" className="h-full w-full" aria-hidden>
      <rect width="400" height="250" fill="#d6d6d6" />
      <path d="M82 157 82 98 188 60 188 118 Z" fill={accentWallColor ?? wallColor} />
      <path d="M188 118 188 60 318 96 318 160 Z" fill={wallColor} />
      <path d={floorPathByTemplate[templateId]} fill={floorColor} />
      <path d="M82 157 188 118 318 160" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
      <path d="M82 157 82 98 188 60 318 96 318 160" fill="none" stroke="#f4f4f4" strokeWidth="4" strokeLinejoin="round" />

      {hasWideWindow ? (
        <>
          <rect x="116" y="88" width="52" height="38" rx="2" fill="#eef4f9" stroke="#ffffff" strokeWidth="4" />
          <line x1="142" y1="88" x2="142" y2="126" stroke="#d5dce5" strokeWidth="3" />
        </>
      ) : (
        <>
          <rect x="120" y="90" width="36" height="32" rx="2" fill="#eef4f9" stroke="#ffffff" strokeWidth="4" />
          <line x1="138" y1="90" x2="138" y2="122" stroke="#d5dce5" strokeWidth="3" />
        </>
      )}

      {hasFrenchDoor ? (
        <>
          <rect x="255" y="86" width="28" height="62" rx="2" fill="#f9f9f9" stroke="#ffffff" strokeWidth="4" />
          <rect x="282" y="86" width="28" height="62" rx="2" fill="#f9f9f9" stroke="#ffffff" strokeWidth="4" />
          <line x1="283" y1="86" x2="283" y2="148" stroke="#d9d9d9" strokeWidth="3" />
        </>
      ) : (
        <rect x="272" y="90" width="24" height="54" rx="2" fill="#fafafa" stroke="#ffffff" strokeWidth="4" />
      )}
    </svg>
  );
}

function EmptyRoomCard({ card }: { card: EmptyRoomTemplateCard }) {
  return (
    <Link
      href={buildBuilderHref({
        templateId: card.templateId,
        width: card.width,
        depth: card.depth,
        nookWidth: card.nookWidth,
        nookDepth: card.nookDepth,
        wallMaterialIndex: card.wallMaterialIndex,
        floorMaterialIndex: card.floorMaterialIndex,
        projectName: card.title
      })}
      className="overflow-hidden rounded-[10px] bg-white shadow-[0_12px_32px_rgba(16,18,22,0.08)] transition hover:-translate-y-0.5"
    >
      <div className="aspect-[1.34/1]">
        <BlankRoomPreview {...card} />
      </div>
      <div className="space-y-2 px-5 py-4">
        <div className="text-[18px] font-semibold tracking-[-0.02em] text-[#4a4a4a]">{card.title}</div>
        <div className="text-[14px] text-[#7e7e7e]">{card.areaLabel}</div>
      </div>
    </Link>
  );
}

function FurnishedRoomCard({ card }: { card: FurnishedRoomTemplateCard }) {
  return (
    <Link
      href={buildBuilderHref({
        templateId: card.templateId,
        width: card.width,
        depth: card.depth,
        nookWidth: card.nookWidth,
        nookDepth: card.nookDepth,
        wallMaterialIndex: card.wallMaterialIndex,
        floorMaterialIndex: card.floorMaterialIndex,
        projectName: card.projectName,
        seedPreset: card.density,
        scenePresetId: card.id
      })}
      className="overflow-hidden rounded-[10px] bg-white shadow-[0_12px_32px_rgba(16,18,22,0.08)] transition hover:-translate-y-0.5"
    >
      <div className="relative aspect-[1.44/1]">
        <Image src={card.thumbnailSrc} alt={card.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 25vw" />
      </div>
      <div className="space-y-2 px-5 py-4">
        <div className="text-[18px] font-semibold tracking-[-0.02em] text-[#4a4a4a]">{card.title}</div>
        <div className="text-[14px] text-[#7e7e7e]">{card.areaLabel}</div>
      </div>
    </Link>
  );
}

export default function StudioSelectPage({ searchParams }: { searchParams?: SearchParams }) {
  const mode = resolveMode(searchParams?.mode);
  const density = resolveDensity(searchParams?.density);
  const category = resolveCategory(searchParams?.category);
  const isFurnished = mode === "furnished";

  const categoryFilters: Array<{ id: FurnishedTemplateCategory; label: string }> = [
    { id: "all", label: "전체" },
    { id: "living", label: "거실" },
    { id: "kids", label: "키즈공간" },
    { id: "bedroom", label: "침실" },
    { id: "workspace", label: "사무실" },
    { id: "dining", label: "다이닝룸" }
  ];

  const visibleFurnishedCards = FURNISHED_ROOM_TEMPLATE_CARDS.filter((card) => {
    const matchesCategory = category === "all" || card.category === category;
    const matchesDensity = card.density === density;
    return matchesCategory && matchesDensity;
  });
  const hasVisibleFurnishedCards = visibleFurnishedCards.length > 0;

  return (
    <div className="min-h-screen bg-white px-5 pb-24 pt-12 text-[#202020] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1820px]">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3 text-[14px] font-medium text-[#7a7a7a]">
              <Link
                href="/studio/select?mode=empty"
                className={`rounded-full border px-4 py-2 transition ${!isFurnished ? "border-[#4e4e4e] text-[#202020]" : "border-[#ececec] text-[#8a8a8a]"}`}
              >
                빈 공간
              </Link>
              <Link
                href="/studio/select?mode=furnished&density=full"
                className={`rounded-full border px-4 py-2 transition ${isFurnished ? "border-[#4e4e4e] text-[#202020]" : "border-[#ececec] text-[#8a8a8a]"}`}
              >
                가구가 비치된 공간
              </Link>
            </div>
            <h1 className="mt-6 text-[48px] font-semibold tracking-[-0.04em] text-[#181818]">
              {isFurnished ? "가구가 비치된 공간" : "빈 공간"}
            </h1>
          </div>

          {isFurnished ? (
            <div className="flex items-center gap-0 rounded-[8px] border border-[#cfcfcf] bg-white text-[15px] font-semibold">
              <Link
                href={`/studio/select?mode=furnished&category=${category}&density=full`}
                className={`px-6 py-4 transition ${density === "full" ? "border-r border-[#2a2a2a] text-[#111111]" : "text-[#676767]"}`}
              >
                가구 완비
              </Link>
              <Link
                href={`/studio/select?mode=furnished&category=${category}&density=partial`}
                className={`px-6 py-4 transition ${density === "partial" ? "text-[#111111]" : "text-[#676767]"}`}
              >
                일부 가구 배치
              </Link>
            </div>
          ) : null}
        </div>

        {isFurnished ? (
          <div className="mt-10 flex flex-wrap items-center gap-5">
            {categoryFilters.map((item) => {
              const Icon = categoryIcon(item.id);
              const isActive = category === item.id;
              return (
                <Link
                  key={item.id}
                  href={`/studio/select?mode=furnished&category=${item.id}&density=${density}`}
                  className={`inline-flex items-center gap-4 rounded-full px-7 py-5 text-[18px] font-semibold transition ${
                    isActive
                      ? "border border-[#4f4f4f] bg-white text-[#202020]"
                      : "bg-[#f6f6f4] text-[#5a5a5a]"
                  }`}
                >
                  <Icon className="h-7 w-7 stroke-[2.2]" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}

        {!isFurnished ? (
          <>
            <div className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-4">
              {EMPTY_ROOM_TEMPLATE_CARDS.map((card) => (
                <EmptyRoomCard key={card.id} card={card} />
              ))}
            </div>

            <div className="mt-14 flex justify-center">
              <Link
                href="/studio/select?mode=furnished&density=full"
                className="inline-flex items-center gap-4 rounded-full bg-[#f6f6f4] px-10 py-6 text-[18px] font-semibold text-[#2b2b2b]"
              >
                <ChevronDown className="h-6 w-6" />
                보기 8개 더 많은
              </Link>
            </div>
          </>
        ) : (
          <>
            {hasVisibleFurnishedCards ? (
              <div className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-4">
                {visibleFurnishedCards.map((card) => (
                  <FurnishedRoomCard key={card.id} card={card} />
                ))}
              </div>
            ) : (
              <div className="mt-14 rounded-[24px] border border-[#ece8e2] bg-[#faf8f4] px-8 py-12 text-center">
                <div className="text-[28px] font-semibold tracking-[-0.03em] text-[#1b1b1b]">이 조합의 템플릿은 아직 준비 중입니다.</div>
                <p className="mt-3 text-[16px] text-[#6c6a66]">
                  다른 밀도나 카테고리로 둘러보거나 빈 공간에서 직접 데스크테리어를 시작해 보세요.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <Link
                    href="/studio/select?mode=furnished&category=all&density=partial"
                    className="rounded-full border border-[#2b2b2b] bg-white px-6 py-3 text-[15px] font-semibold text-[#1f1f1f]"
                  >
                    다른 가구 템플릿 보기
                  </Link>
                  <Link
                    href="/studio/select?mode=empty"
                    className="rounded-full bg-[#1f1f1f] px-6 py-3 text-[15px] font-semibold text-white"
                  >
                    빈 공간에서 시작하기
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
