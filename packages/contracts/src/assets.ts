import { z } from "zod";

export const AssetGenerationProviderSchema = z.enum(["triposr", "meshy"]);

export const AssetGenerationRequestSchema = z.object({
  image: z.string().min(1),
  fileName: z.string().min(1).optional(),
  provider: AssetGenerationProviderSchema.optional()
});

export const GeneratedAssetSchema = z.object({
  assetId: z.string().uuid(),
  assetUrl: z.string().url(),
  label: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1)
});

export const AssetGenerationEnqueueResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.literal("queued")
});

export type AssetGenerationProvider = z.infer<typeof AssetGenerationProviderSchema>;
export type AssetGenerationRequest = z.infer<typeof AssetGenerationRequestSchema>;
export type GeneratedAsset = z.infer<typeof GeneratedAssetSchema>;
export type AssetGenerationEnqueueResponse = z.infer<typeof AssetGenerationEnqueueResponseSchema>;
