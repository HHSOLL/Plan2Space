import { Router } from "express";
import { ApiError } from "../services/errors";
import { getJobForOwner, retryJobForOwner } from "../services/floorplan-service";
import { toJobResponse } from "../services/job-service";

export const jobsRouter = Router();

jobsRouter.get("/jobs/:jobId", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const job = await getJobForOwner(ownerId, request.params.jobId);
    if (!job) throw new ApiError(404, "Job not found.");

    response.status(200).json(toJobResponse(job));
  } catch (error) {
    next(error);
  }
});

jobsRouter.post("/jobs/:jobId/retry", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const retried = await retryJobForOwner(ownerId, request.params.jobId);
    if (!retried) throw new ApiError(404, "Job not found.");

    response.status(200).json({
      id: retried.id,
      status: retried.status
    });
  } catch (error) {
    next(error);
  }
});
