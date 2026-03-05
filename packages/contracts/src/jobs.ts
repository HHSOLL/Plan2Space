import { z } from "zod";

export const JobStatusSchema = z.enum([
  "queued",
  "running",
  "retrying",
  "succeeded",
  "failed",
  "dead_letter"
]);

export const JobSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  floorplanId: z.string().uuid().nullable().optional(),
  status: JobStatusSchema,
  attempts: z.number().int(),
  maxAttempts: z.number().int().optional(),
  progress: z.number().int().min(0).max(100).default(0),
  errorCode: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  recoverable: z.boolean().optional(),
  providerErrors: z.array(z.string()).optional(),
  providerStatus: z
    .array(
      z.object({
        provider: z.string(),
        configured: z.boolean(),
        status: z.enum(["enabled", "skipped"]),
        reason: z.string().nullable()
      })
    )
    .optional(),
  details: z.string().nullable().optional(),
  floorplan_id: z.string().uuid().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const RetryJobResponseSchema = z.object({
  id: z.string().uuid(),
  status: JobStatusSchema
});

export type JobDto = z.infer<typeof JobSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
