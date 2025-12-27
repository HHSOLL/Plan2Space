import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../../../../../../../types/database";

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
  message?: unknown;
};

function isVec3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
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

  const { data: versionRow, error: rpcError } = await supabase.rpc("create_project_version", {
    p_project_id: projectId,
    p_message: message,
    p_customization: payload.customization
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  const response = NextResponse.json({ version: versionRow }, { status: 200 });
  for (const c of cookiesToSet) {
    response.cookies.set(c.name, c.value, c.options);
  }
  return response;
}
