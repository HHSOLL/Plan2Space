import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "ENDPOINT_MOVED",
      details: "Project version API has moved to Railway (/v1/projects/:projectId/versions)."
    },
    { status: 410 }
  );
}
