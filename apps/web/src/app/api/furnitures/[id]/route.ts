import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const isValidToken = (token: string | null): token is string => Boolean(token && token.trim().length > 0);

const getAuthToken = (request: NextRequest) => {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;
  return token ?? null;
};

const createAuthedClient = (request: NextRequest, token: string) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createServerClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => {}
    }
  });
};

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const token = getAuthToken(request);
  if (!isValidToken(token)) {
    return NextResponse.json({ error: "인증 정보가 없습니다." }, { status: 401 });
  }

  const supabase = createAuthedClient(request, token);
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "인증이 필요합니다." }, { status: 401 });
  }

  const { data: furniture, error: furnitureError } = await supabase
    .from("furnitures")
    .select("id, project_id")
    .eq("id", params.id)
    .maybeSingle();

  if (furnitureError) {
    return NextResponse.json({ error: furnitureError.message }, { status: 400 });
  }
  if (!furniture) {
    return NextResponse.json({ error: "Furniture not found" }, { status: 404 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", furniture.project_id)
    .eq("owner_id", authData.user.id)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 400 });
  }
  if (!project) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updatePayload = { ...body, updated_at: new Date().toISOString() };
  delete (updatePayload as { id?: string }).id;
  delete (updatePayload as { project_id?: string }).project_id;

  const { data, error } = await supabase
    .from("furnitures")
    .update(updatePayload)
    .eq("id", params.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to update furniture" }, { status: 400 });
  }

  return NextResponse.json({ furniture: data }, { status: 200 });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const token = getAuthToken(request);
  if (!isValidToken(token)) {
    return NextResponse.json({ error: "인증 정보가 없습니다." }, { status: 401 });
  }

  const supabase = createAuthedClient(request, token);
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "인증이 필요합니다." }, { status: 401 });
  }

  const { data: furniture, error: furnitureError } = await supabase
    .from("furnitures")
    .select("id, project_id")
    .eq("id", params.id)
    .maybeSingle();

  if (furnitureError) {
    return NextResponse.json({ error: furnitureError.message }, { status: 400 });
  }
  if (!furniture) {
    return NextResponse.json({ error: "Furniture not found" }, { status: 404 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", furniture.project_id)
    .eq("owner_id", authData.user.id)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 400 });
  }
  if (!project) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("furnitures").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return new NextResponse(null, { status: 204 });
}
