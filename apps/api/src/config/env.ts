import { z } from "zod";

const EnvSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CORS_ORIGINS: z.string().default("http://127.0.0.1:3100,http://localhost:3100"),
  FLOORPLAN_UPLOAD_BUCKET: z.string().default("floor-plans")
});

export const env = EnvSchema.parse(process.env);
export const corsOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);
