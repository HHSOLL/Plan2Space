import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().optional(),
  API_PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CORS_ORIGINS: z.string().default("http://127.0.0.1:3100,http://localhost:3100"),
  FLOORPLAN_UPLOAD_BUCKET: z.string().default("floor-plans")
});

const parsedEnv = EnvSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  API_PORT: parsedEnv.PORT ?? parsedEnv.API_PORT
};

type CorsOriginRule = {
  raw: string;
  regex?: RegExp;
};

function normalizeOriginValue(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildCorsOriginRule(origin: string): CorsOriginRule {
  const raw = normalizeOriginValue(origin);
  if (!raw.includes("*")) {
    return { raw };
  }

  const regex = new RegExp(
    `^${raw.split("*").map((segment) => escapeRegex(segment)).join(".*")}$`
  );
  return { raw, regex };
}

export const corsOriginRules = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map(buildCorsOriginRule);

export function isCorsOriginAllowed(origin?: string) {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOriginValue(origin);
  return corsOriginRules.some((rule) => {
    if (rule.regex) {
      return rule.regex.test(normalizedOrigin);
    }
    return rule.raw === normalizedOrigin;
  });
}
