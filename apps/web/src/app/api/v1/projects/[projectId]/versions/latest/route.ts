import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../../../lib/supabase/server";

type LatestVersionResponse = {
  version: Record<string, unknown> | null;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: { projectId: string } }
) {
  const projectId = context.params.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = auth.data.user.id;

  const projectLookup = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (projectLookup.error) {
    return NextResponse.json({ error: projectLookup.error.message }, { status: 500 });
  }
  if (!projectLookup.data) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const versionLookup = await supabase
    .from("project_versions")
    .select("id, project_id, version, created_by, message, floor_plan, customization, snapshot_path, created_at, updated_at")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionLookup.error) {
    return NextResponse.json({ error: versionLookup.error.message }, { status: 500 });
  }

  const payload: LatestVersionResponse = {
    version: versionLookup.data ? (versionLookup.data as Record<string, unknown>) : null
  };
  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0"
    }
  });
}
