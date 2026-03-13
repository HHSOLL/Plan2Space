import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Options = {
  apiUrl: string;
  apartmentName: string;
  typeName: string;
  region: string;
  samplePath: string;
  keepArtifacts: boolean;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(SCRIPT_DIR, "..");

function parseArgs(argv: string[]): Options {
  const values = new Map<string, string>();
  let keepArtifacts = false;

  for (const arg of argv) {
    if (arg === "--keep-artifacts") {
      keepArtifacts = true;
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    values.set(key, rest.join("="));
  }

  const apiUrl = values.get("api") || process.env.E2E_RAILWAY_API_URL || process.env.NEXT_PUBLIC_RAILWAY_API_URL;
  if (!apiUrl) {
    throw new Error("Missing Railway API URL. Pass --api=... or set E2E_RAILWAY_API_URL / NEXT_PUBLIC_RAILWAY_API_URL.");
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ""),
    apartmentName: values.get("apartmentName") || "테스트아파트",
    typeName: values.get("typeName") || "84A",
    region: values.get("region") || "서울",
    samplePath: values.get("sample")
      ? path.resolve(values.get("sample")!)
      : path.join(WEB_ROOT, "public/assets/samples/blueprint.jpeg"),
    keepArtifacts
  };
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (process.env[key] !== undefined) continue;
    const value = line.slice(idx + 1).trim();
    process.env[key] = value;
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function apiFetch<T>(baseUrl: string, pathname: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!(init.body instanceof Buffer) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${pathname} ${response.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

async function cleanupArtifacts(params: {
  admin: SupabaseClient<any>;
  userId: string;
  intakeSessionId: string | null;
  projectId: string | null;
}) {
  const { admin, userId, intakeSessionId, projectId } = params;

  if (projectId) {
    await admin.from("projects").delete().eq("id", projectId);
  }

  let generatedFloorplanId: string | null = null;
  let revisionId: string | null = null;
  let objectPath: string | null = null;

  if (intakeSessionId) {
    const { data } = await admin
      .from("intake_sessions")
      .select("generated_floorplan_id, selected_layout_revision_id, object_path")
      .eq("id", intakeSessionId)
      .maybeSingle();

    const intake = data as
      | {
          generated_floorplan_id: string | null;
          selected_layout_revision_id: string | null;
          object_path: string | null;
        }
      | null;

    generatedFloorplanId = intake?.generated_floorplan_id ?? null;
    revisionId = intake?.selected_layout_revision_id ?? null;
    objectPath = intake?.object_path ?? null;
  }

  if (revisionId) {
    await admin.from("revision_source_links").delete().eq("revision_id", revisionId);
    await admin.from("layout_revisions").delete().eq("id", revisionId);
  }

  if (generatedFloorplanId) {
    await admin.from("floorplan_results").delete().eq("floorplan_id", generatedFloorplanId);
    await admin.from("jobs").delete().eq("floorplan_id", generatedFloorplanId);
    await admin.from("floorplans").delete().eq("id", generatedFloorplanId);
  }

  if (intakeSessionId) {
    await admin.from("floorplan_match_events").delete().eq("intake_session_id", intakeSessionId);
    await admin.from("intake_sessions").delete().eq("id", intakeSessionId);
  }

  if (objectPath) {
    await admin.storage.from("floor-plans").remove([objectPath]);
    await admin.from("source_assets").delete().eq("storage_path", objectPath);
  } else {
    await admin.from("source_assets").delete().eq("owner_id", userId);
  }

  await admin.auth.admin.deleteUser(userId);
}

async function main() {
  loadEnvFile(path.join(WEB_ROOT, ".env.local"));

  const options = parseArgs(process.argv.slice(2));
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const publicClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const fileBuffer = fs.readFileSync(options.samplePath);
  const metadata = await sharp(fileBuffer).metadata();
  const width = metadata.width ?? null;
  const height = metadata.height ?? null;
  const fileSha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  const email = `tmp-intake-${Date.now()}@example.com`;
  const password = "Passw0rd!123456";
  const createdUser = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (createdUser.error || !createdUser.data.user) {
    throw createdUser.error ?? new Error("Failed to create temp user.");
  }

  const userId = createdUser.data.user.id;
  let intakeSessionId: string | null = null;
  let projectId: string | null = null;

  try {
    const login = await publicClient.auth.signInWithPassword({ email, password });
    if (login.error || !login.data.session) {
      throw login.error ?? new Error("Failed to sign in temp user.");
    }
    const token = login.data.session.access_token;

    const createdSession = await apiFetch<{ session: { id: string } }>(
      options.apiUrl,
      "/v1/intake-sessions",
      token,
      {
        method: "POST",
        body: JSON.stringify({
          inputKind: "upload",
          apartmentName: options.apartmentName,
          typeName: options.typeName,
          region: options.region
        })
      }
    );
    intakeSessionId = createdSession.session.id;

    const upload = await apiFetch<{ signedUploadUrl: string }>(
      options.apiUrl,
      `/v1/intake-sessions/${intakeSessionId}/upload-url`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          fileName: path.basename(options.samplePath),
          mimeType: "image/jpeg",
          size: fileBuffer.length
        })
      }
    );

    const uploadResponse = await fetch(upload.signedUploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: fileBuffer
    });
    if (!uploadResponse.ok) {
      throw new Error(`Signed upload failed: ${uploadResponse.status}`);
    }

    const resolution = await apiFetch<{ resolution: string; session: any; jobId?: string }>(
      options.apiUrl,
      `/v1/intake-sessions/${intakeSessionId}/resolve`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          apartmentName: options.apartmentName,
          typeName: options.typeName,
          region: options.region,
          width,
          height,
          fileSha256
        })
      }
    );

    let session = resolution.session;

    if (resolution.resolution === "queued") {
      for (let attempt = 0; attempt < 75; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const status = await apiFetch<{ session: any }>(
          options.apiUrl,
          `/v1/intake-sessions/${intakeSessionId}`,
          token
        );
        session = status.session;
        if (["resolved_generated", "review_required", "resolved_reuse", "failed"].includes(session.status)) {
          break;
        }
      }
    }

    if (session.status === "review_required") {
      const reviewed = await apiFetch<{ session: any }>(
        options.apiUrl,
        `/v1/intake-sessions/${intakeSessionId}/review-complete`,
        token,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );
      session = reviewed.session;
    }

    if (!["resolved_generated", "resolved_reuse"].includes(session.status)) {
      throw new Error(`Unexpected final intake session status: ${session.status}`);
    }

    const revisionId = session.selectedLayoutRevisionId as string | null;
    if (!revisionId) {
      throw new Error("selectedLayoutRevisionId is missing.");
    }

    const revisionResponse = await apiFetch<{ revision: any }>(
      options.apiUrl,
      `/v1/layout-revisions/${revisionId}`,
      token
    );
    const revision = revisionResponse.revision;

    const finalized = await apiFetch<{ project: any }>(
      options.apiUrl,
      `/v1/intake-sessions/${intakeSessionId}/finalize-project`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          name: "E2E Intake Project",
          description: "Automated intake e2e"
        })
      }
    );

    projectId = finalized.project.id as string;

    const roomCount = Array.isArray(revision.geometry_json?.rooms) ? revision.geometry_json.rooms.length : 0;
    const floorCount = Array.isArray(revision.derived_scene_json?.floors) ? revision.derived_scene_json.floors.length : 0;
    const openingCount = Array.isArray(revision.geometry_json?.openings) ? revision.geometry_json.openings.length : 0;

    if (!finalized.project.source_layout_revision_id) {
      throw new Error("Finalized project is missing source_layout_revision_id.");
    }
    if (!["generated", "reused"].includes(finalized.project.resolution_state)) {
      throw new Error(`Unexpected project resolution state: ${finalized.project.resolution_state}`);
    }
    if (roomCount <= 0 || floorCount <= 0) {
      throw new Error(`Revision geometry is incomplete. roomCount=${roomCount}, floorCount=${floorCount}`);
    }

    console.log(
      JSON.stringify(
        {
          apiUrl: options.apiUrl,
          intakeSessionId,
          projectId,
          sessionStatus: session.status,
          projectResolutionState: finalized.project.resolution_state,
          revisionId: revision.id,
          roomCount,
          floorCount,
          openingCount,
          roomGraphHash: revision.room_graph_hash,
          geometryHash: revision.geometry_hash
        },
        null,
        2
      )
    );
  } finally {
    if (!options.keepArtifacts) {
      await cleanupArtifacts({
        admin,
        userId,
        intakeSessionId,
        projectId
      });
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
