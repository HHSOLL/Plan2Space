import { z } from "zod";

export const CatalogSearchCandidateSchema = z.object({
  housingComplexId: z.string().uuid().nullable().optional(),
  layoutFamilyId: z.string().uuid().nullable().optional(),
  layoutVariantId: z.string().uuid().nullable().optional(),
  layoutRevisionId: z.string().uuid().nullable().optional(),
  apartmentName: z.string(),
  typeName: z.string(),
  region: z.string().nullable().optional(),
  areaLabel: z.string().nullable().optional(),
  variantLabel: z.string().nullable().optional(),
  previewImagePath: z.string().nullable().optional(),
  verified: z.boolean(),
  matchScore: z.number(),
  matchReasons: z.array(z.string()).default([])
});

export const CatalogSearchResponseSchema = z.object({
  items: z.array(CatalogSearchCandidateSchema)
});

export type CatalogSearchCandidateDto = z.infer<typeof CatalogSearchCandidateSchema>;
export type CatalogSearchResponseDto = z.infer<typeof CatalogSearchResponseSchema>;
