import { NextResponse } from "next/server";

function moved() {
  return NextResponse.json(
    {
      error: "ENDPOINT_MOVED",
      details: "Furniture domain API has moved to Railway."
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
