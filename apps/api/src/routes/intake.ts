import { Router } from "express";
import { z } from "zod";
import {
  approveGeneratedIntakeForOwner,
  createIntakeSessionForOwner,
  finalizeProjectFromIntake,
  getIntakeJobForOwner,
  getIntakeSessionForOwner,
  issueUploadUrlForIntakeSession,
  resolveIntakeSessionForOwner,
  selectIntakeCandidateForOwner
} from "../services/intake-service";
import { ApiError } from "../services/errors";
import { toJobResponse } from "../services/job-service";

const CreateIntakeSessionSchema = z.object({
  inputKind: z.enum(["upload", "catalog_search", "remediation"]).default("upload"),
  apartmentName: z.string().trim().min(1).optional(),
  typeName: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  remediationProjectId: z.string().uuid().optional()
});

const IntakeUploadUrlRequestSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive().optional()
});

const ResolveIntakeSessionSchema = z.object({
  apartmentName: z.string().trim().min(1).optional(),
  typeName: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fileSha256: z.string().min(1).optional(),
  filePhash: z.string().min(1).optional()
});

const SelectCandidateSchema = z.object({
  layoutRevisionId: z.string().uuid()
});

const FinalizeProjectSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable().optional()
});

export const intakeRouter = Router();

intakeRouter.post("/intake-sessions", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const payload = CreateIntakeSessionSchema.parse(request.body);
    const session = await createIntakeSessionForOwner(ownerId, payload);
    response.status(201).json({ session });
  } catch (error) {
    next(error);
  }
});

intakeRouter.get("/intake-sessions/:intakeSessionId", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const session = await getIntakeSessionForOwner(ownerId, request.params.intakeSessionId);
    if (!session) throw new ApiError(404, "Intake session not found.");

    const job = await getIntakeJobForOwner(ownerId, request.params.intakeSessionId);
    response.status(200).json({
      session,
      job: job ? toJobResponse(job) : null
    });
  } catch (error) {
    next(error);
  }
});

intakeRouter.post("/intake-sessions/:intakeSessionId/upload-url", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const payload = IntakeUploadUrlRequestSchema.parse(request.body);
    const upload = await issueUploadUrlForIntakeSession(ownerId, request.params.intakeSessionId, payload);
    if (!upload) throw new ApiError(404, "Intake session not found.");

    response.status(200).json(upload);
  } catch (error) {
    next(error);
  }
});

intakeRouter.post("/intake-sessions/:intakeSessionId/resolve", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const payload = ResolveIntakeSessionSchema.parse(request.body);
    const result = await resolveIntakeSessionForOwner(ownerId, request.params.intakeSessionId, payload);
    if (!result) throw new ApiError(404, "Intake session not found.");

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

intakeRouter.post("/intake-sessions/:intakeSessionId/select-candidate", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const payload = SelectCandidateSchema.parse(request.body);
    const session = await selectIntakeCandidateForOwner(ownerId, request.params.intakeSessionId, payload.layoutRevisionId);
    if (!session) throw new ApiError(404, "Intake session not found.");

    response.status(200).json({ session });
  } catch (error) {
    next(error);
  }
});

intakeRouter.post("/intake-sessions/:intakeSessionId/review-complete", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const session = await approveGeneratedIntakeForOwner(ownerId, request.params.intakeSessionId);
    if (!session) throw new ApiError(404, "Intake session not found.");

    response.status(200).json({ session });
  } catch (error) {
    next(error);
  }
});

intakeRouter.post("/intake-sessions/:intakeSessionId/finalize-project", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const payload = FinalizeProjectSchema.parse(request.body);
    const project = await finalizeProjectFromIntake(ownerId, request.params.intakeSessionId, payload);
    if (!project) throw new ApiError(404, "Intake session not found.");

    response.status(200).json({ project });
  } catch (error) {
    next(error);
  }
});
