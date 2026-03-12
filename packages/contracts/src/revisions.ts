import { z } from "zod";

export const LayoutRevisionScopeSchema = z.enum(["canonical", "candidate", "private_generated"]);
export const VerificationStatusSchema = z.enum(["unverified", "verified", "rejected", "blocked"]);
export const GeometryEntityTypeSchema = z.enum(["wall", "opening", "room", "scale", "entrance"]);
export const GeometryPatchActionSchema = z.enum(["add", "update", "delete", "split", "merge", "override"]);

export const LayoutRevisionSchema = z.object({
  id: z.string().uuid(),
  scope: LayoutRevisionScopeSchema,
  verificationStatus: VerificationStatusSchema,
  layoutVariantId: z.string().uuid().nullable().optional(),
  createdFromIntakeSessionId: z.string().uuid().nullable().optional(),
  parentRevisionId: z.string().uuid().nullable().optional(),
  supersedesRevisionId: z.string().uuid().nullable().optional(),
  promotedFromRevisionId: z.string().uuid().nullable().optional(),
  demotedFromRevisionId: z.string().uuid().nullable().optional(),
  topologyHash: z.string().nullable().optional(),
  roomGraphHash: z.string().nullable().optional(),
  geometryHash: z.string(),
  geometrySchemaVersion: z.number().int(),
  repairEngineVersion: z.string().nullable().optional(),
  sceneBuilderVersion: z.string().nullable().optional(),
  geometryJson: z.record(z.string(), z.unknown()),
  derivedSceneJson: z.record(z.string(), z.unknown()).optional(),
  derivedNavJson: z.record(z.string(), z.unknown()).optional(),
  derivedCameraJson: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const GeometryPatchOperationSchema = z.object({
  op: GeometryPatchActionSchema,
  entityType: GeometryEntityTypeSchema,
  entityId: z.string(),
  payload: z.record(z.string(), z.unknown()).default({})
});

export const GeometryPatchSchema = z.object({
  baseRevisionId: z.string().uuid(),
  baseGeometryHash: z.string(),
  targetSchemaVersion: z.number().int().positive(),
  operations: z.array(GeometryPatchOperationSchema).min(1)
});

export type LayoutRevisionDto = z.infer<typeof LayoutRevisionSchema>;
export type GeometryPatchDto = z.infer<typeof GeometryPatchSchema>;
