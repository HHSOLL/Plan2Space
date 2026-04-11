import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { JobApiError, getJobForOwner } from "../../../../../lib/server/jobs";
import { ShareApiError, requireAuthenticatedUserId } from "../../../../../lib/server/shares";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toErrorResponse(error: unknown) {
  if (error instanceof JobApiError || error instanceof ShareApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(_request: Request, context: { params: { jobId: string } }) {
  const jobId = context.params.jobId;
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  try {
    const ownerId = await requireAuthenticatedUserId(supabase);
    const job = await getJobForOwner(supabase, ownerId, jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json(job, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
