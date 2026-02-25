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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", authData.user.id)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 400 });
  }
  if (!project) {
    return NextResponse.json({ error: "프로젝트에 접근할 수 없습니다." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("furnitures")
    .select("*")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ furnitures: data ?? [] }, { status: 200 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", authData.user.id)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 400 });
  }
  if (!project) {
    return NextResponse.json({ error: "프로젝트에 접근할 수 없습니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const insertPayload = {
    project_id: params.id,
    name: body.name,
    category: body.category,
    position: body.position ?? { x: 0, y: 0, z: 0 },
    rotation: body.rotation ?? { x: 0, y: 0, z: 0 },
    scale: body.scale ?? { x: 1, y: 1, z: 1 },
    color: body.color ?? null,
    metadata: body.metadata ?? null
  };

  const { data, error } = await supabase
    .from("furnitures")
    .insert(insertPayload)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create furniture" }, { status: 400 });
  }

  return NextResponse.json({ furniture: data }, { status: 201 });
}
