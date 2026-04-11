import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../../../lib/supabase/server";
import {
  getLatestProjectVersion,
  ProjectVersionApiError
} from "../../../../../../../lib/server/project-versions";

type LatestVersionResponse = {
  version: Record<string, unknown> | null;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toErrorResponse(error: unknown) {
  if (error instanceof ProjectVersionApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(
  _request: Request,
  context: { params: { projectId: string } }
) {
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

    const version = await getLatestProjectVersion(supabase, {
      projectId,
      ownerId: auth.data.user.id
    });

    const payload: LatestVersionResponse = {
      version: version ? (version as Record<string, unknown>) : null
    };
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
