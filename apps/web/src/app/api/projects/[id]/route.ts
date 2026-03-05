import { NextResponse } from "next/server";

function moved() {
  return NextResponse.json(
    {
      error: "ENDPOINT_MOVED",
      details: "Project detail API has moved to Railway (/v1/projects/:projectId)."
    },
    { status: 410 }
  );
}

export async function GET() {
  return moved();
}

export async function PUT() {
  return moved();
}

export async function DELETE() {
  return moved();
}
