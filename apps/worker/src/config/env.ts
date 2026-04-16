import { z } from "zod";

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ASSET_STORAGE_BUCKET: z.string().default("assets-glb"),
  WORKER_CONCURRENCY: z.coerce.number().default(2),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(1000),
  ASSET_GENERATION_POLL_INTERVAL_MS: z.coerce.number().default(2000),
  ASSET_GENERATION_MAX_POLLS: z.coerce.number().default(45),
  TRIPOSR_API_URL: z.string().url().optional(),
  TRIPOSR_API_KEY: z.string().min(1).optional(),
  TRIPOSR_STATUS_URL: z.string().url().optional(),
  MESHY_API_URL: z.string().url().optional(),
  MESHY_API_KEY: z.string().min(1).optional(),
  MESHY_STATUS_URL: z.string().url().optional()
});

export const env = EnvSchema.parse(process.env);
