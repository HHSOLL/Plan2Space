import { createFloorplan, getFloorplanById, getLatestSucceededFloorplan } from "../repositories/floorplans-repo";
import { getIntakeSessionByOwner } from "../repositories/intake-sessions-repo";
import { createFloorplanJob, getJobByIdForOwner, retryJob } from "../repositories/jobs-repo";
import { getProjectByOwner } from "../repositories/projects-repo";
import { getResultByFloorplanId } from "../repositories/results-repo";

export async function ensureProjectOwnership(ownerId: string, projectId: string) {
  const project = await getProjectByOwner(projectId, ownerId);
  return project;
}

export async function registerFloorplanAndEnqueue(ownerId: string, payload: {
  projectId: string;
  objectPath: string;
  originalFileName: string;
  mimeType: string;
  width?: number;
  height?: number;
}) {
  const project = await ensureProjectOwnership(ownerId, payload.projectId);
  if (!project) return null;

  const floorplan = await createFloorplan(payload);
  const job = await createFloorplanJob({
    floorplanId: floorplan.id,
    projectId: payload.projectId,
    objectPath: payload.objectPath,
    mimeType: payload.mimeType,
    width: payload.width,
    height: payload.height
  });

  return {
    floorplan,
    job
  };
}

export async function getJobForOwner(ownerId: string, jobId: string) {
  return getJobByIdForOwner(jobId, ownerId);
}

export async function retryJobForOwner(ownerId: string, jobId: string) {
  const job = await getJobByIdForOwner(jobId, ownerId);
  if (!job) return null;
  return retryJob(jobId);
}

export async function getFloorplanResultForOwner(ownerId: string, floorplanId: string) {
  const floorplan = await getFloorplanById(floorplanId);
  if (!floorplan) return null;

  if (floorplan.project_id) {
    const project = await ensureProjectOwnership(ownerId, floorplan.project_id);
    if (!project) return null;
  } else if (floorplan.intake_session_id) {
    const ownerSession = await getIntakeSessionByOwner(floorplan.intake_session_id, ownerId);
    if (!ownerSession) return null;
  } else {
    return null;
  }

  const result = await getResultByFloorplanId(floorplanId);
  if (!result) return { floorplan, result: null };

  return {
    floorplan,
    result
  };
}

export async function getLatestSceneForOwner(ownerId: string, projectId: string) {
  const project = await ensureProjectOwnership(ownerId, projectId);
  if (!project) return null;

  const floorplan = await getLatestSucceededFloorplan(projectId);
  if (!floorplan) {
    return {
      project,
      floorplan: null,
      result: null
    };
  }

  const result = await getResultByFloorplanId(floorplan.id);
  return {
    project,
    floorplan,
    result: result
      ? {
          floorplanId: result.floorplan_id,
          wallCoordinates: result.wall_coordinates ?? [],
          roomPolygons: result.room_polygons ?? [],
          scale: result.scale,
          sceneJson: (result.scene_json ?? {}) as Record<string, unknown>,
          diagnostics: (result.diagnostics ?? {}) as Record<string, unknown>
        }
      : null
  };
}
