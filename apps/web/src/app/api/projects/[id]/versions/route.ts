import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../../../../../../../../types/database";

type CookieOptions = {
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
  priority?: "low" | "medium" | "high";
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type RequestBody = {
  customization: unknown;
  floorPlan?: unknown;
  message?: unknown;
};

function isVec2(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function isVec3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function isFloorPlanWall(
  value: unknown
): value is { id: string; from: [number, number]; to: [number, number]; thickness: number; material: string; height: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string") return false;
  if (!isVec2(v.from) || !isVec2(v.to)) return false;
  if (typeof v.thickness !== "number" || !Number.isFinite(v.thickness)) return false;
  if (typeof v.material !== "string") return false;
  if (typeof v.height !== "number" || !Number.isFinite(v.height)) return false;
  return true;
}

function isFloorPlanOpening(
  value: unknown
): value is { id: string; wallId: string; type: "door" | "window"; position: [number, number]; width: number; height: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string") return false;
  if (typeof v.wallId !== "string") return false;
  if (v.type !== "door" && v.type !== "window") return false;
  if (!isVec2(v.position)) return false;
  if (typeof v.width !== "number" || !Number.isFinite(v.width)) return false;
  if (typeof v.height !== "number" || !Number.isFinite(v.height)) return false;
  if (v.sillHeight != null && (typeof v.sillHeight !== "number" || !Number.isFinite(v.sillHeight))) return false;
  return true;
}

function isFloorPlanData(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.walls) || v.walls.length === 0 || !v.walls.every(isFloorPlanWall)) return false;
  if (v.openings != null) {
    if (!Array.isArray(v.openings) || !v.openings.every(isFloorPlanOpening)) return false;
  }
  return true;
}

function isFurnitureItem(
  value: unknown
): value is { id: string; modelId: string; position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.modelId === "string" &&
    isVec3(v.position) &&
    isVec3(v.rotation) &&
    isVec3(v.scale)
  );
}

function isCustomizationData(value: unknown): value is Database["public"]["Tables"]["project_versions"]["Row"]["customization"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v.schemaVersion !== 1) return false;
  if (!Array.isArray(v.furniture) || !v.furniture.every(isFurnitureItem)) return false;
  if (!v.surfaceMaterials || typeof v.surfaceMaterials !== "object" || Array.isArray(v.surfaceMaterials)) return false;
  return true;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const projectId = params.id;
  if (!isUuid(projectId)) {
    return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
  }

  let payload: RequestBody;
  try {
    payload = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = typeof payload.message === "string" && payload.message.trim().length > 0 ? payload.message.trim() : null;
  if (!isCustomizationData(payload.customization)) {
    return NextResponse.json({ error: "Invalid customization payload." }, { status: 400 });
  }

  let floorPlan: unknown | undefined;
  if (payload.floorPlan !== undefined) {
    if (!isFloorPlanData(payload.floorPlan)) {
      return NextResponse.json({ error: "Invalid floorPlan payload." }, { status: 400 });
    }
    floorPlan = payload.floorPlan;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase env not configured." }, { status: 500 });
  }

  const cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }> = [];
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookies) {
        cookiesToSet.push(...nextCookies);
      }
    }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 401 });
  }
  if (!userData.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rpcParams: Database["public"]["Functions"]["create_project_version"]["Args"] = {
    p_project_id: projectId,
    p_message: message,
    p_customization: payload.customization
  };
  if (floorPlan !== undefined) (rpcParams as any).p_floor_plan = floorPlan;

  const { data: versionRow, error: rpcError } = await supabase.rpc("create_project_version", rpcParams);

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  const response = NextResponse.json({ version: versionRow }, { status: 200 });
  for (const c of cookiesToSet) {
    response.cookies.set(c.name, c.value, c.options);
  }
  return response;
}
