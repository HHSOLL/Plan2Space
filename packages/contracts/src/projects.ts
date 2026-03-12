import { z } from "zod";

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  source_layout_revision_id: z.string().uuid().nullable().optional(),
  resolution_state: z.enum(["reused", "generated", "reuse_invalidated"]).nullable().optional(),
  created_from_intake_session_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string()
});

export const ProjectListResponseSchema = z.object({
  items: z.array(ProjectSchema),
  nextCursor: z.string().nullable().optional(),
  total: z.number().optional()
});

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional()
});

export type ProjectDto = z.infer<typeof ProjectSchema>;
export type ProjectListResponseDto = z.infer<typeof ProjectListResponseSchema>;
export type CreateProjectRequestDto = z.infer<typeof CreateProjectRequestSchema>;
