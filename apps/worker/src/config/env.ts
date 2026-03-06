import { z } from "zod";

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  FLOORPLAN_UPLOAD_BUCKET: z.string().default("floor-plans"),
  WORKER_CONCURRENCY: z.coerce.number().default(2),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(1000)
});

export const env = EnvSchema.parse(process.env);
