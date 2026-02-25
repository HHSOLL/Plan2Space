import * as fs from "node:fs/promises";
import * as path from "node:path";

type CandidateDebug = {
  provider: string;
  score: number;
  scoreBreakdown?: {
    topologyScore?: number;
    openingScore?: number;
    scaleScore?: number;
    penalty?: number;
    total?: number;
  };
  metrics?: {
    wallCount?: number;
    openingCount?: number;
    axisAlignedRatio?: number;
    orphanWallCount?: number;
    selfIntersectionCount?: number;
    openingsAttachedRatio?: number;
    wallThicknessOutlierRate?: number;
    openingOverlapCount?: number;
    openingOutOfWallRangeCount?: number;
    exteriorAreaSanity?: boolean;
    openingTypeConfidenceMean?: number;
    loopCountPenalty?: number;
    scaleConfidence?: number;
    scaleEvidenceCompleteness?: number;
    scaleSource?: string;
    exteriorDetected?: boolean;
    exteriorLoopClosed?: boolean;
    entranceDetected?: boolean;
  };
  errors?: string[];
  timingMs?: number;
};

type ParseResponse = {
  source?: string;
  selectedProvider?: string;
  selectedScore?: number;
  selection?: {
    sourceModule?: string;
    selectedScore?: number;
  };
  walls?: unknown[];
  openings?: unknown[];
  metadata?: {
    scale?: number;
    scaleInfo?: {
      source?: string;
      confidence?: number;
    };
  };
  providerErrors?: string[];
  candidates?: CandidateDebug[];
  templateCandidates?: Array<{ id?: string; score?: number; matchType?: string }>;
  scaleCandidates?: Array<{ source?: string; value?: number; confidence?: number; score?: number }>;
  error?: string;
  details?: string;
};

type FixtureSummary = {
  fixture: string;
  status: number;
  selectedProvider: string | null;
  sourceModule: string | null;
  selectedScore: number | null;
  wallCount: number;
  openingCount: number;
  scale: number | null;
  scaleSource: string | null;
  scaleConfidence: number | null;
  recoverable: boolean;
  details: string | null;
};

function getArg(name: string, fallback: string) {
  const flag = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(flag));
  if (!found) return fallback;
  return found.slice(flag.length);
}

function parseBooleanArg(name: string, fallback: boolean) {
  const value = getArg(name, fallback ? "true" : "false");
  return value === "1" || value.toLowerCase() === "true";
}

function getMimeType(fileName: string) {
  const lowered = fileName.toLowerCase();
  if (lowered.endsWith(".png")) return "image/png";
  if (lowered.endsWith(".jpg") || lowered.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function toCsvRow(columns: Array<string | number | boolean | null | undefined>) {
  return columns
    .map((value) => {
      const text = value == null ? "" : String(value);
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replace(/"/g, "\"\"")}"`;
      }
      return text;
    })
    .join(",");
}

async function main() {
  const endpoint = getArg("endpoint", "http://127.0.0.1:3100/api/ai/parse-floorplan");
  const fixturesDir = getArg("fixtures", path.join(process.cwd(), "apps/web/fixtures/floorplans"));
  const outputDir = getArg("out", path.join(process.cwd(), "apps/web/.eval/floorplan"));
  const skipCache = parseBooleanArg("skipCache", true);
  const debug = parseBooleanArg("debug", true);

  const entries = await fs.readdir(fixturesDir, { withFileTypes: true });
  const fixtures = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(png|jpe?g)$/i.test(name))
    .sort((a, b) => a.localeCompare(b));

  if (fixtures.length === 0) {
    throw new Error(`No fixtures found in ${fixturesDir}`);
  }

  await fs.mkdir(outputDir, { recursive: true });

  const runAt = new Date().toISOString();
  const fixtureSummaries: FixtureSummary[] = [];
  const candidateRows: Array<{
    fixture: string;
    provider: string;
    score: number | null;
    timingMs: number | null;
    wallCount: number | null;
    openingCount: number | null;
    axisAlignedRatio: number | null;
    orphanWallCount: number | null;
    selfIntersectionCount: number | null;
    openingsAttachedRatio: number | null;
    wallThicknessOutlierRate: number | null;
    openingOverlapCount: number | null;
    openingOutOfWallRangeCount: number | null;
    exteriorAreaSanity: boolean | null;
    openingTypeConfidenceMean: number | null;
    loopCountPenalty: number | null;
    scaleConfidence: number | null;
    scaleEvidenceCompleteness: number | null;
    scaleSource: string | null;
    exteriorDetected: boolean | null;
    exteriorLoopClosed: boolean | null;
    entranceDetected: boolean | null;
    topologyScore: number | null;
    openingScore: number | null;
    scaleScore: number | null;
    penalty: number | null;
    errors: string;
  }> = [];
  const rawResults: Array<{
    fixture: string;
    status: number;
    body: ParseResponse;
  }> = [];

  for (const fixture of fixtures) {
    const fixturePath = path.join(fixturesDir, fixture);
    const fileBuffer = await fs.readFile(fixturePath);
    const mimeType = getMimeType(fixture);
    const dataUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "upload",
        base64: dataUrl,
        mimeType,
        skipCache,
        debug
      })
    });
    const body = (await response.json().catch(() => ({}))) as ParseResponse;
    rawResults.push({ fixture, status: response.status, body });

    const selectedProvider =
      typeof body.selectedProvider === "string"
        ? body.selectedProvider
        : typeof body.source === "string"
          ? body.source
          : null;
    const sourceModule = typeof body.selection?.sourceModule === "string" ? body.selection.sourceModule : null;
    const selectedScore =
      typeof body.selectedScore === "number" && Number.isFinite(body.selectedScore) ? body.selectedScore : null;
    const wallCount = Array.isArray(body.walls) ? body.walls.length : 0;
    const openingCount = Array.isArray(body.openings) ? body.openings.length : 0;
    const scale = typeof body.metadata?.scale === "number" ? body.metadata.scale : null;
    const scaleSource = body.metadata?.scaleInfo?.source ?? null;
    const scaleConfidence =
      typeof body.metadata?.scaleInfo?.confidence === "number" ? body.metadata.scaleInfo.confidence : null;
    const recoverable = response.status === 422;
    const details = body.details ?? body.error ?? null;

    fixtureSummaries.push({
      fixture,
      status: response.status,
      selectedProvider,
      sourceModule,
      selectedScore,
      wallCount,
      openingCount,
      scale,
      scaleSource,
      scaleConfidence,
      recoverable,
      details
    });

    const candidates = Array.isArray(body.candidates) ? body.candidates : [];
    for (const candidate of candidates) {
      candidateRows.push({
        fixture,
        provider: candidate.provider,
        score: Number.isFinite(candidate.score) ? candidate.score : null,
        timingMs: Number.isFinite(candidate.timingMs) ? candidate.timingMs : null,
        wallCount: Number.isFinite(candidate.metrics?.wallCount) ? candidate.metrics?.wallCount ?? null : null,
        openingCount: Number.isFinite(candidate.metrics?.openingCount) ? candidate.metrics?.openingCount ?? null : null,
        axisAlignedRatio: Number.isFinite(candidate.metrics?.axisAlignedRatio)
          ? candidate.metrics?.axisAlignedRatio ?? null
          : null,
        orphanWallCount: Number.isFinite(candidate.metrics?.orphanWallCount)
          ? candidate.metrics?.orphanWallCount ?? null
          : null,
        selfIntersectionCount: Number.isFinite(candidate.metrics?.selfIntersectionCount)
          ? candidate.metrics?.selfIntersectionCount ?? null
          : null,
        openingsAttachedRatio: Number.isFinite(candidate.metrics?.openingsAttachedRatio)
          ? candidate.metrics?.openingsAttachedRatio ?? null
          : null,
        wallThicknessOutlierRate: Number.isFinite(candidate.metrics?.wallThicknessOutlierRate)
          ? candidate.metrics?.wallThicknessOutlierRate ?? null
          : null,
        openingOverlapCount: Number.isFinite(candidate.metrics?.openingOverlapCount)
          ? candidate.metrics?.openingOverlapCount ?? null
          : null,
        openingOutOfWallRangeCount: Number.isFinite(candidate.metrics?.openingOutOfWallRangeCount)
          ? candidate.metrics?.openingOutOfWallRangeCount ?? null
          : null,
        exteriorAreaSanity:
          typeof candidate.metrics?.exteriorAreaSanity === "boolean" ? candidate.metrics.exteriorAreaSanity : null,
        openingTypeConfidenceMean: Number.isFinite(candidate.metrics?.openingTypeConfidenceMean)
          ? candidate.metrics?.openingTypeConfidenceMean ?? null
          : null,
        loopCountPenalty: Number.isFinite(candidate.metrics?.loopCountPenalty)
          ? candidate.metrics?.loopCountPenalty ?? null
          : null,
        scaleConfidence: Number.isFinite(candidate.metrics?.scaleConfidence)
          ? candidate.metrics?.scaleConfidence ?? null
          : null,
        scaleEvidenceCompleteness: Number.isFinite(candidate.metrics?.scaleEvidenceCompleteness)
          ? candidate.metrics?.scaleEvidenceCompleteness ?? null
          : null,
        scaleSource: typeof candidate.metrics?.scaleSource === "string" ? candidate.metrics.scaleSource : null,
        exteriorDetected:
          typeof candidate.metrics?.exteriorDetected === "boolean" ? candidate.metrics.exteriorDetected : null,
        exteriorLoopClosed:
          typeof candidate.metrics?.exteriorLoopClosed === "boolean" ? candidate.metrics.exteriorLoopClosed : null,
        entranceDetected:
          typeof candidate.metrics?.entranceDetected === "boolean" ? candidate.metrics.entranceDetected : null,
        topologyScore: Number.isFinite(candidate.scoreBreakdown?.topologyScore)
          ? candidate.scoreBreakdown?.topologyScore ?? null
          : null,
        openingScore: Number.isFinite(candidate.scoreBreakdown?.openingScore)
          ? candidate.scoreBreakdown?.openingScore ?? null
          : null,
        scaleScore: Number.isFinite(candidate.scoreBreakdown?.scaleScore)
          ? candidate.scoreBreakdown?.scaleScore ?? null
          : null,
        penalty: Number.isFinite(candidate.scoreBreakdown?.penalty) ? candidate.scoreBreakdown?.penalty ?? null : null,
        errors: Array.isArray(candidate.errors) ? candidate.errors.join(" | ") : ""
      });
    }
  }

  const summaryCsvLines = [
    toCsvRow([
      "fixture",
      "status",
      "selectedProvider",
      "sourceModule",
      "selectedScore",
      "wallCount",
      "openingCount",
      "scale",
      "scaleSource",
      "scaleConfidence",
      "recoverable",
      "details"
    ]),
    ...fixtureSummaries.map((row) =>
      toCsvRow([
        row.fixture,
        row.status,
        row.selectedProvider,
        row.sourceModule,
        row.selectedScore,
        row.wallCount,
        row.openingCount,
        row.scale,
        row.scaleSource,
        row.scaleConfidence,
        row.recoverable,
        row.details
      ])
    )
  ].join("\n");

  const candidatesCsvLines = [
    toCsvRow([
      "fixture",
      "provider",
      "score",
      "timingMs",
      "wallCount",
      "openingCount",
      "axisAlignedRatio",
      "orphanWallCount",
      "selfIntersectionCount",
      "openingsAttachedRatio",
      "wallThicknessOutlierRate",
      "openingOverlapCount",
      "openingOutOfWallRangeCount",
      "exteriorAreaSanity",
      "openingTypeConfidenceMean",
      "loopCountPenalty",
      "scaleConfidence",
      "scaleEvidenceCompleteness",
      "scaleSource",
      "exteriorDetected",
      "exteriorLoopClosed",
      "entranceDetected",
      "topologyScore",
      "openingScore",
      "scaleScore",
      "penalty",
      "errors"
    ]),
    ...candidateRows.map((row) =>
      toCsvRow([
        row.fixture,
        row.provider,
        row.score,
        row.timingMs,
        row.wallCount,
        row.openingCount,
        row.axisAlignedRatio,
        row.orphanWallCount,
        row.selfIntersectionCount,
        row.openingsAttachedRatio,
        row.wallThicknessOutlierRate,
        row.openingOverlapCount,
        row.openingOutOfWallRangeCount,
        row.exteriorAreaSanity,
        row.openingTypeConfidenceMean,
        row.loopCountPenalty,
        row.scaleConfidence,
        row.scaleEvidenceCompleteness,
        row.scaleSource,
        row.exteriorDetected,
        row.exteriorLoopClosed,
        row.entranceDetected,
        row.topologyScore,
        row.openingScore,
        row.scaleScore,
        row.penalty,
        row.errors
      ])
    )
  ].join("\n");

  const jsonOutput = {
    runAt,
    endpoint,
    fixturesDir,
    outputDir,
    skipCache,
    debug,
    fixtureSummaries,
    candidateRows,
    rawResults
  };

  await Promise.all([
    fs.writeFile(path.join(outputDir, "summary.json"), JSON.stringify(jsonOutput, null, 2), "utf8"),
    fs.writeFile(path.join(outputDir, "fixtures-summary.csv"), summaryCsvLines, "utf8"),
    fs.writeFile(path.join(outputDir, "candidates.csv"), candidatesCsvLines, "utf8")
  ]);

  const successCount = fixtureSummaries.filter((entry) => entry.status === 200).length;
  const recoverableCount = fixtureSummaries.filter((entry) => entry.recoverable).length;

  console.log(`[eval-floorplan] fixtures=${fixtures.length} success=${successCount} recoverable=${recoverableCount}`);
  console.log(`[eval-floorplan] outputs written to ${outputDir}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[eval-floorplan] failed: ${message}`);
  process.exitCode = 1;
});
