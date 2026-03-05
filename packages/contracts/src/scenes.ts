import { z } from "zod";
import { ProjectSchema } from "./projects";
import { FloorplanResultSchema } from "./floorplans";

export const SceneLatestResponseSchema = z.object({
  project: ProjectSchema,
  floorplan: z
    .object({
      id: z.string().uuid(),
      status: z.string(),
      object_path: z.string().nullable().optional(),
      created_at: z.string().optional()
    })
    .nullable(),
  result: FloorplanResultSchema.nullable(),
  latestVersion: z.record(z.string(), z.unknown()).nullable().optional()
});

export type SceneLatestResponseDto = z.infer<typeof SceneLatestResponseSchema>;
