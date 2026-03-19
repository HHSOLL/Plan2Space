import { executeProviders } from "../pipeline/provider-executor";
import { normalizeAndValidateTopology } from "../pipeline/normalize-validate";
import { buildGeometry } from "../pipeline/geometry-builder";
import { buildRevisionArtifacts } from "../pipeline/revision-builder";
import { buildSceneJson } from "../pipeline/scene-builder";
import { deriveScaleInfoFromDimensions, deriveScaleValueFromEvidence, scoreCandidate, type TopologyPayload, type Vec2 } from "@plan2space/floorplan-core";
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

const REVIEW_REQUIRED_SCORE_THRESHOLD = env.FLOORPLAN_REVIEW_SCORE_THRESHOLD;
const REVIEW_REQUIRED_CONFLICT_THRESHOLD = env.FLOORPLAN_REVIEW_CONFLICT_THRESHOLD;
const REVIEW_REQUIRED_DIMENSION_CONFLICT_THRESHOLD = env.FLOORPLAN_REVIEW_DIMENSION_CONFLICT_THRESHOLD;
const REVIEW_REQUIRED_SCALE_CONFLICT_THRESHOLD = env.FLOORPLAN_REVIEW_SCALE_CONFLICT_THRESHOLD;

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pointInPolygon(point: Vec2, polygon: Vec2[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [xi, yi] = polygon[index]!;
    const [xj, yj] = polygon[previous]!;
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / Math.max(yj - yi, 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function computeDimensionConflict(topology: TopologyPayload) {
  const derivedScale = deriveScaleInfoFromDimensions(topology.semanticAnnotations.dimensionAnnotations);
  if (!derivedScale) return 0;
  const drift = Math.abs(derivedScale.value - topology.metadata.scale) / Math.max(derivedScale.value, 0.000001);
  return clamp(drift, 0, 1);
}

function computeScaleConflict(topology: TopologyPayload) {
  const evidenceScale = deriveScaleValueFromEvidence(topology.metadata.scaleInfo.evidence);
  if (!evidenceScale) return 0;
  const drift = Math.abs(evidenceScale - topology.metadata.scale) / Math.max(evidenceScale, 0.000001);
  return clamp(drift, 0, 1);
}

function computeRoomHintConflict(
  topology: TopologyPayload,
  geometry: ReturnType<typeof buildGeometry>
) {
  const labeledHints = topology.semanticAnnotations.roomHints.filter((roomHint) => roomHint.roomType !== "other");
  if (labeledHints.length === 0) return 0;

  let mismatches = 0;
  for (const roomHint of labeledHints) {
    const matchedRoom = geometry.roomPolygons.find((room) => pointInPolygon(roomHint.position, room.polygon));
    if (!matchedRoom) {
      mismatches += 1;
      continue;
    }

    if (matchedRoom.roomType !== roomHint.roomType) {
      mismatches += 0.7;
    }

    if (roomHint.polygon && !pointInPolygon(matchedRoom.centroid, roomHint.polygon)) {
      mismatches += 0.3;
    }
  }

  return clamp(mismatches / labeledHints.length, 0, 1);
}

function computeOpeningTopologyConflict(topology: TopologyPayload) {
  const scored = scoreCandidate({
    walls: topology.walls,
    openings: topology.openings,
    scaleInfo: topology.metadata.scaleInfo,
    semanticAnnotations: topology.semanticAnnotations
  });
  const unattachedRatio = 1 - scored.metrics.openingsAttachedRatio;
  const loopBreak = scored.metrics.exteriorLoopClosed ? 0 : 1;
  const overlapRatio =
    scored.metrics.openingCount > 0
      ? clamp(scored.metrics.openingOverlapCount / scored.metrics.openingCount, 0, 1)
      : 0;
  const entranceConflict = topology.openings.filter((opening) => opening.isEntrance).length > 1 ? 1 : 0;

  return clamp(unattachedRatio * 0.45 + loopBreak * 0.35 + overlapRatio * 0.1 + entranceConflict * 0.1, 0, 1);
}

function buildReviewDecision(topology: TopologyPayload, geometry: ReturnType<typeof buildGeometry>) {
  const dimensionConflict = computeDimensionConflict(topology);
  const scaleConflict = computeScaleConflict(topology);
  const roomHintConflict = computeRoomHintConflict(topology, geometry);
  const openingTopologyConflict = computeOpeningTopologyConflict(topology);
  const conflictScore =
    dimensionConflict * 0.4 + scaleConflict * 0.25 + roomHintConflict * 0.2 + openingTopologyConflict * 0.15;
  const reviewReasons: string[] = [];

  if ((topology.selectedScore ?? 0) < REVIEW_REQUIRED_SCORE_THRESHOLD) {
    reviewReasons.push("selected_score_low");
  }
  if (conflictScore > REVIEW_REQUIRED_CONFLICT_THRESHOLD) {
    reviewReasons.push("conflict_score_high");
  }
  if (dimensionConflict > REVIEW_REQUIRED_DIMENSION_CONFLICT_THRESHOLD) {
    reviewReasons.push("dimension_conflict_high");
  }
  if (scaleConflict > REVIEW_REQUIRED_SCALE_CONFLICT_THRESHOLD) {
    reviewReasons.push("scale_conflict_high");
  }

  return {
    requiresReview: reviewReasons.length > 0,
    reviewReasons,
    conflictScore,
    conflictBreakdown: {
      dimensionConflict,
      scaleConflict,
      roomHintConflict,
      openingTopologyConflict
    }
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
      scale: topology.metadata.scale,
      semanticAnnotations: topology.semanticAnnotations
    });
    const reviewDecision = buildReviewDecision(topology, geometry);

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
      sceneBuilderVersion: "scene-v2-commercial",
      derivedSceneJson: sceneJson,
      derivedNavJson: revisionArtifacts.derivedNavJson,
      derivedCameraJson: revisionArtifacts.derivedCameraJson,
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
        candidates: topology.candidates ?? [],
        conflictScore: reviewDecision.conflictScore,
        reviewReasons: reviewDecision.reviewReasons,
        conflictBreakdown: reviewDecision.conflictBreakdown,
        analysisContext: (topology.metadata as Record<string, unknown>).analysisContext ?? null
      }
    });

    if (floorplan.project_id) {
      await attachGeneratedRevisionToProjectIfMissing(floorplan.project_id, layoutRevisionId);
    }

    const requiresReview = Boolean(floorplan.intake_session_id) && reviewDecision.requiresReview;

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
          selectedScore: topology.selectedScore,
          conflictScore: reviewDecision.conflictScore,
          reviewReasons: reviewDecision.reviewReasons,
          conflictBreakdown: reviewDecision.conflictBreakdown
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
