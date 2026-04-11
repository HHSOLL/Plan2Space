import { NextResponse } from "next/server";
import { getRoomTemplateBrowseData } from "../../../../lib/server/room-templates";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  try {
    const payload = getRoomTemplateBrowseData();
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=900"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Room template browse is unavailable.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
