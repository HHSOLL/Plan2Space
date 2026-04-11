import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import {
  createProjectForOwner,
  listProjectsByOwner,
  ProjectApiError
} from "../../../../lib/server/projects";
import { requireAuthenticatedUserId } from "../../../../lib/server/shares";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional()
});

function toErrorResponse(error: unknown) {
  if (error instanceof ProjectApiError) {
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

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();

  try {
    const ownerId = await requireAuthenticatedUserId(supabase);
    const { searchParams } = new URL(request.url);
    const result = await listProjectsByOwner(supabase, ownerId, {
      limit: parseNumber(searchParams.get("limit"), 20),
      offset: parseNumber(searchParams.get("offset"), 0)
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

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();

  try {
    const ownerId = await requireAuthenticatedUserId(supabase);
    const payload = CreateProjectSchema.parse(await request.json());
    const project = await createProjectForOwner(supabase, ownerId, payload);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
