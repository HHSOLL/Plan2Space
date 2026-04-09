import { NextResponse } from "next/server";
import { fetchShowcaseSnapshotsViaRailway } from "../../../../lib/server/showcase";

export const runtime = "nodejs";
export const revalidate = 60;

function parseLimit(rawValue: string | null) {
  if (!rawValue) return 24;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return 24;
  return Math.min(Math.max(Math.trunc(parsed), 1), 60);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const items = await fetchShowcaseSnapshotsViaRailway(parseLimit(searchParams.get("limit")), 60);
    return NextResponse.json(
      { items },
      {
        status: 200,
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Showcase feed is unavailable.";
    return NextResponse.json(
      { error: message },
      {
        status: 502
      }
    );
  }
}
