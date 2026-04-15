import { NextResponse } from "next/server";
import { mapProjectVersionToSceneDocument } from "../../../../../../lib/domain/scene-document";
import { getProjectByOwner, ProjectApiError } from "../../../../../../lib/server/projects";
import {
  getLatestProjectVersion,
  ProjectVersionApiError
} from "../../../../../../lib/server/project-versions";
import { ShareApiError, requireAuthenticatedUserId } from "../../../../../../lib/server/shares";
import { createSupabaseServerClient } from "../../../../../../lib/supabase/server";

type BootstrapSource = "current_version" | "latest_version" | "none";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toErrorResponse(error: unknown) {
  if (error instanceof ProjectApiError || error instanceof ProjectVersionApiError || error instanceof ShareApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(_request: Request, context: { params: { projectId: string } }) {
  const projectId = context.params.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  try {
    const ownerId = await requireAuthenticatedUserId(supabase);
    const project = await getProjectByOwner(supabase, ownerId, projectId);
    const latestVersion = await getLatestProjectVersion(supabase, { projectId, ownerId });

    if (latestVersion) {
      const mapped = mapProjectVersionToSceneDocument(latestVersion as unknown as Record<string, unknown>);
      if (mapped) {
        const source: BootstrapSource =
          project.current_version_id && project.current_version_id === latestVersion.id
            ? "current_version"
            : "latest_version";
        return NextResponse.json(
          {
            source,
            bootstrap: mapped
          },
          {
            status: 200,
            headers: {
              "Cache-Control": "private, no-store, max-age=0"
            }
          }
        );
      }
    }

    return NextResponse.json(
      {
        source: "none" as const,
        bootstrap: null
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0"
        }
      }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
