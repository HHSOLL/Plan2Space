import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../../../../../../../types/database";

const projectSelect = "id,owner_id,name,description,meta,created_at,updated_at";

type ProjectRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "owner_id" | "name" | "description" | "meta" | "created_at" | "updated_at"
>;

type UpdateProjectPayload = {
  name?: string;
  description?: string | null;
};

const mapProject = (row: ProjectRow) => ({
  id: row.id,
  owner_id: row.owner_id,
  name: row.name,
  description: row.description,
  metadata: row.meta ?? undefined,
  created_at: row.created_at,
  updated_at: row.updated_at
});

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
  return createServerClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => {}
    }
  });
};

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

  const { data, error } = await supabase
    .from("projects")
    .select(projectSelect)
    .eq("id", params.id)
    .eq("owner_id", authData.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ project: mapProject(data) }, { status: 200 });
}

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

  const { name, description } = (await request.json().catch(() => ({}))) as UpdateProjectPayload;
  if (name == null && description == null) {
    return NextResponse.json({ error: "수정할 내용이 없습니다." }, { status: 400 });
  }

  const updatePayload: Database["public"]["Tables"]["projects"]["Update"] = {
    updated_at: new Date().toISOString()
  };
  if (name != null) updatePayload.name = name.trim();
  if (description !== undefined) updatePayload.description = description;

  const { data, error } = await supabase
    .from("projects")
    .update(updatePayload)
    .eq("id", params.id)
    .eq("owner_id", authData.user.id)
    .select(projectSelect)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(mapProject(data), { status: 200 });
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

  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", params.id)
    .eq("owner_id", authData.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
