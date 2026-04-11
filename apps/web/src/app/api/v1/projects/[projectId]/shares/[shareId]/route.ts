import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../../../lib/supabase/server";
import {
  deleteProjectShare,
  requireAuthenticatedUserId,
  ShareApiError,
  updateProjectShareVisibility
} from "../../../../../../../lib/server/shares";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UpdateShareRequest = {
  isGalleryVisible?: unknown;
};

function toErrorResponse(error: unknown) {
  if (error instanceof ShareApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function PATCH(
  request: Request,
  context: { params: { projectId: string; shareId: string } }
) {
  const { projectId, shareId } = context.params;
  if (!projectId || !shareId) {
    return NextResponse.json({ error: "projectId and shareId are required" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as UpdateShareRequest | null;
  if (!payload || typeof payload.isGalleryVisible !== "boolean") {
    return NextResponse.json({ error: "isGalleryVisible boolean is required." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  try {
    const ownerId = await requireAuthenticatedUserId(supabase);
    const share = await updateProjectShareVisibility(supabase, {
      projectId,
      shareId,
      ownerId,
      isGalleryVisible: payload.isGalleryVisible
    });
    return NextResponse.json({ share }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { projectId: string; shareId: string } }
) {
  const { projectId, shareId } = context.params;
  if (!projectId || !shareId) {
    return NextResponse.json({ error: "projectId and shareId are required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  try {
    const ownerId = await requireAuthenticatedUserId(supabase);
    await deleteProjectShare(supabase, {
      projectId,
      shareId,
      ownerId
    });
    return NextResponse.json({ id: shareId }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
