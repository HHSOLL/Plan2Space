import { NextResponse } from "next/server";

const message =
  "Floorplan parsing has moved to Railway workers. Use the Railway API job pipeline instead of /api/ai/parse-floorplan.";

function gone() {
  return NextResponse.json(
    {
      error: "ENDPOINT_MOVED",
      details: message,
      recoverable: true,
      errorCode: "ENDPOINT_MOVED_TO_RAILWAY"
    },
    { status: 410 }
  );
}

export async function POST() {
  return gone();
}
