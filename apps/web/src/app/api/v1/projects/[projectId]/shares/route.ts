import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../../lib/supabase/server";
import {
  createProjectShare,
  listProjectShares,
  requireAuthenticatedUserId,
  ShareApiError,
  type ShareType
} from "../../../../../../lib/server/shares";
import { normalizeSharePermission } from "../../../../../../lib/share/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CreateShareRequest = {
  shareType?: unknown;
  permissions?: unknown;
  publishToGallery?: unknown;
};

function toErrorResponse(error: unknown) {
  if (error instanceof ShareApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

function resolveShareType(value: unknown): ShareType {
  return value === "temporary" ? "temporary" : "permanent";
}

export async function GET(_request: Request, context: { params: { projectId: string } }) {
  const projectId = context.params.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  try {
    const ownerId = await requireAuthenticatedUserId(supabase);
    const items = await listProjectShares(supabase, projectId, ownerId);
    return NextResponse.json(
      { items },
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

export async function POST(request: Request, context: { params: { projectId: string } }) {
  const projectId = context.params.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as CreateShareRequest | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  try {
    const ownerId = await requireAuthenticatedUserId(supabase);
    const share = await createProjectShare(supabase, {
      projectId,
      ownerId,
      shareType: resolveShareType(payload.shareType),
      permissions: normalizeSharePermission(payload.permissions as string),
      publishToGallery: Boolean(payload.publishToGallery)
    });
    return NextResponse.json({ share }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
