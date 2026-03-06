import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import {
  ensureProjectOwnership,
  getFloorplanResultForOwner,
  registerFloorplanAndEnqueue
} from "../services/floorplan-service";
import { ApiError } from "../services/errors";
import { supabaseService } from "../services/supabase";

const UploadUrlRequestSchema = z.object({
  projectId: z.string().uuid(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive().optional()
});

const RegisterFloorplanSchema = z.object({
  objectPath: z.string().min(1),
  originalFileName: z.string().min(1),
  mimeType: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase();
}

export const floorplansRouter = Router();

floorplansRouter.post("/floorplans/upload-url", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const payload = UploadUrlRequestSchema.parse(request.body);
    const project = await ensureProjectOwnership(ownerId, payload.projectId);
    if (!project) throw new ApiError(404, "Project not found.");

    const objectPath = `${ownerId}/${payload.projectId}/${crypto.randomUUID()}-${sanitizeFileName(payload.fileName) || "floorplan.png"}`;
    const upload = await supabaseService.storage.from(env.FLOORPLAN_UPLOAD_BUCKET).createSignedUploadUrl(objectPath);
    if (upload.error || !upload.data?.signedUrl) {
      throw upload.error ?? new Error("Failed to create signed upload URL.");
    }

    response.status(200).json({
      objectPath,
      signedUploadUrl: upload.data.signedUrl,
      expiresAt: null
    });
  } catch (error) {
    next(error);
  }
});

floorplansRouter.post("/projects/:projectId/floorplans", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const payload = RegisterFloorplanSchema.parse(request.body);
    const result = await registerFloorplanAndEnqueue(ownerId, {
      projectId: request.params.projectId,
      objectPath: payload.objectPath,
      originalFileName: payload.originalFileName,
      mimeType: payload.mimeType,
      width: payload.width,
      height: payload.height
    });

    if (!result) throw new ApiError(404, "Project not found.");

    response.status(201).json({
      floorplanId: result.floorplan.id,
      jobId: result.job.id,
      floorplanStatus: result.floorplan.status,
      jobStatus: result.job.status
    });
  } catch (error) {
    next(error);
  }
});

floorplansRouter.get("/floorplans/:floorplanId/result", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const result = await getFloorplanResultForOwner(ownerId, request.params.floorplanId);
    if (!result) throw new ApiError(404, "Floorplan not found.");
    if (!result.result) throw new ApiError(404, "Floorplan result is not ready yet.");

    response.status(200).json({
      floorplanId: result.result.floorplan_id,
      wallCoordinates: result.result.wall_coordinates ?? [],
      roomPolygons: result.result.room_polygons ?? [],
      scale: result.result.scale,
      sceneJson: (result.result.scene_json ?? {}) as Record<string, unknown>,
      diagnostics: (result.result.diagnostics ?? {}) as Record<string, unknown>
    });
  } catch (error) {
    next(error);
  }
});
