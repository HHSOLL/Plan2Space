import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

type FixtureSummary = {
  fixture: string;
  channel: string | null;
  complexityTier: string | null;
  status: number;
  selectedProvider: string | null;
  selectedPassId: string | null;
  selectedPreprocessProfile: string | null;
  reviewRequired: boolean;
  conflictScore: number | null;
  roomTypeF1: number | null;
  dimensionValueAccuracy: number | null;
  scaleAgreement: number | null;
  correctionSeconds: number | null;
  hasGoldRooms: boolean;
  hasGoldDimensions: boolean;
  hasGoldScale: boolean;
  hasReviewExpectation: boolean;
  scaleSource: string | null;
};

type CandidateRow = {
  fixture: string;
  provider: string;
  passId?: string | null;
  preprocessProfile?: string | null;
  score: number | null;
  openingsAttachedRatio: number | null;
  exteriorLoopClosed?: boolean | null;
};

type EvalSummary = {
  fixtureSummaries: FixtureSummary[];
  candidateRows: CandidateRow[];
};

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function getArg(name: string, fallback: string) {
  const flag = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(flag));
  if (!found) return fallback;
  return found.slice(flag.length);
}

function parseNumberArg(name: string, fallback: number) {
  const value = Number(getArg(name, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

async function main() {
  const inputPath = getArg("input", path.join(WORKSPACE_ROOT, ".eval/floorplan/summary.json"));
  const minSuccessRate = parseNumberArg("minSuccessRate", 0.95);
  const minExteriorLoopClosure = parseNumberArg("minExteriorLoopClosure", 0.98);
  const minOpeningAttach = parseNumberArg("minOpeningAttach", 0.97);
  const maxReviewRate = parseNumberArg("maxReviewRate", 0.25);
  const maxUnknownScaleRate = parseNumberArg("maxUnknownScaleRate", 0.05);
  const minRoomTypeF1 = parseNumberArg("minRoomTypeF1", 0.88);
  const minDimensionValueAccuracy = parseNumberArg("minDimensionValueAccuracy", 0.95);
  const minScaleAgreement = parseNumberArg("minScaleAgreement", 0.95);
  const maxMedianCorrectionSeconds = parseNumberArg("maxMedianCorrectionSeconds", 60);
  const minKoreanComplexShare = parseNumberArg("minKoreanComplexShare", 0.2);
  const minComplexSuccessRate = parseNumberArg("minComplexSuccessRate", 0.9);
  const minRoomTypeCoverage = parseNumberArg("minRoomTypeCoverage", 0.8);
  const minDimensionCoverage = parseNumberArg("minDimensionCoverage", 0.8);
  const minScaleCoverage = parseNumberArg("minScaleCoverage", 0.9);
  const minReviewExpectationCoverage = parseNumberArg("minReviewExpectationCoverage", 1);
  const minCorrectionTelemetryCoverage = parseNumberArg("minCorrectionTelemetryCoverage", 0.2);

  const raw = await fs.readFile(inputPath, "utf8");
  const summary = JSON.parse(raw) as EvalSummary;
  const total = summary.fixtureSummaries.length;
  if (total === 0) {
    throw new Error(`No fixture summaries found in ${inputPath}`);
  }

  const successCount = summary.fixtureSummaries.filter((entry) => entry.status === 200).length;
  const successRate = successCount / total;
  const reviewRate = summary.fixtureSummaries.filter((entry) => entry.reviewRequired).length / total;
  const unknownScaleRate = summary.fixtureSummaries.filter((entry) => entry.scaleSource === "unknown").length / total;
  const koreanComplexFixtures = summary.fixtureSummaries.filter((entry) => entry.complexityTier === "korean_complex");
  const koreanComplexShare = koreanComplexFixtures.length / total;
  const complexSuccessRate =
    koreanComplexFixtures.length > 0
      ? koreanComplexFixtures.filter((entry) => entry.status === 200).length / koreanComplexFixtures.length
      : 0;

  const selectedCandidates = summary.fixtureSummaries
    .map((fixture) => {
      const candidates = summary.candidateRows.filter((candidate) => candidate.fixture === fixture.fixture);
      if (candidates.length === 0) return null;
      if (fixture.selectedProvider && fixture.selectedPassId && fixture.selectedPreprocessProfile) {
        const exactPass = candidates.find(
          (candidate) =>
            candidate.provider === fixture.selectedProvider &&
            candidate.passId === fixture.selectedPassId &&
            candidate.preprocessProfile === fixture.selectedPreprocessProfile
        );
        if (exactPass) return exactPass;
      }
      if (fixture.selectedProvider && fixture.selectedPassId) {
        const exactProviderPass = candidates.find(
          (candidate) => candidate.provider === fixture.selectedProvider && candidate.passId === fixture.selectedPassId
        );
        if (exactProviderPass) return exactProviderPass;
      }
      if (fixture.selectedProvider) {
        const exact = candidates
          .filter((candidate) => candidate.provider === fixture.selectedProvider)
          .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0];
        if (exact) return exact;
      }
      return candidates.sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0] ?? null;
    })
    .filter((candidate): candidate is CandidateRow => Boolean(candidate));

  const loopClosedRate =
    selectedCandidates.length > 0
      ? selectedCandidates.filter((candidate) => candidate.exteriorLoopClosed === true).length / selectedCandidates.length
      : 0;
  const openingAttachMean = average(
    selectedCandidates
      .map((candidate) => candidate.openingsAttachedRatio)
      .filter((value): value is number => Number.isFinite(value))
  );
  const roomTypeF1Mean = average(
    summary.fixtureSummaries
      .map((entry) => entry.roomTypeF1)
      .filter((value): value is number => Number.isFinite(value))
  );
  const roomTypeCoverage =
    summary.fixtureSummaries.filter((entry) => entry.hasGoldRooms && Number.isFinite(entry.roomTypeF1)).length /
    Math.max(summary.fixtureSummaries.filter((entry) => entry.hasGoldRooms).length, 1);
  const dimensionAccuracyMean = average(
    summary.fixtureSummaries
      .map((entry) => entry.dimensionValueAccuracy)
      .filter((value): value is number => Number.isFinite(value))
  );
  const dimensionCoverage =
    summary.fixtureSummaries.filter((entry) => entry.hasGoldDimensions && Number.isFinite(entry.dimensionValueAccuracy)).length /
    Math.max(summary.fixtureSummaries.filter((entry) => entry.hasGoldDimensions).length, 1);
  const scaleAgreementMean = average(
    summary.fixtureSummaries
      .map((entry) => entry.scaleAgreement)
      .filter((value): value is number => Number.isFinite(value))
  );
  const scaleCoverage =
    summary.fixtureSummaries.filter((entry) => entry.hasGoldScale && Number.isFinite(entry.scaleAgreement)).length /
    Math.max(summary.fixtureSummaries.filter((entry) => entry.hasGoldScale).length, 1);
  const reviewExpectationCoverage =
    summary.fixtureSummaries.filter((entry) => entry.hasReviewExpectation).length / Math.max(total, 1);
  const correctionTelemetryValues = summary.fixtureSummaries
    .map((entry) => entry.correctionSeconds)
    .filter((value): value is number => Number.isFinite(value));
  const correctionTelemetryCoverage = correctionTelemetryValues.length / Math.max(total, 1);
  const medianCorrectionSeconds = correctionTelemetryValues.length > 0 ? median(correctionTelemetryValues) : Number.POSITIVE_INFINITY;

  const checks = [
    {
      name: "success_rate",
      passed: successRate >= minSuccessRate,
      value: percentage(successRate),
      expected: `>= ${percentage(minSuccessRate)}`
    },
    {
      name: "exterior_loop_closure",
      passed: loopClosedRate >= minExteriorLoopClosure,
      value: percentage(loopClosedRate),
      expected: `>= ${percentage(minExteriorLoopClosure)}`
    },
    {
      name: "opening_attach_mean",
      passed: openingAttachMean >= minOpeningAttach,
      value: percentage(openingAttachMean),
      expected: `>= ${percentage(minOpeningAttach)}`
    },
    {
      name: "review_rate",
      passed: reviewRate <= maxReviewRate,
      value: percentage(reviewRate),
      expected: `<= ${percentage(maxReviewRate)}`
    },
    {
      name: "unknown_scale_rate",
      passed: unknownScaleRate <= maxUnknownScaleRate,
      value: percentage(unknownScaleRate),
      expected: `<= ${percentage(maxUnknownScaleRate)}`
    },
    {
      name: "room_type_f1",
      passed: roomTypeF1Mean >= minRoomTypeF1,
      value: percentage(roomTypeF1Mean),
      expected: `>= ${percentage(minRoomTypeF1)}`
    },
    {
      name: "dimension_value_accuracy",
      passed: dimensionAccuracyMean >= minDimensionValueAccuracy,
      value: percentage(dimensionAccuracyMean),
      expected: `>= ${percentage(minDimensionValueAccuracy)}`
    },
    {
      name: "scale_agreement",
      passed: scaleAgreementMean >= minScaleAgreement,
      value: percentage(scaleAgreementMean),
      expected: `>= ${percentage(minScaleAgreement)}`
    },
    {
      name: "median_correction_seconds",
      passed: medianCorrectionSeconds <= maxMedianCorrectionSeconds,
      value: Number.isFinite(medianCorrectionSeconds) ? `${medianCorrectionSeconds.toFixed(1)}s` : "missing",
      expected: `<= ${maxMedianCorrectionSeconds}s`
    },
    {
      name: "korean_complex_share",
      passed: koreanComplexShare >= minKoreanComplexShare,
      value: percentage(koreanComplexShare),
      expected: `>= ${percentage(minKoreanComplexShare)}`
    },
    {
      name: "korean_complex_success_rate",
      passed: complexSuccessRate >= minComplexSuccessRate,
      value: percentage(complexSuccessRate),
      expected: `>= ${percentage(minComplexSuccessRate)}`
    },
    {
      name: "room_type_coverage",
      passed: roomTypeCoverage >= minRoomTypeCoverage,
      value: percentage(roomTypeCoverage),
      expected: `>= ${percentage(minRoomTypeCoverage)}`
    },
    {
      name: "dimension_coverage",
      passed: dimensionCoverage >= minDimensionCoverage,
      value: percentage(dimensionCoverage),
      expected: `>= ${percentage(minDimensionCoverage)}`
    },
    {
      name: "scale_coverage",
      passed: scaleCoverage >= minScaleCoverage,
      value: percentage(scaleCoverage),
      expected: `>= ${percentage(minScaleCoverage)}`
    },
    {
      name: "review_expectation_coverage",
      passed: reviewExpectationCoverage >= minReviewExpectationCoverage,
      value: percentage(reviewExpectationCoverage),
      expected: `>= ${percentage(minReviewExpectationCoverage)}`
    },
    {
      name: "correction_telemetry_coverage",
      passed: correctionTelemetryCoverage >= minCorrectionTelemetryCoverage,
      value: percentage(correctionTelemetryCoverage),
      expected: `>= ${percentage(minCorrectionTelemetryCoverage)}`
    }
  ];

  console.log(`[eval-floorplan-gate] fixtures=${total} success=${successCount} reviewRate=${percentage(reviewRate)}`);
  console.log(
    `[eval-floorplan-gate] koreanComplex=${koreanComplexFixtures.length} share=${percentage(koreanComplexShare)} roomTypeF1=${percentage(
      roomTypeF1Mean
    )} dimensionAccuracy=${percentage(dimensionAccuracyMean)} scaleAgreement=${percentage(scaleAgreementMean)}`
  );
  console.log(
    `[eval-floorplan-gate] coverage room=${percentage(roomTypeCoverage)} dimension=${percentage(dimensionCoverage)} scale=${percentage(
      scaleCoverage
    )} reviewExpectation=${percentage(reviewExpectationCoverage)} correctionTelemetry=${percentage(correctionTelemetryCoverage)}`
  );

  checks.forEach((check) => {
    console.log(`[${check.passed ? "PASS" : "FAIL"}] ${check.name}: ${check.value} (expected ${check.expected})`);
  });

  const failedChecks = checks.filter((check) => !check.passed);
  if (failedChecks.length > 0) {
    throw new Error(`Eval gate failed: ${failedChecks.map((check) => check.name).join(", ")}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[eval-floorplan-gate] failed: ${message}`);
  process.exitCode = 1;
});
