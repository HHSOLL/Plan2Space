import { Router } from "express";
import { ApiError } from "../services/errors";
import { getLatestSceneForOwner } from "../services/floorplan-service";
import { resolveLatestVersion } from "../services/scene-service";

export const scenesRouter = Router();

scenesRouter.get("/projects/:projectId/scene/latest", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const scene = await getLatestSceneForOwner(ownerId, request.params.projectId);
    if (!scene) throw new ApiError(404, "Project not found.");

    const latestVersion = await resolveLatestVersion(request.params.projectId);

    response.status(200).json({
      ...scene,
      latestVersion: latestVersion ?? null
    });
  } catch (error) {
    next(error);
  }
});
