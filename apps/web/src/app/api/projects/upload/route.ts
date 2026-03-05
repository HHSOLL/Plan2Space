import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "ENDPOINT_MOVED",
      details: "Project upload API has moved to Railway."
    },
    { status: 410 }
  );
}
