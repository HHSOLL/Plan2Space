import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

type Vec2 = [number, number];

type FixtureManifestEntry = {
  channel?: string;
  sourcePolicy?: "partner_licensed" | "user_opt_in" | "manual_private";
  apartmentName?: string;
  typeName?: string;
  region?: string;
  notes?: string;
  qualityTags?: string[];
  complexityTier?: "simple" | "moderate" | "complex" | "korean_complex";
  gold?: {
    rooms?: Array<{
      roomType: string;
      label?: string;
      centroid?: Vec2;
      polygon?: Vec2[];
    }>;
    dimensions?: Array<{
      mmValue?: number;
      text?: string;
    }>;
    scale?: {
      metersPerPixel: number;
    };
    text?: Array<{ text: string }>;
    reviewSeconds?: number;
    expectedReviewRequired?: boolean;
  };
};

type ManifestFile = {
  fixtures?: Record<string, FixtureManifestEntry>;
};

type Options = {
  fixturesDir: string;
  manifestPath: string;
  outPath: string | null;
  strictBlindSet: boolean;
  requireFiles: boolean;
  minFixtures: number;
  minKoreanComplexShare: number;
  minPdfFixtures: number;
  minWatermarkFixtures: number;
  minPhoneOrCroppedFixtures: number;
};

const ALLOWED_SOURCE_POLICIES = new Set(["partner_licensed", "user_opt_in", "manual_private"]);
const ALLOWED_COMPLEXITY = new Set(["simple", "moderate", "complex", "korean_complex"]);
const IGNORED_FILES = new Set(["README.md", "manifest.json", "manifest.example.json", ".DS_Store"]);
const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value == null || value.length === 0) return fallback;
  return !["0", "false", "no"].includes(value.toLowerCase());
}

function parseArgs(argv: string[]): Options {
  const values = new Map<string, string>();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    values.set(key, rest.join("="));
  }

  const fixturesDir = values.get("fixtures")
    ? path.resolve(values.get("fixtures")!)
    : path.join(WORKSPACE_ROOT, "fixtures/floorplans");
  const explicitManifest = values.get("manifest");
  const manifestPath = explicitManifest
    ? path.resolve(explicitManifest)
    : fs.existsSync(path.join(fixturesDir, "manifest.json"))
      ? path.join(fixturesDir, "manifest.json")
      : path.join(fixturesDir, "manifest.example.json");
  const manifestBaseName = path.basename(manifestPath);

  return {
    fixturesDir,
    manifestPath,
    outPath: values.get("out") ? path.resolve(values.get("out")!) : null,
    strictBlindSet: parseBoolean(values.get("strictBlindSet"), false),
    requireFiles: parseBoolean(values.get("requireFiles"), manifestBaseName === "manifest.json"),
    minFixtures: Number(values.get("minFixtures") ?? 100),
    minKoreanComplexShare: Number(values.get("minKoreanComplexShare") ?? 0.2),
    minPdfFixtures: Number(values.get("minPdfFixtures") ?? 20),
    minWatermarkFixtures: Number(values.get("minWatermarkFixtures") ?? 20),
    minPhoneOrCroppedFixtures: Number(values.get("minPhoneOrCroppedFixtures") ?? 20)
  };
}

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function sumCounts(entries: string[]) {
  return entries.reduce<Record<string, number>>((accumulator, entry) => {
    accumulator[entry] = (accumulator[entry] ?? 0) + 1;
    return accumulator;
  }, {});
}

function includesAny(values: string[], targets: string[]) {
  return targets.some((target) => values.includes(target));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const raw = await fsp.readFile(options.manifestPath, "utf8");
  const parsed = JSON.parse(raw) as ManifestFile;
  const fixtures = parsed.fixtures ?? {};
  const manifestEntries = Object.entries(fixtures);
  const issues: string[] = [];

  if (manifestEntries.length === 0) {
    issues.push("manifest has no fixtures");
  }

  const diskFiles = (await fsp.readdir(options.fixturesDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((entry) => !IGNORED_FILES.has(entry))
    .sort((left, right) => left.localeCompare(right));

  if (options.requireFiles) {
    for (const fileName of diskFiles) {
      if (!fixtures[fileName]) {
        issues.push(`missing manifest entry for fixture file: ${fileName}`);
      }
    }
  }

  for (const [fileName, entry] of manifestEntries) {
    if (fileName.toLowerCase().endsWith(".pdf")) {
      issues.push(`${fileName}: raw PDF fixtures are not supported; rasterize to PNG/JPEG and keep channel=pdf_export`);
    }
    if (options.requireFiles && !diskFiles.includes(fileName)) {
      issues.push(`manifest entry points to missing fixture file: ${fileName}`);
    }
    if (!entry.channel) {
      issues.push(`${fileName}: channel is required`);
    }
    if (!entry.sourcePolicy || !ALLOWED_SOURCE_POLICIES.has(entry.sourcePolicy)) {
      issues.push(`${fileName}: sourcePolicy must be one of ${[...ALLOWED_SOURCE_POLICIES].join(", ")}`);
    }
    if (!Array.isArray(entry.qualityTags) || entry.qualityTags.length === 0) {
      issues.push(`${fileName}: qualityTags must be a non-empty array`);
    }
    if (!entry.complexityTier || !ALLOWED_COMPLEXITY.has(entry.complexityTier)) {
      issues.push(`${fileName}: complexityTier must be one of ${[...ALLOWED_COMPLEXITY].join(", ")}`);
    }
    if (entry.gold?.scale && (!(entry.gold.scale.metersPerPixel > 0) || !Number.isFinite(entry.gold.scale.metersPerPixel))) {
      issues.push(`${fileName}: gold.scale.metersPerPixel must be a positive number`);
    }
    if (entry.gold?.reviewSeconds != null && (!(entry.gold.reviewSeconds >= 0) || !Number.isFinite(entry.gold.reviewSeconds))) {
      issues.push(`${fileName}: gold.reviewSeconds must be a non-negative number`);
    }
    if (entry.gold?.expectedReviewRequired != null && typeof entry.gold.expectedReviewRequired !== "boolean") {
      issues.push(`${fileName}: gold.expectedReviewRequired must be boolean`);
    }
    for (const dimension of entry.gold?.dimensions ?? []) {
      if (dimension.mmValue != null && (!(dimension.mmValue > 0) || !Number.isFinite(dimension.mmValue))) {
        issues.push(`${fileName}: gold.dimensions.mmValue must be a positive number when present`);
      }
    }
  }

  const metadataRows = manifestEntries.map(([fixture, entry]) => ({
    fixture,
    channel: entry.channel ?? "unknown",
    sourcePolicy: entry.sourcePolicy ?? "unknown",
    qualityTags: entry.qualityTags ?? [],
    complexityTier: entry.complexityTier ?? "unknown"
  }));

  const koreanComplexCount = metadataRows.filter((entry) => entry.complexityTier === "korean_complex").length;
  const pdfFixtureCount = metadataRows.filter((entry) => entry.channel === "pdf_export").length;
  const watermarkFixtureCount = metadataRows.filter(
    (entry) =>
      entry.channel === "naver_land_gallery_capture" ||
      entry.channel === "real_estate_app_screenshot" ||
      includesAny(entry.qualityTags, ["watermark", "broker_overlay"])
  ).length;
  const phoneOrCroppedFixtureCount = metadataRows.filter(
    (entry) =>
      entry.channel === "phone_capture" ||
      entry.channel === "cropped_or_rotated" ||
      entry.channel === "messenger_compressed" ||
      includesAny(entry.qualityTags, ["cropped", "rotated", "low_res"])
  ).length;

  const totalFixtures = metadataRows.length;
  const koreanComplexShare = totalFixtures > 0 ? koreanComplexCount / totalFixtures : 0;

  if (options.strictBlindSet) {
    if (totalFixtures < options.minFixtures) {
      issues.push(`blind set has ${totalFixtures} fixtures; requires at least ${options.minFixtures}`);
    }
    if (koreanComplexShare < options.minKoreanComplexShare) {
      issues.push(
        `korean_complex share is ${percentage(koreanComplexShare)}; requires at least ${percentage(options.minKoreanComplexShare)}`
      );
    }
    if (pdfFixtureCount < options.minPdfFixtures) {
      issues.push(`pdf_export fixtures=${pdfFixtureCount}; requires at least ${options.minPdfFixtures}`);
    }
    if (watermarkFixtureCount < options.minWatermarkFixtures) {
      issues.push(`watermark/broker fixtures=${watermarkFixtureCount}; requires at least ${options.minWatermarkFixtures}`);
    }
    if (phoneOrCroppedFixtureCount < options.minPhoneOrCroppedFixtures) {
      issues.push(
        `phone/cropped fixtures=${phoneOrCroppedFixtureCount}; requires at least ${options.minPhoneOrCroppedFixtures}`
      );
    }
  }

  const summary = {
    fixturesDir: options.fixturesDir,
    manifestPath: options.manifestPath,
    strictBlindSet: options.strictBlindSet,
    requireFiles: options.requireFiles,
    totalFixtures,
    diskFiles: diskFiles.length,
    koreanComplexCount,
    koreanComplexShare,
    pdfFixtureCount,
    watermarkFixtureCount,
    phoneOrCroppedFixtureCount,
    channelCounts: sumCounts(metadataRows.map((entry) => entry.channel)),
    sourcePolicyCounts: sumCounts(metadataRows.map((entry) => entry.sourcePolicy)),
    complexityCounts: sumCounts(metadataRows.map((entry) => entry.complexityTier)),
    qualityTagCounts: sumCounts(metadataRows.flatMap((entry) => entry.qualityTags)),
    issues
  };

  if (options.outPath) {
    await fsp.mkdir(path.dirname(options.outPath), { recursive: true });
    await fsp.writeFile(options.outPath, JSON.stringify(summary, null, 2), "utf8");
  }

  console.log(
    `[validate-floorplan-fixtures] fixtures=${totalFixtures} koreanComplex=${koreanComplexCount} pdf=${pdfFixtureCount} watermark=${watermarkFixtureCount} phoneOrCropped=${phoneOrCroppedFixtureCount}`
  );
  Object.entries(summary.channelCounts).forEach(([channel, count]) => {
    console.log(`[validate-floorplan-fixtures] channel=${channel} count=${count}`);
  });

  if (issues.length > 0) {
    issues.forEach((issue) => {
      console.error(`[FAIL] ${issue}`);
    });
    throw new Error(`Fixture manifest validation failed with ${issues.length} issue(s).`);
  }

  console.log("[validate-floorplan-fixtures] PASS");
}

main().catch((error) => {
  console.error("[validate-floorplan-fixtures] fatal", error);
  process.exitCode = 1;
});
