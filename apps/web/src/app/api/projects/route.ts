import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../../../../../../types/database";

type ProjectRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "owner_id" | "name" | "description" | "meta" | "created_at" | "updated_at"
>;

type CreateProjectPayload = {
  name?: string;
  description?: string | null;
};

const projectSelect = "id,owner_id,name,description,meta,created_at,updated_at";

const isValidToken = (token: string | null): token is string => Boolean(token && token.trim().length > 0);

const mapProject = (row: ProjectRow) => ({
  id: row.id,
  owner_id: row.owner_id,
  name: row.name,
  description: row.description,
  metadata: row.meta ?? undefined,
  created_at: row.created_at,
  updated_at: row.updated_at
});

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
  return createServerClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => {}
    }
  });
};

export async function GET(request: NextRequest) {
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

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? 20);
  const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1), 100);
  const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

  const { data, error, count } = await supabase
    .from("projects")
    .select(projectSelect, { count: "exact" })
    .eq("owner_id", authData.user.id)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const projects = (data ?? []).map(mapProject);
  return NextResponse.json({ projects, total: count ?? 0 }, { status: 200 });
}

export async function POST(request: NextRequest) {
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

  const { name, description } = (await request.json().catch(() => ({}))) as CreateProjectPayload;
  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "프로젝트 이름을 입력하세요." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: authData.user.id,
      name: name.trim(),
      description: description ?? null
    })
    .select(projectSelect)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "프로젝트 생성 실패" }, { status: 400 });
  }

  return NextResponse.json(mapProject(data), { status: 201 });
}
