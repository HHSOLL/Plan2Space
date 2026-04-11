import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "../../../../../../lib/supabase/server";
import {
  createProjectVersion,
  listProjectVersions,
  ProjectVersionApiError,
  SaveVersionSchema
} from "../../../../../../lib/server/project-versions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toErrorResponse(error: unknown) {
  if (error instanceof ProjectVersionApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid request body.", details: error.flatten() }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

function parseNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request, context: { params: { projectId: string } }) {
  const projectId = context.params.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  try {
    const auth = await supabase.auth.getUser();
    if (auth.error || !auth.data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listProjectVersions(supabase, {
      projectId,
      ownerId: auth.data.user.id,
      limit: parseNumber(searchParams.get("limit"), 20),
      offset: parseNumber(searchParams.get("cursor"), 0)
    });

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: { projectId: string } }) {
  const projectId = context.params.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  try {
    const auth = await supabase.auth.getUser();
    if (auth.error || !auth.data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = SaveVersionSchema.parse(await request.json());
    const version = await createProjectVersion(supabase, {
      projectId,
      ownerId: auth.data.user.id,
      payload
    });

    return NextResponse.json({ version }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
