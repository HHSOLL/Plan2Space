import { NextResponse } from "next/server";
import { fetchShowcaseSnapshotFeed } from "../../../../lib/server/showcase";
import {
  type ShowcaseDensityFilter,
  type ShowcaseRoomFilter,
  type ShowcaseToneFilter
} from "../../../../lib/api/showcase";

export const runtime = "nodejs";
export const revalidate = 60;

function parseLimit(rawValue: string | null) {
  if (!rawValue) return 24;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return 24;
  return Math.min(Math.max(Math.trunc(parsed), 1), 240);
}

function parseRoomFilter(rawValue: string | null): ShowcaseRoomFilter | null {
  if (
    rawValue === "living" ||
    rawValue === "workspace" ||
    rawValue === "bedroom" ||
    rawValue === "flex" ||
    rawValue === "all"
  ) {
    return rawValue;
  }
  return null;
}

function parseToneFilter(rawValue: string | null): ShowcaseToneFilter | null {
  if (rawValue === "sand" || rawValue === "olive" || rawValue === "slate" || rawValue === "ember" || rawValue === "all") {
    return rawValue;
  }
  return null;
}

function parseDensityFilter(rawValue: string | null): ShowcaseDensityFilter | null {
  if (rawValue === "minimal" || rawValue === "layered" || rawValue === "collected" || rawValue === "all") {
    return rawValue;
  }
  return null;
}

function parseTotalHint(rawValue: string | null): number | null {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const feed = await fetchShowcaseSnapshotFeed({
      limit: parseLimit(searchParams.get("limit")),
      cursor: searchParams.get("cursor"),
      totalHint: parseTotalHint(searchParams.get("total")),
      room: parseRoomFilter(searchParams.get("room")),
      tone: parseToneFilter(searchParams.get("tone")),
      density: parseDensityFilter(searchParams.get("density"))
    });
    return NextResponse.json(
      {
        items: feed.items,
        total: feed.total,
        nextCursor: feed.nextCursor,
        hasMore: feed.hasMore
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Showcase feed is unavailable.";
    const status = message === "Invalid showcase cursor." ? 400 : 500;
    return NextResponse.json(
      { error: message },
      {
        status
      }
    );
  }
}
