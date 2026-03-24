import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

type ProviderCheck = {
  name: string;
  configured: boolean;
  details: string;
};

type Options = {
  strictCommercialization: boolean;
};

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = line.slice(idx + 1).trim();
  }
}

function parseArgs(argv: string[]): Options {
  const value = argv.find((entry) => entry.startsWith("--strictCommercialization="));
  const strictCommercialization = value ? !["0", "false", "no"].includes(value.split("=")[1]?.toLowerCase() ?? "") : false;
  return { strictCommercialization };
}

function envValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

function configuredByValue(name: string) {
  return envValue(name).length > 0;
}

function providerCheck(name: string, configured: boolean, details: string): ProviderCheck {
  return { name, configured, details };
}

function printCheck(check: ProviderCheck) {
  console.log(`[provider-check] ${check.name} configured=${check.configured ? "yes" : "no"} ${check.details}`);
}

function main() {
  loadEnvFile(path.join(WORKSPACE_ROOT, ".env"));
  loadEnvFile(path.join(WORKSPACE_ROOT, ".env.local"));

  const options = parseArgs(process.argv.slice(2));
  const providerOrder = (envValue("FLOORPLAN_PROVIDER_ORDER") || "anthropic,openai,snaptrude")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const preprocessProfiles = (envValue("FLOORPLAN_PREPROCESS_PROFILES") || "balanced,lineart,filled_plan")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const checks: ProviderCheck[] = [
    providerCheck("anthropic", configuredByValue("ANTHROPIC_API_KEY"), "env=ANTHROPIC_API_KEY"),
    providerCheck("openai", configuredByValue("OPENAI_API_KEY"), "env=OPENAI_API_KEY"),
    providerCheck(
      "snaptrude",
      configuredByValue("SNAPTRUDE_API_URL"),
      `env=SNAPTRUDE_API_URL${configuredByValue("SNAPTRUDE_API_KEY") ? "+SNAPTRUDE_API_KEY" : ""}`
    ),
    providerCheck(
      "paddleocr",
      configuredByValue("PADDLEOCR_API_URL"),
      `env=PADDLEOCR_API_URL rec=${envValue("PADDLEOCR_REC_MODEL") || "korean_PP-OCRv5_mobile_rec"}`
    ),
    providerCheck(
      "roboflow_cubicasa2",
      configuredByValue("ROBOFLOW_CUBICASA2_URL"),
      `env=ROBOFLOW_CUBICASA2_URL${configuredByValue("ROBOFLOW_API_KEY") ? "+ROBOFLOW_API_KEY" : ""}`
    ),
    providerCheck(
      "roboflow_cubicasa3",
      configuredByValue("ROBOFLOW_CUBICASA3_URL"),
      `env=ROBOFLOW_CUBICASA3_URL${configuredByValue("ROBOFLOW_API_KEY") ? "+ROBOFLOW_API_KEY" : ""}`
    ),
    providerCheck(
      "hf_dedicated",
      configuredByValue("HF_FLOORPLAN_ENDPOINT_URL"),
      `env=HF_FLOORPLAN_ENDPOINT_URL${configuredByValue("HF_FLOORPLAN_ENDPOINT_TOKEN") ? "+HF_FLOORPLAN_ENDPOINT_TOKEN" : ""}`
    )
  ];

  checks.forEach(printCheck);
  console.log(`[provider-check] providerOrder=${providerOrder.join(",")}`);
  console.log(`[provider-check] preprocessProfiles=${preprocessProfiles.join(",")}`);

  const configuredCore = checks.filter((check) => ["anthropic", "openai", "snaptrude"].includes(check.name) && check.configured);
  const configuredStructure = checks.filter(
    (check) => ["roboflow_cubicasa2", "roboflow_cubicasa3", "hf_dedicated"].includes(check.name) && check.configured
  );
  const paddleConfigured = checks.some((check) => check.name === "paddleocr" && check.configured);
  const orderGaps = providerOrder.filter((provider) => !checks.some((check) => check.name === provider && check.configured));

  const issues: string[] = [];
  const warnings: string[] = [];

  if (configuredCore.length === 0) {
    warnings.push("No built-in VLM provider is configured. Configure ANTHROPIC_API_KEY, OPENAI_API_KEY, or SNAPTRUDE_API_URL.");
  }
  if (!paddleConfigured) {
    warnings.push("PaddleOCR lane is not configured. Commercial room/dimension OCR baseline will be unavailable.");
  }
  if (configuredStructure.length === 0) {
    warnings.push("No external structure parser is configured. Roboflow CubiCasa / HF Dedicated baseline will be unavailable.");
  }
  if (orderGaps.length > 0) {
    warnings.push(`Configured provider order references missing providers: ${orderGaps.join(", ")}`);
  }

  if (options.strictCommercialization) {
    if (!paddleConfigured) {
      issues.push("strict commercialization requires PaddleOCR.");
    }
    if (!checks.some((check) => check.name === "roboflow_cubicasa2" && check.configured) &&
        !checks.some((check) => check.name === "roboflow_cubicasa3" && check.configured)) {
      issues.push("strict commercialization requires at least one Roboflow CubiCasa endpoint.");
    }
    if (!checks.some((check) => check.name === "hf_dedicated" && check.configured)) {
      issues.push("strict commercialization requires HF Dedicated Endpoint.");
    }
  }

  warnings.forEach((warning) => {
    console.log(`[provider-check][warn] ${warning}`);
  });

  if (issues.length > 0) {
    issues.forEach((issue) => {
      console.error(`[provider-check][fail] ${issue}`);
    });
    process.exitCode = 1;
    return;
  }

  console.log("[provider-check] PASS");
}

main();
