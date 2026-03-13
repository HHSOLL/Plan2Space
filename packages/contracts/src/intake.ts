import { z } from "zod";
import { CatalogSearchCandidateSchema } from "./catalog";

export const IntakeInputKindSchema = z.enum(["upload", "catalog_search", "remediation"]);
export const IntakeSessionStatusSchema = z.enum([
  "created",
  "uploading",
  "resolving",
  "disambiguation_required",
  "queued",
  "analyzing",
  "review_required",
  "resolved_reuse",
  "resolved_generated",
  "finalizing",
  "failed",
  "expired"
]);

export const IntakeSessionSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  inputKind: IntakeInputKindSchema,
  status: IntakeSessionStatusSchema,
  version: z.number().int(),
  declaredApartmentName: z.string().nullable().optional(),
  declaredTypeName: z.string().nullable().optional(),
  declaredRegion: z.string().nullable().optional(),
  fileName: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  objectPath: z.string().nullable().optional(),
  fileSha256: z.string().nullable().optional(),
  filePhash: z.string().nullable().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  selectedLayoutRevisionId: z.string().uuid().nullable().optional(),
  generatedFloorplanId: z.string().uuid().nullable().optional(),
  finalizedProjectId: z.string().uuid().nullable().optional(),
  resolutionPayload: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  expires_at: z.string().optional()
});

export const CreateIntakeSessionRequestSchema = z.object({
  inputKind: IntakeInputKindSchema.default("upload"),
  apartmentName: z.string().trim().min(1).optional(),
  typeName: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  remediationProjectId: z.string().uuid().optional()
});

export const IntakeUploadUrlRequestSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive().optional()
});

export const IntakeUploadUrlResponseSchema = z.object({
  objectPath: z.string(),
  signedUploadUrl: z.string(),
  expiresAt: z.string().nullable().optional()
});

export const ResolveIntakeSessionRequestSchema = z.object({
  apartmentName: z.string().trim().min(1).optional(),
  typeName: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fileSha256: z.string().min(1).optional(),
  filePhash: z.string().min(1).optional()
});

export const ReusedIntakeResolutionSchema = z.object({
  resolution: z.literal("reused"),
  layoutRevisionId: z.string().uuid(),
  layoutVariantId: z.string().uuid().nullable().optional(),
  matchSource: z.string(),
  confidence: z.number(),
  session: IntakeSessionSchema
});

export const QueuedIntakeResolutionSchema = z.object({
  resolution: z.literal("queued"),
  floorplanId: z.string().uuid(),
  jobId: z.string().uuid(),
  session: IntakeSessionSchema
});

export const DisambiguationRequiredIntakeResolutionSchema = z.object({
  resolution: z.literal("disambiguation_required"),
  candidates: z.array(CatalogSearchCandidateSchema),
  session: IntakeSessionSchema
});

export const FailedIntakeResolutionSchema = z.object({
  resolution: z.literal("failed"),
  errorCode: z.string(),
  details: z.string(),
  session: IntakeSessionSchema
});

export const IntakeResolutionSchema = z.union([
  ReusedIntakeResolutionSchema,
  QueuedIntakeResolutionSchema,
  DisambiguationRequiredIntakeResolutionSchema,
  FailedIntakeResolutionSchema
]);

export const SelectIntakeCandidateRequestSchema = z.object({
  layoutRevisionId: z.string().uuid()
});

export const FinalizeIntakeProjectRequestSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable().optional()
});

export type IntakeSessionDto = z.infer<typeof IntakeSessionSchema>;
export type IntakeResolutionDto = z.infer<typeof IntakeResolutionSchema>;
export type CreateIntakeSessionRequestDto = z.infer<typeof CreateIntakeSessionRequestSchema>;
export type FinalizeIntakeProjectRequestDto = z.infer<typeof FinalizeIntakeProjectRequestSchema>;
