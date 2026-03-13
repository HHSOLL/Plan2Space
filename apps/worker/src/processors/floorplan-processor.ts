import { executeProviders } from "../pipeline/provider-executor";
import { normalizeAndValidateTopology } from "../pipeline/normalize-validate";
import { buildGeometry } from "../pipeline/geometry-builder";
import { buildRevisionArtifacts } from "../pipeline/revision-builder";
import { buildSceneJson } from "../pipeline/scene-builder";
import {
  markJobDeadLetter,
  markJobFailed,
  markJobRetrying,
  markJobSucceeded,
  type JobRow
} from "../repositories/jobs-repo";
import { getFloorplanById, updateFloorplanStatus } from "../repositories/floorplans-repo";
import { updateIntakeSession } from "../repositories/intake-sessions-repo";
import { attachGeneratedRevisionToProjectIfMissing } from "../repositories/projects-repo";
import { createLayoutRevision, createRevisionSourceLink } from "../repositories/revisions-repo";
import { upsertFloorplanResult } from "../repositories/results-repo";
import { getSourceAssetByStoragePath } from "../repositories/source-assets-repo";
import { env } from "../config/env";
import { supabaseService } from "../services/supabase";

const REVIEW_REQUIRED_SCORE_THRESHOLD = 72;

function toDataUrl(buffer: ArrayBuffer, mimeType: string) {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function parseJobPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const floorplanId = typeof record.floorplanId === "string" ? record.floorplanId : null;
  const objectPath = typeof record.objectPath === "string" ? record.objectPath : null;
  const mimeType = typeof record.mimeType === "string" ? record.mimeType : "image/png";

  if (!floorplanId || !objectPath) return null;
  return {
    floorplanId,
    objectPath,
    mimeType
  };
}

export async function processFloorplanJob(job: JobRow) {
  const payload = parseJobPayload(job.payload);
  if (!payload) {
    await markJobDeadLetter(job.id, "Invalid job payload.", "INVALID_JOB_PAYLOAD");
    return;
  }

  try {
    const floorplan = await getFloorplanById(payload.floorplanId);
    if (!floorplan) {
      await markJobDeadLetter(job.id, "Floorplan not found.", "FLOORPLAN_NOT_FOUND");
      return;
    }

    await updateFloorplanStatus(payload.floorplanId, "running");
    if (floorplan.intake_session_id) {
      await updateIntakeSession({
        intakeSessionId: floorplan.intake_session_id,
        status: "analyzing",
        generatedFloorplanId: floorplan.id,
        resolutionPayload: {
          resolution: "queued",
          jobId: job.id
        }
      });
    }

    const downloaded = await supabaseService.storage.from(env.FLOORPLAN_UPLOAD_BUCKET).download(payload.objectPath);
    if (downloaded.error || !downloaded.data) {
      throw new Error(downloaded.error?.message ?? "Unable to download floorplan source image.");
    }

    const buffer = await downloaded.data.arrayBuffer();
    const dataUrl = toDataUrl(buffer, payload.mimeType);

    const analyzed = await executeProviders({
      base64: dataUrl,
      mimeType: payload.mimeType,
      debug: true
    });

    if (analyzed.ok === false) {
      const failure = analyzed.error;
      await updateFloorplanStatus(payload.floorplanId, "failed", {
        errorCode: failure.errorCode,
        error: failure.details
      });
      if (floorplan.intake_session_id) {
        await updateIntakeSession({
          intakeSessionId: floorplan.intake_session_id,
          status: "failed",
          generatedFloorplanId: floorplan.id,
          resolutionPayload: {
            resolution: "failed",
            errorCode: failure.errorCode,
            details: failure.details,
            providerStatus: failure.providerStatus,
            providerErrors: failure.providerErrors
          }
        });
      }

      await markJobFailed(job.id, {
        errorCode: failure.errorCode,
        error: failure.details,
        recoverable: failure.recoverable,
        providerStatus: failure.providerStatus,
        providerErrors: failure.providerErrors,
        details: failure.details
      });
      return;
    }

    const topology = normalizeAndValidateTopology(analyzed.data);
    const geometry = buildGeometry({
      walls: topology.walls,
      openings: topology.openings,
      scale: topology.metadata.scale
    });

    const sceneJson = buildSceneJson(topology, geometry);
    const revisionArtifacts = buildRevisionArtifacts(topology, geometry);
    const sourceAsset = await getSourceAssetByStoragePath(env.FLOORPLAN_UPLOAD_BUCKET, payload.objectPath);
    const layoutRevisionId = await createLayoutRevision({
      scope: "private_generated",
      verificationStatus: "unverified",
      representativeSourceAssetId: sourceAsset?.id ?? null,
      createdFromIntakeSessionId: floorplan.intake_session_id ?? null,
      geometryJson: revisionArtifacts.geometryJson,
      topologyHash: revisionArtifacts.topologyHash,
      roomGraphHash: revisionArtifacts.roomGraphHash,
      geometryHash: revisionArtifacts.geometryHash,
      geometrySchemaVersion: 1,
      repairEngineVersion: "v4-room-repair",
      sceneBuilderVersion: "scene-v2",
      derivedSceneJson: sceneJson,
      derivedNavJson: {},
      derivedCameraJson: {},
      derivedFromGeometryHash: revisionArtifacts.geometryHash,
      metadata: {
        floorplanId: payload.floorplanId,
        projectId: floorplan.project_id ?? null,
        intakeSessionId: floorplan.intake_session_id ?? null,
        selectedScore: topology.selectedScore,
        selectedProvider: topology.selectedProvider ?? null,
        selectedPassId: topology.selectedPassId ?? null
      }
    });
    if (sourceAsset?.id) {
      await createRevisionSourceLink({
        revisionId: layoutRevisionId,
        sourceAssetId: sourceAsset.id,
        linkRole: "primary",
        provenanceStatus:
          sourceAsset.provenance_status === "verified" ||
          sourceAsset.provenance_status === "withdrawn" ||
          sourceAsset.provenance_status === "blocked"
            ? sourceAsset.provenance_status
            : "unverified",
        consentBasis: sourceAsset.promotion_consent ? "user_opt_in" : "private_temp"
      });
    }

    await upsertFloorplanResult({
      floorplanId: payload.floorplanId,
      wallCoordinates: geometry.wallCoordinates,
      roomPolygons: geometry.roomPolygons,
      scale: geometry.scale,
      sceneJson,
      diagnostics: {
        layoutRevisionId,
        topologyHash: revisionArtifacts.topologyHash,
        roomGraphHash: revisionArtifacts.roomGraphHash,
        geometryHash: revisionArtifacts.geometryHash,
        providerStatus: topology.providerStatus,
        providerErrors: topology.providerErrors,
        selectedScore: topology.selectedScore,
        selection: topology.selection,
        candidates: topology.candidates ?? []
      }
    });

    if (floorplan.project_id) {
      await attachGeneratedRevisionToProjectIfMissing(floorplan.project_id, layoutRevisionId);
    }

    const requiresReview =
      Boolean(floorplan.intake_session_id) &&
      ((topology.selectedScore ?? 0) < REVIEW_REQUIRED_SCORE_THRESHOLD);

    await updateFloorplanStatus(payload.floorplanId, requiresReview ? "review_required" : "succeeded");
    if (floorplan.intake_session_id) {
      await updateIntakeSession({
        intakeSessionId: floorplan.intake_session_id,
        status: requiresReview ? "review_required" : "resolved_generated",
        selectedLayoutRevisionId: layoutRevisionId,
        generatedFloorplanId: floorplan.id,
        resolutionPayload: {
          resolution: requiresReview ? "review_required" : "resolved_generated",
          jobId: job.id,
          layoutRevisionId,
          topologyHash: revisionArtifacts.topologyHash,
          roomGraphHash: revisionArtifacts.roomGraphHash,
          geometryHash: revisionArtifacts.geometryHash,
          selectedScore: topology.selectedScore
        }
      });
    }
    await markJobSucceeded(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (job.attempts >= job.max_attempts) {
      await markJobDeadLetter(job.id, message);
      await updateFloorplanStatus(payload.floorplanId, "failed", {
        errorCode: "MAX_RETRIES_EXCEEDED",
        error: message
      });
      const floorplan = await getFloorplanById(payload.floorplanId);
      if (floorplan?.intake_session_id) {
        await updateIntakeSession({
          intakeSessionId: floorplan.intake_session_id,
          status: "failed",
          generatedFloorplanId: floorplan.id,
          resolutionPayload: {
            resolution: "failed",
            errorCode: "MAX_RETRIES_EXCEEDED",
            details: message
          }
        });
      }
      return;
    }

    await markJobRetrying(job.id, job.attempts);
    await updateFloorplanStatus(payload.floorplanId, "retrying", {
      errorCode: "RETRY_SCHEDULED",
      error: message
    });
  }
}
