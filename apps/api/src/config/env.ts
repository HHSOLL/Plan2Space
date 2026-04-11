import { z } from "zod";

const BooleanFlagSchema = z.enum(["true", "false"]).default("false");

const EnvSchema = z.object({
  PORT: z.coerce.number().optional(),
  API_PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CORS_ORIGINS: z.string().default("http://127.0.0.1:3100,http://localhost:3100"),
  FLOORPLAN_UPLOAD_BUCKET: z.string().default("floor-plans"),
  ENABLE_LIGHTWEIGHT_API_ROUTES: BooleanFlagSchema,
  ENABLE_LEGACY_API_ROUTES: BooleanFlagSchema
});

const parsedEnv = EnvSchema.parse(process.env);
const isProduction = (process.env.NODE_ENV ?? "").toLowerCase() === "production";

if (isProduction && parsedEnv.ENABLE_LIGHTWEIGHT_API_ROUTES === "true") {
  throw new Error(
    "ENABLE_LIGHTWEIGHT_API_ROUTES must remain false in production; active web /api/v1/* is canonical."
  );
}

export const env = {
  ...parsedEnv,
  API_PORT: parsedEnv.PORT ?? parsedEnv.API_PORT,
  ENABLE_LIGHTWEIGHT_API_ROUTES: parsedEnv.ENABLE_LIGHTWEIGHT_API_ROUTES === "true",
  ENABLE_LEGACY_API_ROUTES: parsedEnv.ENABLE_LEGACY_API_ROUTES === "true"
};

export type CorsOriginRule = {
  raw: string;
  regex?: RegExp;
};

export function normalizeOriginValue(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildCorsOriginRule(origin: string): CorsOriginRule {
  const raw = normalizeOriginValue(origin);
  if (!raw.includes("*")) {
    return { raw };
  }

  const regex = new RegExp(
    `^${raw.split("*").map((segment) => escapeRegex(segment)).join(".*")}$`
  );
  return { raw, regex };
}

export function parseCorsOriginRules(origins: string) {
  return origins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(buildCorsOriginRule);
}

export const corsOriginRules = parseCorsOriginRules(env.CORS_ORIGINS);

export function isCorsOriginAllowed(origin: string | undefined, rules = corsOriginRules) {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOriginValue(origin);
  return rules.some((rule) => {
    if (rule.regex) {
      return rule.regex.test(normalizedOrigin);
    }
    return rule.raw === normalizedOrigin;
  });
}
