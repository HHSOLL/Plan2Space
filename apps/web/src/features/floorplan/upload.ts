"use client";

import { backendFetch } from "../../lib/backend/client";

export type UploadUrlResponse = {
  objectPath: string;
  signedUploadUrl: string;
  expiresAt?: string | null;
};

export type JobStatusResponse = {
  id: string;
  type: string;
  floorplanId?: string | null;
  status: "queued" | "running" | "retrying" | "succeeded" | "failed" | "dead_letter";
  attempts: number;
  progress: number;
  errorCode?: string | null;
  error?: string | null;
  recoverable?: boolean;
  providerErrors?: string[];
  providerStatus?: Array<{ provider: string; configured: boolean; status: "enabled" | "skipped"; reason: string | null }>;
  details?: string | null;
};

export type IntakeSessionResponse = {
  id: string;
  ownerId: string;
  inputKind: "upload" | "catalog_search" | "remediation";
  status:
    | "created"
    | "uploading"
    | "resolving"
    | "disambiguation_required"
    | "queued"
    | "analyzing"
    | "review_required"
    | "resolved_reuse"
    | "resolved_generated"
    | "finalizing"
    | "failed"
    | "expired";
  version: number;
  declaredApartmentName?: string | null;
  declaredTypeName?: string | null;
  declaredRegion?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  objectPath?: string | null;
  fileSha256?: string | null;
  filePhash?: string | null;
  width?: number | null;
  height?: number | null;
  selectedLayoutRevisionId?: string | null;
  generatedFloorplanId?: string | null;
  finalizedProjectId?: string | null;
  resolutionPayload?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  expires_at?: string;
};

export type CatalogCandidate = {
  housingComplexId?: string | null;
  layoutFamilyId?: string | null;
  layoutVariantId?: string | null;
  layoutRevisionId?: string | null;
  apartmentName: string;
  typeName: string;
  region?: string | null;
  areaLabel?: string | null;
  variantLabel?: string | null;
  previewImagePath?: string | null;
  verified: boolean;
  matchScore: number;
  matchReasons: string[];
};

export type IntakeResolutionResponse =
  | {
      resolution: "reused";
      layoutRevisionId: string;
      layoutVariantId?: string | null;
      matchSource: string;
      confidence: number;
      session: IntakeSessionResponse;
    }
  | {
      resolution: "queued";
      floorplanId: string;
      jobId: string;
      session: IntakeSessionResponse;
    }
  | {
      resolution: "disambiguation_required";
      candidates: CatalogCandidate[];
      session: IntakeSessionResponse;
    }
  | {
      resolution: "failed";
      errorCode: string;
      details: string;
      session: IntakeSessionResponse;
    };

export type LayoutRevisionResponse = {
  id: string;
  scope: "canonical" | "candidate" | "private_generated";
  verification_status: "unverified" | "verified" | "rejected" | "blocked";
  layout_variant_id?: string | null;
  created_from_intake_session_id?: string | null;
  geometry_hash: string;
  topology_hash?: string | null;
  room_graph_hash?: string | null;
  geometry_json: Record<string, unknown>;
  derived_scene_json?: Record<string, unknown>;
  derived_nav_json?: Record<string, unknown>;
  derived_camera_json?: Record<string, unknown>;
  geometry_schema_version: number;
  repair_engine_version?: string | null;
  scene_builder_version?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type FloorplanResultResponse = {
  floorplanId: string;
  wallCoordinates: Array<{
    id?: string;
    start?: [number, number];
    end?: [number, number];
    thickness?: number;
    type?: "exterior" | "interior" | "balcony" | "column";
    length?: number;
    confidence?: number;
  }>;
  roomPolygons: Array<{
    id?: string;
    polygon?: Array<[number, number]>;
    type?: string;
  }>;
  scale: number;
  sceneJson?: Record<string, unknown>;
  diagnostics?: Record<string, unknown>;
};

type LatestSceneResponse = {
  project: Record<string, unknown>;
  floorplan: Record<string, unknown> | null;
  result: FloorplanResultResponse | null;
  latestVersion?: Record<string, unknown> | null;
};

export type IntakeOutcome =
  | {
      kind: "reused";
      session: IntakeSessionResponse;
      layoutRevisionId: string;
      layoutVariantId?: string | null;
      matchSource: string;
      confidence: number;
    }
  | {
      kind: "generated";
      session: IntakeSessionResponse;
      floorplanId: string;
      reviewRequired: boolean;
      job: JobStatusResponse;
      result: FloorplanResultResponse;
    }
  | {
      kind: "disambiguation_required";
      session: IntakeSessionResponse;
      candidates: CatalogCandidate[];
    };

async function computeFileSha256(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function getImageDimensions(file: File) {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

export async function uploadFloorplanFile(signedUploadUrl: string, file: File, mimeType: string) {
  const response = await fetch(signedUploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "x-upsert": "true"
    },
    body: file
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to upload floorplan file (${response.status}): ${details}`);
  }
}

export async function fetchFloorplanResult(floorplanId: string) {
  return backendFetch<FloorplanResultResponse>(`/v1/floorplans/${floorplanId}/result`);
}

export async function fetchLatestProjectScene(projectId: string) {
  return backendFetch<LatestSceneResponse>(`/v1/projects/${projectId}/scene/latest`);
}

export async function createIntakeSession(payload: {
  inputKind?: "upload" | "catalog_search" | "remediation";
  apartmentName?: string;
  typeName?: string;
  region?: string;
  remediationProjectId?: string;
}) {
  const response = await backendFetch<{ session: IntakeSessionResponse }>("/v1/intake-sessions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return response.session;
}

export async function fetchIntakeSession(intakeSessionId: string) {
  return backendFetch<{ session: IntakeSessionResponse; job: JobStatusResponse | null }>(`/v1/intake-sessions/${intakeSessionId}`);
}

export async function requestIntakeUploadUrl(intakeSessionId: string, payload: {
  fileName: string;
  mimeType: string;
  size?: number;
}) {
  return backendFetch<UploadUrlResponse>(`/v1/intake-sessions/${intakeSessionId}/upload-url`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function resolveIntakeSession(intakeSessionId: string, payload: {
  apartmentName?: string;
  typeName?: string;
  region?: string;
  width?: number;
  height?: number;
  fileSha256?: string;
  filePhash?: string;
}) {
  return backendFetch<IntakeResolutionResponse>(`/v1/intake-sessions/${intakeSessionId}/resolve`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function selectIntakeCandidate(intakeSessionId: string, layoutRevisionId: string) {
  const response = await backendFetch<{ session: IntakeSessionResponse }>(
    `/v1/intake-sessions/${intakeSessionId}/select-candidate`,
    {
      method: "POST",
      body: JSON.stringify({ layoutRevisionId })
    }
  );
  return response.session;
}

export async function completeIntakeReview(intakeSessionId: string) {
  const response = await backendFetch<{ session: IntakeSessionResponse }>(
    `/v1/intake-sessions/${intakeSessionId}/review-complete`,
    {
      method: "POST"
    }
  );
  return response.session;
}

export async function finalizeIntakeProject(intakeSessionId: string, payload: {
  name: string;
  description?: string | null;
}) {
  const response = await backendFetch<{ project: Record<string, unknown> }>(
    `/v1/intake-sessions/${intakeSessionId}/finalize-project`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
  return response.project;
}

export async function fetchLayoutRevision(layoutRevisionId: string) {
  const response = await backendFetch<{ revision: LayoutRevisionResponse }>(`/v1/layout-revisions/${layoutRevisionId}`);
  return response.revision;
}

export async function searchCatalogCandidates(payload: {
  apartmentName: string;
  typeName: string;
  region?: string;
}) {
  const params = new URLSearchParams({
    apartmentName: payload.apartmentName,
    typeName: payload.typeName
  });
  if (payload.region?.trim()) {
    params.set("region", payload.region.trim());
  }
  const response = await backendFetch<{ items: CatalogCandidate[] }>(`/v1/catalog/search?${params.toString()}`);
  return response.items;
}

export async function markProjectReuseInvalidated(projectId: string) {
  return backendFetch<{ project: Record<string, unknown>; remediationSession: IntakeSessionResponse }>(
    `/v1/projects/${projectId}/reuse-invalidated`,
    {
      method: "POST"
    }
  );
}

export async function runUploadIntakeFlow(payload: {
  file: File;
  apartmentName?: string;
  typeName?: string;
  region?: string;
  inputKind?: "upload" | "remediation";
  remediationProjectId?: string;
  pollJobUntilTerminal: (jobId: string, options?: { intervalMs?: number; timeoutMs?: number }) => Promise<JobStatusResponse>;
}) {
  const mimeType = payload.file.type || "image/png";
  const session = await createIntakeSession({
    inputKind: payload.inputKind ?? "upload",
    apartmentName: payload.apartmentName?.trim() || undefined,
    typeName: payload.typeName?.trim() || undefined,
    region: payload.region?.trim() || undefined,
    remediationProjectId: payload.remediationProjectId
  });

  const upload = await requestIntakeUploadUrl(session.id, {
    fileName: payload.file.name || "floorplan.png",
    mimeType,
    size: payload.file.size
  });

  await uploadFloorplanFile(upload.signedUploadUrl, payload.file, mimeType);

  const [dimensions, fileSha256] = await Promise.all([
    getImageDimensions(payload.file),
    computeFileSha256(payload.file)
  ]);

  const resolution = await resolveIntakeSession(session.id, {
    apartmentName: payload.apartmentName?.trim() || undefined,
    typeName: payload.typeName?.trim() || undefined,
    region: payload.region?.trim() || undefined,
    width: dimensions.width,
    height: dimensions.height,
    fileSha256
  });

  if (resolution.resolution === "reused") {
    return {
      kind: "reused" as const,
      session: resolution.session,
      layoutRevisionId: resolution.layoutRevisionId,
      layoutVariantId: resolution.layoutVariantId ?? null,
      matchSource: resolution.matchSource,
      confidence: resolution.confidence
    };
  }

  if (resolution.resolution === "disambiguation_required") {
    return {
      kind: "disambiguation_required" as const,
      session: resolution.session,
      candidates: resolution.candidates
    };
  }

  if (resolution.resolution === "failed") {
    const error = new Error(resolution.details) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = 422;
    error.payload = {
      recoverable: false,
      errorCode: resolution.errorCode,
      details: resolution.details
    };
    throw error;
  }

  const job = await payload.pollJobUntilTerminal(resolution.jobId, {
    intervalMs: 1200,
    timeoutMs: 300000
  });

  if (job.status !== "succeeded") {
    const error = new Error(job.details || job.error || "AI analysis failed.") as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = 422;
    error.payload = {
      recoverable: true,
      errorCode: job.errorCode,
      details: job.details || job.error || "AI analysis failed.",
      providerErrors: job.providerErrors ?? [],
      providerStatus: job.providerStatus ?? []
    };
    throw error;
  }

  const latest = await fetchIntakeSession(session.id);
  const floorplanId = latest.session.generatedFloorplanId || resolution.floorplanId || job.floorplanId;
  if (!floorplanId) {
    throw new Error("Generated floorplan id missing from intake session.");
  }

  const result = await fetchFloorplanResult(floorplanId);
  return {
    kind: "generated" as const,
    session: latest.session,
    floorplanId,
    reviewRequired: latest.session.status === "review_required",
    job,
    result
  };
}

export async function runCatalogIntakeFlow(payload: {
  apartmentName: string;
  typeName: string;
  region?: string;
  inputKind?: "catalog_search" | "remediation";
  remediationProjectId?: string;
}) {
  const session = await createIntakeSession({
    inputKind: payload.inputKind ?? "catalog_search",
    apartmentName: payload.apartmentName.trim(),
    typeName: payload.typeName.trim(),
    region: payload.region?.trim() || undefined,
    remediationProjectId: payload.remediationProjectId
  });

  const resolution = await resolveIntakeSession(session.id, {
    apartmentName: payload.apartmentName.trim(),
    typeName: payload.typeName.trim(),
    region: payload.region?.trim() || undefined
  });

  if (resolution.resolution === "reused") {
    return {
      kind: "reused" as const,
      session: resolution.session,
      layoutRevisionId: resolution.layoutRevisionId,
      layoutVariantId: resolution.layoutVariantId ?? null,
      matchSource: resolution.matchSource,
      confidence: resolution.confidence
    };
  }

  if (resolution.resolution === "disambiguation_required") {
    return {
      kind: "disambiguation_required" as const,
      session: resolution.session,
      candidates: resolution.candidates
    };
  }

  const error = new Error(
    resolution.resolution === "failed"
      ? resolution.details
      : "Catalog resolution did not produce a reusable layout."
  ) as Error & { status?: number; payload?: unknown };
  error.status = 422;
  error.payload =
    resolution.resolution === "failed"
      ? {
          recoverable: false,
          errorCode: resolution.errorCode,
          details: resolution.details
        }
      : {
          recoverable: false,
          errorCode: "CATALOG_REUSE_NOT_AVAILABLE",
          details: "Catalog search did not find a reusable verified revision."
        };
  throw error;
}
