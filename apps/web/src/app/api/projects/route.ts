import { NextResponse } from "next/server";

const message = "Projects domain API has moved to Railway (/v1/projects).";

function moved() {
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

export async function GET() {
  return moved();
}

export async function POST() {
  return moved();
}
