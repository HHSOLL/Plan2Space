import crypto from "node:crypto";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Vec2 = [number, number];

type FixtureManifestEntry = {
  channel?: string;
  sourcePolicy?: "partner_licensed" | "user_opt_in" | "manual_private" | "unknown";
  apartmentName?: string;
  typeName?: string;
  region?: string;
  notes?: string;
  qualityTags?: string[];
  complexityTier?: "simple" | "moderate" | "complex" | "korean_complex";
  gold?: {
    rooms?: Array<{
      roomType: string;
      label?: string;
      centroid?: Vec2;
      polygon?: Vec2[];
    }>;
    dimensions?: Array<{
      mmValue?: number;
      text?: string;
    }>;
    scale?: {
      metersPerPixel: number;
    };
    text?: Array<{ text: string }>;
    reviewSeconds?: number;
    expectedReviewRequired?: boolean;
  };
};

type FixtureSummary = {
  fixture: string;
  channel: string | null;
  sourcePolicy: string | null;
  qualityTags: string[];
  complexityTier: string | null;
  status: number;
  sessionStatus: string | null;
  selectedProvider: string | null;
  selectedPassId: string | null;
  selectedPreprocessProfile: string | null;
  sourceModule: string | null;
  selectedScore: number | null;
  wallCount: number;
  openingCount: number;
  scale: number | null;
  scaleSource: string | null;
  scaleConfidence: number | null;
  recoverable: boolean;
  reviewRequired: boolean;
  expectedReviewRequired: boolean | null;
  reviewMatch: boolean | null;
  conflictScore: number | null;
  roomTypeF1: number | null;
  dimensionValueAccuracy: number | null;
  scaleAgreement: number | null;
  correctionSeconds: number | null;
  hasGoldRooms: boolean;
  hasGoldDimensions: boolean;
  hasGoldScale: boolean;
  hasReviewExpectation: boolean;
  details: string | null;
};

type CandidateDebug = {
  provider: string;
  passId?: string;
  preprocessProfile?: string;
  score?: number;
  scoreBreakdown?: {
    topologyScore?: number;
    openingScore?: number;
    scaleScore?: number;
    semanticScore?: number;
    conflictPenalty?: number;
    penalty?: number;
    total?: number;
  };
  metrics?: {
    wallCount?: number;
    openingCount?: number;
    axisAlignedRatio?: number;
    orphanWallCount?: number;
    selfIntersectionCount?: number;
    openingsAttachedRatio?: number;
    wallThicknessOutlierRate?: number;
    openingOverlapCount?: number;
    openingOutOfWallRangeCount?: number;
    exteriorAreaSanity?: boolean;
    openingTypeConfidenceMean?: number;
    loopCountPenalty?: number;
    scaleConfidence?: number;
    scaleEvidenceCompleteness?: number;
    scaleSource?: string;
    exteriorDetected?: boolean;
    exteriorLoopClosed?: boolean;
    entranceDetected?: boolean;
    roomHintCount?: number;
    labeledRoomHintCount?: number;
    dimensionAnnotationCount?: number;
    dimensionConflict?: number;
    scaleConflict?: number;
  };
  errors?: string[];
  timingMs?: number;
};

type RawFixtureResult = {
  fixture: string;
  status: number;
  sessionStatus: string | null;
  result: Record<string, unknown> | null;
  revision: Record<string, unknown> | null;
  diagnostics: Record<string, unknown> | null;
};

type Options = {
  apiUrl: string;
  fixturesDir: string;
  manifestPath: string;
  outputDir: string;
  debug: boolean;
  keepArtifacts: boolean;
};

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function getMimeType(fileName: string) {
  const lowered = fileName.toLowerCase();
  if (lowered.endsWith(".png")) return "image/png";
  if (lowered.endsWith(".jpg") || lowered.endsWith(".jpeg")) return "image/jpeg";
  if (lowered.endsWith(".webp")) return "image/webp";
  if (lowered.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

async function readFixtureMetadata(fileBuffer: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") {
    return { width: null, height: null };
  }

  try {
    const metadata = await sharp(fileBuffer).metadata();
    return {
      width: metadata.width ?? null,
      height: metadata.height ?? null
    };
  } catch {
    return { width: null, height: null };
  }
}

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
    fixturesDir: values.get("fixtures")
      ? path.resolve(values.get("fixtures")!)
      : path.join(WORKSPACE_ROOT, "fixtures/floorplans"),
    manifestPath: values.get("manifest")
      ? path.resolve(values.get("manifest")!)
      : path.join(
          values.get("fixtures") ? path.resolve(values.get("fixtures")!) : path.join(WORKSPACE_ROOT, "fixtures/floorplans"),
          "manifest.json"
        ),
    outputDir: values.get("out")
      ? path.resolve(values.get("out")!)
      : path.join(WORKSPACE_ROOT, ".eval/floorplan"),
    debug: !["false", "0"].includes((values.get("debug") ?? "true").toLowerCase()),
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
    process.env[key] = line.slice(idx + 1).trim();
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

function toCsvRow(columns: Array<string | number | boolean | null | undefined>) {
  return columns
    .map((value) => {
      const text = value == null ? "" : String(value);
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replace(/"/g, "\"\"")}"`;
      }
      return text;
    })
    .join(",");
}

async function loadFixtureManifest(manifestPath: string) {
  const raw = await fsp.readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as { fixtures?: Record<string, FixtureManifestEntry> };
  if (!parsed.fixtures || Object.keys(parsed.fixtures).length === 0) {
    throw new Error(`Fixture manifest is empty: ${manifestPath}`);
  }
  return parsed.fixtures;
}

async function cleanupFixtureArtifacts(params: {
  admin: SupabaseClient<any>;
  intakeSessionId: string | null;
  userId: string;
  uploadBucket: string;
}) {
  const { admin, intakeSessionId, userId, uploadBucket } = params;
  if (!intakeSessionId) return;

  let generatedFloorplanId: string | null = null;
  let revisionId: string | null = null;
  let objectPath: string | null = null;

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

  if (revisionId) {
    await admin.from("revision_source_links").delete().eq("revision_id", revisionId);
    await admin.from("layout_revisions").delete().eq("id", revisionId);
  }

  if (generatedFloorplanId) {
    await admin.from("floorplan_results").delete().eq("floorplan_id", generatedFloorplanId);
    await admin.from("jobs").delete().eq("floorplan_id", generatedFloorplanId);
    await admin.from("floorplans").delete().eq("id", generatedFloorplanId);
  }

  await admin.from("floorplan_match_events").delete().eq("intake_session_id", intakeSessionId);
  await admin.from("intake_sessions").delete().eq("id", intakeSessionId);

  if (objectPath) {
    await admin.storage.from(uploadBucket).remove([objectPath]);
    await admin.from("source_assets").delete().eq("storage_path", objectPath);
  } else {
    await admin.from("source_assets").delete().eq("owner_id", userId);
  }
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function computeRoomTypeF1(
  goldRooms: FixtureManifestEntry["gold"] extends infer T ? T extends { rooms?: infer R } ? R : never : never,
  predictedRooms: Array<Record<string, unknown>>
) {
  if (!goldRooms || goldRooms.length === 0) return null;
  const goldCounts = new Map<string, number>();
  const predictedCounts = new Map<string, number>();

  goldRooms.forEach((room) => {
    if (!room?.roomType) return;
    goldCounts.set(room.roomType, (goldCounts.get(room.roomType) ?? 0) + 1);
  });
  predictedRooms.forEach((room) => {
    const roomType = typeof room.roomType === "string" ? room.roomType : null;
    if (!roomType) return;
    predictedCounts.set(roomType, (predictedCounts.get(roomType) ?? 0) + 1);
  });

  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const [roomType, goldCount] of goldCounts.entries()) {
    const predictedCount = predictedCounts.get(roomType) ?? 0;
    tp += Math.min(goldCount, predictedCount);
    fn += Math.max(0, goldCount - predictedCount);
  }
  for (const [roomType, predictedCount] of predictedCounts.entries()) {
    const goldCount = goldCounts.get(roomType) ?? 0;
    fp += Math.max(0, predictedCount - goldCount);
  }

  const precision = tp / Math.max(tp + fp, 1);
  const recall = tp / Math.max(tp + fn, 1);
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function computeDimensionValueAccuracy(
  goldDimensions: FixtureManifestEntry["gold"] extends infer T ? T extends { dimensions?: infer D } ? D : never : never,
  predictedDimensions: Array<Record<string, unknown>>
) {
  if (!goldDimensions || goldDimensions.length === 0) return null;
  const predictedValues = predictedDimensions
    .map((dimension) => Number(dimension.mmValue))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (predictedValues.length === 0) return 0;

  let matches = 0;
  for (const goldDimension of goldDimensions) {
    const expected = Number(goldDimension.mmValue);
    if (!Number.isFinite(expected) || expected <= 0) continue;
    const matched = predictedValues.some((predicted) => Math.abs(predicted - expected) / expected <= 0.05);
    if (matched) matches += 1;
  }
  return matches / Math.max(goldDimensions.length, 1);
}

function computeScaleAgreement(
  gold: FixtureManifestEntry["gold"] | undefined,
  predictedScale: number | null
) {
  if (!gold?.scale?.metersPerPixel || !predictedScale || predictedScale <= 0) return null;
  const drift = Math.abs(predictedScale - gold.scale.metersPerPixel) / gold.scale.metersPerPixel;
  return clamp(1 - drift, 0, 1);
}

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

async function main() {
  loadEnvFile(path.join(WORKSPACE_ROOT, ".env.local"));

  const options = parseArgs(process.argv.slice(2));
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const uploadBucket = process.env.FLOORPLAN_UPLOAD_BUCKET ?? "floor-plans";

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const publicClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const fixtureManifest = await loadFixtureManifest(options.manifestPath);
  const entries = await fsp.readdir(options.fixturesDir, { withFileTypes: true });
  const fixtures = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(png|jpe?g)$/i.test(name))
    .sort((a, b) => a.localeCompare(b));

  if (fixtures.length === 0) {
    throw new Error(`No fixtures found in ${options.fixturesDir}`);
  }

  await fsp.mkdir(options.outputDir, { recursive: true });

  const email = `tmp-eval-${Date.now()}@example.com`;
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

  try {
    const login = await publicClient.auth.signInWithPassword({ email, password });
    if (login.error || !login.data.session) {
      throw login.error ?? new Error("Failed to sign in temp user.");
    }
    const token = login.data.session.access_token;

    const runAt = new Date().toISOString();
    const fixtureSummaries: FixtureSummary[] = [];
    const candidateRows: Array<Record<string, string | number | boolean | null>> = [];
    const rawResults: RawFixtureResult[] = [];

    for (const fixture of fixtures) {
      const fixturePath = path.join(options.fixturesDir, fixture);
      const fixtureMetadata = fixtureManifest[fixture] ?? {};
      const fileBuffer = await fsp.readFile(fixturePath);
      const mimeType = getMimeType(fixture);
      const imageMetadata = await readFixtureMetadata(fileBuffer, mimeType);
      const width = imageMetadata.width;
      const height = imageMetadata.height;
      const fileSha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");
      let intakeSessionId: string | null = null;

      try {
        const createdSession = await apiFetch<{ session: { id: string } }>(
          options.apiUrl,
          "/v1/intake-sessions",
          token,
          {
            method: "POST",
            body: JSON.stringify({
              inputKind: "upload",
              apartmentName: fixtureMetadata.apartmentName ?? "평가용 단지",
              typeName: fixtureMetadata.typeName ?? fixture.replace(/\.[^.]+$/, ""),
              region: fixtureMetadata.region ?? "서울"
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
              fileName: fixture,
              mimeType,
              size: fileBuffer.length
            })
          }
        );

        const uploadResponse = await fetch(upload.signedUploadUrl, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: fileBuffer
        });
        if (!uploadResponse.ok) {
          throw new Error(`Signed upload failed: ${uploadResponse.status}`);
        }

        const resolution = await apiFetch<{ resolution: string; session: any }>(
          options.apiUrl,
          `/v1/intake-sessions/${intakeSessionId}/resolve`,
          token,
          {
            method: "POST",
            body: JSON.stringify({
              apartmentName: fixtureMetadata.apartmentName ?? "평가용 단지",
              typeName: fixtureMetadata.typeName ?? fixture.replace(/\.[^.]+$/, ""),
              region: fixtureMetadata.region ?? "서울",
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
            const polled = await apiFetch<{ session: any }>(
              options.apiUrl,
              `/v1/intake-sessions/${intakeSessionId}`,
              token
            );
            session = polled.session;
            if (["resolved_generated", "review_required", "resolved_reuse", "failed"].includes(session.status)) {
              break;
            }
          }
        }

        const revisionId = typeof session.selectedLayoutRevisionId === "string" ? session.selectedLayoutRevisionId : null;
        const floorplanId = typeof session.generatedFloorplanId === "string" ? session.generatedFloorplanId : null;

        const revisionResponse = revisionId
          ? await apiFetch<{ revision: Record<string, unknown> }>(
              options.apiUrl,
              `/v1/layout-revisions/${revisionId}`,
              token
            )
          : null;
        const resultResponse = floorplanId
          ? await apiFetch<Record<string, unknown>>(
              options.apiUrl,
              `/v1/floorplans/${floorplanId}/result`,
              token
            ).catch(() => null)
          : null;

        const revision = revisionResponse?.revision ?? null;
        const result = resultResponse ?? null;
        const diagnostics = (result?.diagnostics as Record<string, unknown> | undefined) ?? null;
        const predictedRooms = Array.isArray((revision as any)?.geometry_json?.rooms)
          ? (((revision as any).geometry_json.rooms as Array<Record<string, unknown>>) ?? [])
          : [];
        const predictedDimensions = Array.isArray((revision as any)?.geometry_json?.evidenceRefs?.semanticAnnotations?.dimensionAnnotations)
          ? (((revision as any).geometry_json.evidenceRefs.semanticAnnotations.dimensionAnnotations as Array<Record<string, unknown>>) ?? [])
          : [];
        const selection = diagnostics?.selection as Record<string, unknown> | undefined;
        const selectedProvider = typeof selection?.selectedProvider === "string"
          ? String(selection.selectedProvider)
          : typeof diagnostics?.selectedProvider === "string"
            ? String(diagnostics.selectedProvider)
            : typeof (result?.sceneJson as any)?.source === "string"
              ? String((result?.sceneJson as any).source)
              : null;
        const reviewRequired = session.status === "review_required";
        const expectedReviewRequired = fixtureMetadata.gold?.expectedReviewRequired ?? null;
        const reviewMatch = expectedReviewRequired == null ? null : reviewRequired === expectedReviewRequired;
        const roomTypeF1 = computeRoomTypeF1(fixtureMetadata.gold?.rooms, predictedRooms);
        const dimensionValueAccuracy = computeDimensionValueAccuracy(fixtureMetadata.gold?.dimensions, predictedDimensions);
        const scale = Number((result as any)?.scale);
        const scaleAgreement = computeScaleAgreement(fixtureMetadata.gold, Number.isFinite(scale) ? scale : null);
        const conflictScore = Number((diagnostics?.conflictScore as number | undefined) ?? NaN);

        rawResults.push({
          fixture,
          status: session.status === "failed" ? 422 : 200,
          sessionStatus: session.status ?? null,
          result,
          revision,
          diagnostics
        });

        const candidates = Array.isArray(diagnostics?.candidates) ? (diagnostics?.candidates as CandidateDebug[]) : [];
        candidates.forEach((candidate) => {
          candidateRows.push({
            fixture,
            provider: candidate.provider,
            passId: candidate.passId ?? null,
            preprocessProfile: candidate.preprocessProfile ?? null,
            score: Number.isFinite(candidate.score) ? candidate.score ?? null : null,
            timingMs: Number.isFinite(candidate.timingMs) ? candidate.timingMs ?? null : null,
            wallCount: Number.isFinite(candidate.metrics?.wallCount) ? candidate.metrics?.wallCount ?? null : null,
            openingCount: Number.isFinite(candidate.metrics?.openingCount) ? candidate.metrics?.openingCount ?? null : null,
            axisAlignedRatio: Number.isFinite(candidate.metrics?.axisAlignedRatio) ? candidate.metrics?.axisAlignedRatio ?? null : null,
            openingsAttachedRatio: Number.isFinite(candidate.metrics?.openingsAttachedRatio)
              ? candidate.metrics?.openingsAttachedRatio ?? null
              : null,
            exteriorLoopClosed:
              typeof candidate.metrics?.exteriorLoopClosed === "boolean" ? candidate.metrics.exteriorLoopClosed : null,
            scaleConfidence: Number.isFinite(candidate.metrics?.scaleConfidence) ? candidate.metrics?.scaleConfidence ?? null : null,
            scaleEvidenceCompleteness: Number.isFinite(candidate.metrics?.scaleEvidenceCompleteness)
              ? candidate.metrics?.scaleEvidenceCompleteness ?? null
              : null,
            scaleSource: typeof candidate.metrics?.scaleSource === "string" ? candidate.metrics.scaleSource : null,
            roomHintCount: Number.isFinite(candidate.metrics?.roomHintCount) ? candidate.metrics?.roomHintCount ?? null : null,
            labeledRoomHintCount: Number.isFinite(candidate.metrics?.labeledRoomHintCount)
              ? candidate.metrics?.labeledRoomHintCount ?? null
              : null,
            dimensionAnnotationCount: Number.isFinite(candidate.metrics?.dimensionAnnotationCount)
              ? candidate.metrics?.dimensionAnnotationCount ?? null
              : null,
            dimensionConflict: Number.isFinite(candidate.metrics?.dimensionConflict)
              ? candidate.metrics?.dimensionConflict ?? null
              : null,
            scaleConflict: Number.isFinite(candidate.metrics?.scaleConflict) ? candidate.metrics?.scaleConflict ?? null : null,
            topologyScore: Number.isFinite(candidate.scoreBreakdown?.topologyScore)
              ? candidate.scoreBreakdown?.topologyScore ?? null
              : null,
            openingScore: Number.isFinite(candidate.scoreBreakdown?.openingScore)
              ? candidate.scoreBreakdown?.openingScore ?? null
              : null,
            scaleScore: Number.isFinite(candidate.scoreBreakdown?.scaleScore) ? candidate.scoreBreakdown?.scaleScore ?? null : null,
            semanticScore: Number.isFinite(candidate.scoreBreakdown?.semanticScore)
              ? candidate.scoreBreakdown?.semanticScore ?? null
              : null,
            conflictPenalty: Number.isFinite(candidate.scoreBreakdown?.conflictPenalty)
              ? candidate.scoreBreakdown?.conflictPenalty ?? null
              : null,
            penalty: Number.isFinite(candidate.scoreBreakdown?.penalty) ? candidate.scoreBreakdown?.penalty ?? null : null,
            errors: Array.isArray(candidate.errors) ? candidate.errors.join(" | ") : ""
          });
        });

        fixtureSummaries.push({
          fixture,
          channel: fixtureMetadata.channel ?? null,
          sourcePolicy: fixtureMetadata.sourcePolicy ?? null,
          qualityTags: fixtureMetadata.qualityTags ?? [],
          complexityTier: fixtureMetadata.complexityTier ?? null,
          status: session.status === "failed" ? 422 : 200,
          sessionStatus: session.status ?? null,
          selectedProvider,
          selectedPassId: typeof selection?.selectedPassId === "string" ? String(selection.selectedPassId) : null,
          selectedPreprocessProfile:
            typeof selection?.preprocessProfile === "string" ? String(selection.preprocessProfile) : null,
          sourceModule: typeof selection?.sourceModule === "string" ? String(selection.sourceModule) : null,
          selectedScore: Number.isFinite(Number(diagnostics?.selectedScore)) ? Number(diagnostics?.selectedScore) : null,
          wallCount: Array.isArray((result as any)?.wallCoordinates) ? (result as any).wallCoordinates.length : 0,
          openingCount: Array.isArray((revision as any)?.geometry_json?.openings) ? (revision as any).geometry_json.openings.length : 0,
          scale: Number.isFinite(scale) ? scale : null,
          scaleSource: typeof (result as any)?.sceneJson?.scaleInfo?.source === "string" ? String((result as any).sceneJson.scaleInfo.source) : null,
          scaleConfidence: Number.isFinite(Number((result as any)?.sceneJson?.scaleInfo?.confidence))
            ? Number((result as any).sceneJson.scaleInfo.confidence)
            : null,
          recoverable: session.status === "failed" || reviewRequired,
          reviewRequired,
          expectedReviewRequired,
          reviewMatch,
          conflictScore: Number.isFinite(conflictScore) ? conflictScore : null,
          roomTypeF1,
          dimensionValueAccuracy,
          scaleAgreement,
          correctionSeconds: fixtureMetadata.gold?.reviewSeconds ?? null,
          hasGoldRooms: Array.isArray(fixtureMetadata.gold?.rooms) && fixtureMetadata.gold!.rooms!.length > 0,
          hasGoldDimensions: Array.isArray(fixtureMetadata.gold?.dimensions) && fixtureMetadata.gold!.dimensions!.length > 0,
          hasGoldScale: Boolean(fixtureMetadata.gold?.scale?.metersPerPixel),
          hasReviewExpectation: typeof fixtureMetadata.gold?.expectedReviewRequired === "boolean",
          details: Array.isArray((diagnostics?.reviewReasons as unknown[]) ?? null)
            ? ((diagnostics?.reviewReasons as string[]) ?? []).join(" | ")
            : null
        });
      } finally {
        if (!options.keepArtifacts) {
          await cleanupFixtureArtifacts({
            admin,
            intakeSessionId,
            userId,
            uploadBucket
          });
        }
      }
    }

    const summaryCsvLines = [
      toCsvRow([
        "fixture",
        "channel",
        "sourcePolicy",
        "qualityTags",
        "complexityTier",
        "status",
        "sessionStatus",
        "selectedProvider",
        "selectedPassId",
        "selectedPreprocessProfile",
        "sourceModule",
        "selectedScore",
        "wallCount",
        "openingCount",
        "scale",
        "scaleSource",
        "scaleConfidence",
        "recoverable",
        "reviewRequired",
        "expectedReviewRequired",
        "reviewMatch",
        "conflictScore",
        "roomTypeF1",
        "dimensionValueAccuracy",
        "scaleAgreement",
        "correctionSeconds",
        "details"
      ]),
      ...fixtureSummaries.map((row) =>
        toCsvRow([
          row.fixture,
          row.channel,
          row.sourcePolicy,
          row.qualityTags.join("|"),
          row.complexityTier,
          row.status,
          row.sessionStatus,
          row.selectedProvider,
          row.selectedPassId,
          row.selectedPreprocessProfile,
          row.sourceModule,
          row.selectedScore,
          row.wallCount,
          row.openingCount,
          row.scale,
          row.scaleSource,
          row.scaleConfidence,
          row.recoverable,
          row.reviewRequired,
          row.expectedReviewRequired,
          row.reviewMatch,
          row.conflictScore,
          row.roomTypeF1,
          row.dimensionValueAccuracy,
          row.scaleAgreement,
          row.correctionSeconds,
          row.details
        ])
      )
    ].join("\n");

    const candidatesCsvLines = [
      toCsvRow([
        "fixture",
        "provider",
        "passId",
        "preprocessProfile",
        "score",
        "timingMs",
        "wallCount",
        "openingCount",
        "axisAlignedRatio",
        "openingsAttachedRatio",
        "exteriorLoopClosed",
        "scaleConfidence",
        "scaleEvidenceCompleteness",
        "scaleSource",
        "roomHintCount",
        "labeledRoomHintCount",
        "dimensionAnnotationCount",
        "dimensionConflict",
        "scaleConflict",
        "topologyScore",
        "openingScore",
        "scaleScore",
        "semanticScore",
        "conflictPenalty",
        "penalty",
        "errors"
      ]),
      ...candidateRows.map((row) =>
        toCsvRow([
          row.fixture,
          row.provider,
          row.passId,
          row.preprocessProfile,
          row.score,
          row.timingMs,
          row.wallCount,
          row.openingCount,
          row.axisAlignedRatio,
          row.openingsAttachedRatio,
          row.exteriorLoopClosed,
          row.scaleConfidence,
          row.scaleEvidenceCompleteness,
          row.scaleSource,
          row.roomHintCount,
          row.labeledRoomHintCount,
          row.dimensionAnnotationCount,
          row.dimensionConflict,
          row.scaleConflict,
          row.topologyScore,
          row.openingScore,
          row.scaleScore,
          row.semanticScore,
          row.conflictPenalty,
          row.penalty,
          row.errors
        ])
      )
    ].join("\n");

    const jsonOutput = {
      runAt,
      apiUrl: options.apiUrl,
      fixturesDir: options.fixturesDir,
      manifestPath: options.manifestPath,
      outputDir: options.outputDir,
      debug: options.debug,
      fixtureManifest,
      fixtureSummaries,
      candidateRows,
      rawResults
    };

    await Promise.all([
      fsp.writeFile(path.join(options.outputDir, "summary.json"), JSON.stringify(jsonOutput, null, 2), "utf8"),
      fsp.writeFile(path.join(options.outputDir, "fixtures-summary.csv"), summaryCsvLines, "utf8"),
      fsp.writeFile(path.join(options.outputDir, "candidates.csv"), candidatesCsvLines, "utf8")
    ]);

    const successCount = fixtureSummaries.filter((entry) => entry.status === 200).length;
    const recoverableCount = fixtureSummaries.filter((entry) => entry.recoverable).length;
    const koreanComplexCount = fixtureSummaries.filter((entry) => entry.complexityTier === "korean_complex").length;
    const medianCorrectionSeconds = median(
      fixtureSummaries
        .map((entry) => entry.correctionSeconds)
        .filter((value): value is number => Number.isFinite(value))
    );

    console.log(
      `[eval-floorplan] fixtures=${fixtures.length} success=${successCount} recoverable=${recoverableCount} koreanComplex=${koreanComplexCount}`
    );
    console.log(
      `[eval-floorplan] successRate=${percentage(successCount / fixtures.length)} medianCorrectionSeconds=${
        medianCorrectionSeconds == null ? "n/a" : medianCorrectionSeconds.toFixed(1)
      }`
    );
    console.log(`[eval-floorplan] outputs written to ${options.outputDir}`);
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[eval-floorplan] failed: ${message}`);
  process.exitCode = 1;
});
