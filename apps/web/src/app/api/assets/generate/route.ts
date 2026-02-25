import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../../../../../../../types/database";

type ProviderKey = "triposr" | "meshy";

type ProviderConfig = {
  key: ProviderKey;
  label: string;
  apiUrl: string | null;
  apiKey: string | null;
  statusUrl: string | null;
};

const PROVIDERS: ProviderConfig[] = [
  {
    key: "triposr",
    label: "TripoSR",
    apiUrl: process.env.TRIPOSR_API_URL ?? null,
    apiKey: process.env.TRIPOSR_API_KEY ?? null,
    statusUrl: process.env.TRIPOSR_STATUS_URL ?? null
  },
  {
    key: "meshy",
    label: "Meshy",
    apiUrl: process.env.MESHY_API_URL ?? null,
    apiKey: process.env.MESHY_API_KEY ?? null,
    statusUrl: process.env.MESHY_STATUS_URL ?? null
  }
];

const ASSET_BUCKET = process.env.ASSET_STORAGE_BUCKET ?? "assets-glb";

type RequestBody = {
  image: string;
  fileName?: string;
  provider?: ProviderKey;
};

function getProvider(preferred?: ProviderKey): ProviderConfig | null {
  const pick = preferred ? PROVIDERS.find((p) => p.key === preferred) : null;
  if (pick?.apiUrl && pick.apiKey) return pick;
  return PROVIDERS.find((p) => p.apiUrl && p.apiKey) ?? null;
}

function extractValue<T = unknown>(data: unknown, path: string): T | null {
  if (!data || typeof data !== "object") return null;
  const parts = path.split(".");
  let current: any = data;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) return null;
    current = current[part];
  }
  return current as T;
}

function extractModelUrl(data: unknown): string | null {
  const candidates = [
    "model_url",
    "glb_url",
    "gltf_url",
    "output_url",
    "url",
    "result.model_url",
    "result.glb_url",
    "result.url",
    "data.model_url",
    "data.url"
  ];
  for (const path of candidates) {
    const value = extractValue<string>(data, path);
    if (value && typeof value === "string") return value;
  }
  return null;
}

function extractJobId(data: unknown): string | null {
  const candidates = ["job_id", "task_id", "id", "result.id", "data.id"];
  for (const path of candidates) {
    const value = extractValue<string>(data, path);
    if (value && typeof value === "string") return value;
  }
  return null;
}

function normalizeJobId(provider: ProviderKey, jobId: string) {
  return `${provider}:${jobId}`;
}

function parseJobId(raw: string): { provider: ProviderKey; jobId: string } | null {
  const [provider, jobId] = raw.split(":");
  if ((provider === "triposr" || provider === "meshy") && jobId) {
    return { provider, jobId };
  }
  return null;
}

async function fetchProviderResult(provider: ProviderConfig, jobId: string) {
  const statusUrl = provider.statusUrl;
  if (!statusUrl) {
    return { status: "processing" as const };
  }
  const resolvedUrl = statusUrl.includes("{id}") ? statusUrl.replace("{id}", jobId) : `${statusUrl.replace(/\/$/, "")}/${jobId}`;
  const response = await fetch(resolvedUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });
  const data = await response.json().catch(() => null);
  const modelUrl = extractModelUrl(data);
  if (!modelUrl) {
    return { status: "processing" as const };
  }
  return { status: "complete" as const, modelUrl, raw: data };
}

async function storeGeneratedAsset(
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string,
  buffer: ArrayBuffer,
  fileName: string,
  provider: ProviderConfig
) {
  const assetId = crypto.randomUUID();
  const safeName = fileName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-_\.]/g, "");
  const path = `${userId}/generated/${assetId}-${safeName || "asset"}.glb`;
  const uploadResult = await supabase.storage.from(ASSET_BUCKET).upload(path, buffer, {
    contentType: "model/gltf-binary",
    upsert: true
  });
  if (uploadResult.error) {
    throw new Error(uploadResult.error.message);
  }

  const publicUrl = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path).data.publicUrl;

  const insertResult = await supabase.from("assets").insert({
    id: assetId,
    owner_id: userId,
    name: fileName || `${provider.label} Asset`,
    description: `Generated via ${provider.label}`,
    category: "custom",
    tags: ["generated"],
    glb_path: path,
    meta: {
      schemaVersion: 1,
      unit: "m",
      extra: {
        provider: provider.key
      }
    },
    is_public: false
  });

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  return {
    assetId,
    assetUrl: publicUrl,
    label: fileName || `${provider.label} Asset`,
    description: `Generated via ${provider.label}`,
    category: "Custom"
  };
}

function createSupabaseClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase env not configured.");
  }

  const cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];

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

  return { supabase, cookiesToSet };
}

export async function POST(request: NextRequest) {
  let payload: RequestBody;
  try {
    payload = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload.image || typeof payload.image !== "string") {
    return NextResponse.json({ error: "Missing image payload." }, { status: 400 });
  }

  const provider = getProvider(payload.provider);
  if (!provider) {
    return NextResponse.json({ error: "No asset provider configured." }, { status: 400 });
  }

  const { supabase } = createSupabaseClient(request);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const response = await fetch(provider.apiUrl!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image: payload.image,
      output: "glb"
    })
  });

  const data = await response.json().catch(() => null);
  const modelUrl = extractModelUrl(data);
  if (modelUrl) {
    const glbResponse = await fetch(modelUrl, { cache: "no-store" });
    if (!glbResponse.ok) {
      return NextResponse.json({ error: "Failed to download generated asset." }, { status: 502 });
    }
    const buffer = await glbResponse.arrayBuffer();
    const asset = await storeGeneratedAsset(
      supabase,
      userData.user.id,
      buffer,
      payload.fileName ?? "generated-asset",
      provider
    );
    return NextResponse.json({ status: "complete", asset }, { status: 200 });
  }

  const jobId = extractJobId(data);
  if (!jobId) {
    return NextResponse.json({ error: "Provider did not return a model URL." }, { status: 502 });
  }

  return NextResponse.json(
    {
      status: "processing",
      jobId: normalizeJobId(provider.key, jobId),
      provider: provider.key
    },
    { status: 202 }
  );
}

export async function GET(request: NextRequest) {
  const jobIdParam = request.nextUrl.searchParams.get("jobId");
  if (!jobIdParam) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }
  const parsed = parseJobId(jobIdParam);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid jobId format." }, { status: 400 });
  }

  const provider = PROVIDERS.find((item) => item.key === parsed.provider);
  if (!provider?.apiUrl || !provider.apiKey) {
    return NextResponse.json({ error: "Provider not configured." }, { status: 400 });
  }

  const { supabase } = createSupabaseClient(request);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await fetchProviderResult(provider, parsed.jobId);
  if (result.status !== "complete") {
    return NextResponse.json({ status: "processing" }, { status: 202 });
  }

  const glbResponse = await fetch(result.modelUrl, { cache: "no-store" });
  if (!glbResponse.ok) {
    return NextResponse.json({ error: "Failed to download generated asset." }, { status: 502 });
  }
  const buffer = await glbResponse.arrayBuffer();
  const asset = await storeGeneratedAsset(
    supabase,
    userData.user.id,
    buffer,
    "generated-asset",
    provider
  );
  return NextResponse.json({ status: "complete", asset }, { status: 200 });
}
