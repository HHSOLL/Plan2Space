import { z } from "zod";

export const ProviderStatusSchema = z.object({
  provider: z.string(),
  configured: z.boolean(),
  status: z.enum(["enabled", "skipped"]),
  reason: z.string().nullable()
});

export const UploadUrlRequestSchema = z.object({
  projectId: z.string().uuid(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive().optional()
});

export const UploadUrlResponseSchema = z.object({
  objectPath: z.string(),
  signedUploadUrl: z.string(),
  expiresAt: z.string().nullable().optional()
});

export const RegisterFloorplanRequestSchema = z.object({
  objectPath: z.string().min(1),
  originalFileName: z.string().min(1),
  mimeType: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

export const RegisterFloorplanResponseSchema = z.object({
  floorplanId: z.string().uuid(),
  jobId: z.string().uuid(),
  floorplanStatus: z.string(),
  jobStatus: z.string()
});

export const FloorplanResultSchema = z.object({
  floorplanId: z.string().uuid(),
  wallCoordinates: z.array(z.unknown()),
  roomPolygons: z.array(z.unknown()),
  scale: z.number(),
  sceneJson: z.record(z.string(), z.unknown()),
  diagnostics: z.record(z.string(), z.unknown()).optional()
});

export const RecoverableErrorSchema = z.object({
  recoverable: z.literal(true),
  errorCode: z.string(),
  details: z.string(),
  providerStatus: z.array(ProviderStatusSchema).optional(),
  providerErrors: z.array(z.string()).optional()
});

export type UploadUrlRequestDto = z.infer<typeof UploadUrlRequestSchema>;
export type UploadUrlResponseDto = z.infer<typeof UploadUrlResponseSchema>;
export type RegisterFloorplanRequestDto = z.infer<typeof RegisterFloorplanRequestSchema>;
export type RegisterFloorplanResponseDto = z.infer<typeof RegisterFloorplanResponseSchema>;
export type FloorplanResultDto = z.infer<typeof FloorplanResultSchema>;
export type ProviderStatusDto = z.infer<typeof ProviderStatusSchema>;
export type RecoverableErrorDto = z.infer<typeof RecoverableErrorSchema>;
