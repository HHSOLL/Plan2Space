import { env } from "../config/env";
import { searchCatalogCandidates, findVerifiedRevisionBySha256, getCatalogCandidateByRevisionId } from "../repositories/catalog-repo";
import { createFloorplan } from "../repositories/floorplans-repo";
import {
  createIntakeSession,
  finalizeIntakeSessionForOwner,
  getIntakeSessionByOwner,
  updateIntakeSessionByOwner
} from "../repositories/intake-sessions-repo";
import { createFloorplanJob, createMatchEvent, getJobByIdForOwner } from "../repositories/jobs-repo";
import { getLayoutRevisionVisibleToOwner } from "../repositories/revisions-repo";
import { upsertSourceAssetForUpload, updateSourceAssetChecksumsByStoragePath } from "../repositories/source-assets-repo";
import { ApiError } from "./errors";
import { supabaseService } from "./supabase";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase();
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function createIntakeSessionForOwner(ownerId: string, payload: {
  inputKind: "upload" | "catalog_search" | "remediation";
  apartmentName?: string;
  typeName?: string;
  region?: string;
  remediationProjectId?: string;
}) {
  return createIntakeSession(ownerId, payload);
}

export async function getIntakeSessionForOwner(ownerId: string, intakeSessionId: string) {
  return getIntakeSessionByOwner(intakeSessionId, ownerId);
}

export async function issueUploadUrlForIntakeSession(ownerId: string, intakeSessionId: string, payload: {
  fileName: string;
  mimeType: string;
}) {
  const session = await getIntakeSessionByOwner(intakeSessionId, ownerId);
  if (!session) return null;

  const objectPath = `${ownerId}/intake/${intakeSessionId}/${crypto.randomUUID()}-${sanitizeFileName(payload.fileName) || "floorplan.png"}`;
  const upload = await supabaseService.storage.from(env.FLOORPLAN_UPLOAD_BUCKET).createSignedUploadUrl(objectPath);
  if (upload.error || !upload.data?.signedUrl) {
    throw upload.error ?? new Error("Failed to create signed upload URL.");
  }

  await updateIntakeSessionByOwner(intakeSessionId, ownerId, {
    status: "uploading",
    file_name: payload.fileName,
    mime_type: payload.mimeType,
    object_path: objectPath,
    version: session.version + 1
  });

  await upsertSourceAssetForUpload(ownerId, {
    storageBucket: env.FLOORPLAN_UPLOAD_BUCKET,
    storagePath: objectPath,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    intakeSessionId
  });

  return {
    objectPath,
    signedUploadUrl: upload.data.signedUrl,
    expiresAt: null
  };
}

async function resolveFromExactChecksum(session: Awaited<ReturnType<typeof getIntakeSessionByOwner>>, checksumSha256?: string | null) {
  if (!session || !checksumSha256) return null;
  return findVerifiedRevisionBySha256(checksumSha256);
}

async function resolveFromCatalogLookup(session: Awaited<ReturnType<typeof getIntakeSessionByOwner>>, payload: {
  apartmentName?: string;
  typeName?: string;
  region?: string;
}) {
  if (!session) return [];

  const apartmentName = payload.apartmentName ?? session.declaredApartmentName ?? undefined;
  const typeName = payload.typeName ?? session.declaredTypeName ?? undefined;
  const region = payload.region ?? session.declaredRegion ?? undefined;

  if (!normalizeSearchText(apartmentName) || !normalizeSearchText(typeName)) {
    return [];
  }

  return searchCatalogCandidates({
    apartmentName,
    typeName,
    region,
    limit: 5
  });
}

export async function resolveIntakeSessionForOwner(ownerId: string, intakeSessionId: string, payload: {
  apartmentName?: string;
  typeName?: string;
  region?: string;
  width?: number;
  height?: number;
  fileSha256?: string;
  filePhash?: string;
}) {
  const session = await getIntakeSessionByOwner(intakeSessionId, ownerId);
  if (!session) return null;

  const nextApartmentName = payload.apartmentName ?? session.declaredApartmentName ?? undefined;
  const nextTypeName = payload.typeName ?? session.declaredTypeName ?? undefined;
  const nextRegion = payload.region ?? session.declaredRegion ?? undefined;
  const nextWidth = payload.width ?? session.width ?? undefined;
  const nextHeight = payload.height ?? session.height ?? undefined;
  const nextFileSha256 = payload.fileSha256 ?? session.fileSha256 ?? undefined;
  const nextFilePhash = payload.filePhash ?? session.filePhash ?? undefined;

  const resolvingSession = await updateIntakeSessionByOwner(intakeSessionId, ownerId, {
    status: "resolving",
    declared_apartment_name: nextApartmentName ?? null,
    declared_type_name: nextTypeName ?? null,
    declared_region: nextRegion ?? null,
    width: nextWidth ?? null,
    height: nextHeight ?? null,
    file_sha256: nextFileSha256 ?? null,
    file_phash: nextFilePhash ?? null,
    version: session.version + 1
  });
  if (!resolvingSession) return null;

  if (resolvingSession.objectPath) {
    await updateSourceAssetChecksumsByStoragePath({
      ownerId,
      storageBucket: env.FLOORPLAN_UPLOAD_BUCKET,
      storagePath: resolvingSession.objectPath,
      checksumSha256: nextFileSha256,
      mimeType: resolvingSession.mimeType ?? undefined,
      width: nextWidth,
      height: nextHeight
    });
  }

  const exactMatch = await resolveFromExactChecksum(resolvingSession, nextFileSha256);
  if (exactMatch?.layoutRevisionId) {
    const updated = await updateIntakeSessionByOwner(intakeSessionId, ownerId, {
      status: "resolved_reuse",
      selected_layout_revision_id: exactMatch.layoutRevisionId,
      resolution_payload: {
        resolution: "reused",
        matchSource: "sha256_exact",
        confidence: 1
      },
      version: resolvingSession.version + 1
    });
    if (!updated) return null;

    await createMatchEvent({
      intakeSessionId,
      candidateRevisionId: exactMatch.layoutRevisionId,
      candidateVariantId: exactMatch.layoutVariantId ?? null,
      decision: "auto_reuse",
      confidence: 1,
      signals: {
        matchSource: "sha256_exact"
      }
    });

    return {
      resolution: "reused" as const,
      layoutRevisionId: exactMatch.layoutRevisionId,
      layoutVariantId: exactMatch.layoutVariantId ?? null,
      matchSource: "sha256_exact",
      confidence: 1,
      session: updated
    };
  }

  const catalogCandidates = await resolveFromCatalogLookup(resolvingSession, {
    apartmentName: nextApartmentName,
    typeName: nextTypeName,
    region: nextRegion
  });

  if (catalogCandidates.length === 1 && catalogCandidates[0]?.layoutRevisionId) {
    const matched = catalogCandidates[0];
    const updated = await updateIntakeSessionByOwner(intakeSessionId, ownerId, {
      status: "resolved_reuse",
      selected_layout_revision_id: matched.layoutRevisionId,
      resolution_payload: {
        resolution: "reused",
        matchSource: "catalog_exact",
        confidence: matched.matchScore
      },
      version: resolvingSession.version + 1
    });
    if (!updated) return null;

    await createMatchEvent({
      intakeSessionId,
      candidateRevisionId: matched.layoutRevisionId ?? null,
      candidateVariantId: matched.layoutVariantId ?? null,
      decision: "auto_reuse",
      confidence: matched.matchScore,
      signals: {
        matchSource: "catalog_exact"
      }
    });

    return {
      resolution: "reused" as const,
      layoutRevisionId: matched.layoutRevisionId!,
      layoutVariantId: matched.layoutVariantId ?? null,
      matchSource: "catalog_exact",
      confidence: matched.matchScore,
      session: updated
    };
  }

  if (catalogCandidates.length > 1) {
    const updated = await updateIntakeSessionByOwner(intakeSessionId, ownerId, {
      status: "disambiguation_required",
      resolution_payload: {
        resolution: "disambiguation_required",
        candidateRevisionIds: catalogCandidates.map((candidate) => candidate.layoutRevisionId).filter(Boolean)
      },
      version: resolvingSession.version + 1
    });
    if (!updated) return null;

    await createMatchEvent({
      intakeSessionId,
      decision: "disambiguation_required",
      confidence: catalogCandidates[0]?.matchScore ?? null,
      signals: {
        reason: "multiple_catalog_candidates",
        candidateCount: catalogCandidates.length
      }
    });

    return {
      resolution: "disambiguation_required" as const,
      candidates: catalogCandidates,
      session: updated
    };
  }

  if (!resolvingSession.objectPath || !resolvingSession.mimeType || !resolvingSession.fileName) {
    const updated = await updateIntakeSessionByOwner(intakeSessionId, ownerId, {
      status: "failed",
      resolution_payload: {
        resolution: "failed",
        errorCode: "INTAKE_INPUT_INCOMPLETE",
        details: "Upload asset or catalog selection is required before resolution."
      },
      version: resolvingSession.version + 1
    });
    if (!updated) return null;

    await createMatchEvent({
      intakeSessionId,
      decision: "failed",
      signals: {
        errorCode: "INTAKE_INPUT_INCOMPLETE"
      }
    });

    return {
      resolution: "failed" as const,
      errorCode: "INTAKE_INPUT_INCOMPLETE",
      details: "Upload asset or catalog selection is required before resolution.",
      session: updated
    };
  }

  const floorplan = await createFloorplan({
    intakeSessionId,
    objectPath: resolvingSession.objectPath,
    originalFileName: resolvingSession.fileName,
    mimeType: resolvingSession.mimeType,
    width: resolvingSession.width ?? undefined,
    height: resolvingSession.height ?? undefined,
    status: "queued"
  });

  const job = await createFloorplanJob({
    floorplanId: floorplan.id,
    intakeSessionId,
    objectPath: resolvingSession.objectPath,
    mimeType: resolvingSession.mimeType,
    width: resolvingSession.width ?? undefined,
    height: resolvingSession.height ?? undefined
  });

  const updated = await updateIntakeSessionByOwner(intakeSessionId, ownerId, {
    status: "queued",
    generated_floorplan_id: floorplan.id,
    resolution_payload: {
      resolution: "queued",
      jobId: job.id
    },
    version: resolvingSession.version + 1
  });
  if (!updated) return null;

  await createMatchEvent({
    intakeSessionId,
    decision: "queued",
    signals: {
      reason: "analysis_required",
      floorplanId: floorplan.id,
      jobId: job.id
    }
  });

  return {
    resolution: "queued" as const,
    floorplanId: floorplan.id,
    jobId: job.id,
    session: updated
  };
}

export async function selectIntakeCandidateForOwner(ownerId: string, intakeSessionId: string, layoutRevisionId: string) {
  const session = await getIntakeSessionByOwner(intakeSessionId, ownerId);
  if (!session) return null;
  if (session.status !== "disambiguation_required") {
    throw new ApiError(409, "Intake session is not waiting for candidate selection.");
  }

  const revision = await getLayoutRevisionVisibleToOwner(layoutRevisionId, ownerId);
  if (!revision) {
    throw new ApiError(404, "Layout revision not found.");
  }

  const candidate = await getCatalogCandidateByRevisionId(layoutRevisionId);
  const updated = await updateIntakeSessionByOwner(intakeSessionId, ownerId, {
    status: "resolved_reuse",
    selected_layout_revision_id: layoutRevisionId,
    resolution_payload: {
      resolution: "reused",
      matchSource: "manual_select",
      confidence: candidate?.matchScore ?? 1
    },
    version: session.version + 1
  });
  if (!updated) return null;

  await createMatchEvent({
    intakeSessionId,
    candidateRevisionId: layoutRevisionId,
    candidateVariantId: candidate?.layoutVariantId ?? revision.layout_variant_id ?? null,
    decision: "manual_select",
    confidence: candidate?.matchScore ?? 1,
    signals: {
      matchSource: "manual_select"
    }
  });

  return updated;
}

export async function approveGeneratedIntakeForOwner(ownerId: string, intakeSessionId: string) {
  const session = await getIntakeSessionByOwner(intakeSessionId, ownerId);
  if (!session) return null;
  if (session.status !== "review_required") {
    throw new ApiError(409, "Intake session is not awaiting review.");
  }
  if (!session.selectedLayoutRevisionId) {
    throw new ApiError(409, "Generated layout revision is missing.");
  }

  return updateIntakeSessionByOwner(intakeSessionId, ownerId, {
    status: "resolved_generated",
    version: session.version + 1
  });
}

export async function finalizeProjectFromIntake(ownerId: string, intakeSessionId: string, payload: {
  name: string;
  description?: string | null;
}) {
  const session = await getIntakeSessionByOwner(intakeSessionId, ownerId);
  if (!session) return null;

  if (!["resolved_reuse", "resolved_generated", "finalizing"].includes(session.status)) {
    throw new ApiError(409, "Intake session is not ready to finalize.");
  }

  let finalizing = session;
  if (session.status !== "finalizing") {
    const updated = await updateIntakeSessionByOwner(intakeSessionId, ownerId, {
      status: "finalizing",
      version: session.version + 1
    });
    if (!updated) return null;
    finalizing = updated;
  }

  const project = await finalizeIntakeSessionForOwner(intakeSessionId, ownerId, payload);
  if (!project) return null;

  const restoredStatus = project.resolution_state === "reused" ? "resolved_reuse" : "resolved_generated";

  await updateIntakeSessionByOwner(intakeSessionId, ownerId, {
    finalized_project_id: project.id,
    status: restoredStatus,
    version: finalizing.version + 1
  });

  return project;
}

export async function getIntakeJobForOwner(ownerId: string, intakeSessionId: string) {
  const session = await getIntakeSessionByOwner(intakeSessionId, ownerId);
  if (!session) return null;
  const jobId = typeof session.resolutionPayload?.jobId === "string" ? session.resolutionPayload.jobId : null;
  if (!jobId) return null;
  return getJobByIdForOwner(jobId, ownerId);
}
