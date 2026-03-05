import { executeProviders } from "../pipeline/provider-executor";
import { normalizeAndValidateTopology } from "../pipeline/normalize-validate";
import { buildGeometry } from "../pipeline/geometry-builder";
import { buildSceneJson } from "../pipeline/scene-builder";
import {
  markJobDeadLetter,
  markJobFailed,
  markJobRetrying,
  markJobSucceeded,
  type JobRow
} from "../repositories/jobs-repo";
import { getFloorplanById, updateFloorplanStatus } from "../repositories/floorplans-repo";
import { upsertFloorplanResult } from "../repositories/results-repo";
import { env } from "../config/env";
import { supabaseService } from "../services/supabase";

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

    const sceneJson = buildSceneJson(topology);

    await upsertFloorplanResult({
      floorplanId: payload.floorplanId,
      wallCoordinates: geometry.wallCoordinates,
      roomPolygons: geometry.roomPolygons,
      scale: geometry.scale,
      sceneJson,
      diagnostics: {
        providerStatus: topology.providerStatus,
        providerErrors: topology.providerErrors,
        selectedScore: topology.selectedScore,
        selection: topology.selection,
        candidates: topology.candidates ?? []
      }
    });

    await updateFloorplanStatus(payload.floorplanId, "succeeded");
    await markJobSucceeded(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (job.attempts >= job.max_attempts) {
      await markJobDeadLetter(job.id, message);
      await updateFloorplanStatus(payload.floorplanId, "failed", {
        errorCode: "MAX_RETRIES_EXCEEDED",
        error: message
      });
      return;
    }

    await markJobRetrying(job.id, job.attempts);
    await updateFloorplanStatus(payload.floorplanId, "retrying", {
      errorCode: "RETRY_SCHEDULED",
      error: message
    });
  }
}
