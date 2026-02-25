import * as fs from "node:fs/promises";
import * as path from "node:path";

type CandidateMetrics = {
  exteriorLoopClosed?: boolean;
  openingsAttachedRatio?: number;
};

type CandidateDebug = {
  provider?: string;
  score?: number;
  metrics?: CandidateMetrics;
};

type ParseResponse = {
  selectedProvider?: string;
  selectedScore?: number;
  candidates?: CandidateDebug[];
  metadata?: {
    scaleInfo?: {
      source?: string;
    };
  };
};

type EvalSummary = {
  fixtureSummaries: Array<{
    fixture: string;
    status: number;
    recoverable?: boolean;
  }>;
  rawResults: Array<{
    fixture: string;
    status: number;
    body: ParseResponse;
  }>;
};

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

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

async function main() {
  const inputPath = getArg("input", path.join(process.cwd(), "apps/web/.eval/floorplan/summary.json"));
  const baselinePath = getArg("baseline", "");
  const minSuccessRate = parseNumberArg("minSuccessRate", 0.9);
  const minExteriorLoopClosure = parseNumberArg("minExteriorLoopClosure", 0.95);
  const minOpeningAttach = parseNumberArg("minOpeningAttach", 0.92);
  const maxRecoverableRate = parseNumberArg("maxRecoverableRate", 0.2);
  const maxUnknownScaleRate = parseNumberArg("maxUnknownScaleRate", 0.2);
  const maxMedianScoreDrop = parseNumberArg("maxMedianScoreDrop", 0.1);

  const raw = await fs.readFile(inputPath, "utf8");
  const summary = JSON.parse(raw) as EvalSummary;

  const total = summary.fixtureSummaries.length;
  if (total === 0) {
    throw new Error(`No fixture summaries found in ${inputPath}`);
  }

  const successCount = summary.fixtureSummaries.filter((entry) => entry.status === 200).length;
  const recoverableCount = summary.fixtureSummaries.filter((entry) => entry.status === 422 || entry.recoverable).length;
  const successRate = successCount / total;
  const recoverableRate = recoverableCount / total;

  const selectedCandidates = summary.rawResults
    .filter((entry) => entry.status === 200)
    .map((entry) => {
      const selectedProvider = entry.body?.selectedProvider;
      const candidates = Array.isArray(entry.body?.candidates) ? entry.body.candidates : [];
      if (!selectedProvider) return null;
      return candidates.find((candidate) => candidate.provider === selectedProvider) ?? null;
    })
    .filter((candidate): candidate is CandidateDebug => Boolean(candidate));

  const loopClosedRate =
    selectedCandidates.length > 0
      ? selectedCandidates.filter((candidate) => candidate.metrics?.exteriorLoopClosed === true).length /
        selectedCandidates.length
      : 0;

  const openingAttachValues = selectedCandidates
    .map((candidate) => candidate.metrics?.openingsAttachedRatio)
    .filter((value): value is number => Number.isFinite(value));
  const openingAttachMean =
    openingAttachValues.length > 0
      ? openingAttachValues.reduce((sum, value) => sum + value, 0) / openingAttachValues.length
      : 0;

  const unknownScaleCount = summary.rawResults.filter((entry) => entry.body?.metadata?.scaleInfo?.source === "unknown").length;
  const unknownScaleRate = unknownScaleCount / total;

  const selectedScores = summary.rawResults
    .map((entry) => entry.body?.selectedScore)
    .filter((score): score is number => Number.isFinite(score));
  const currentMedianScore = median(selectedScores);

  let baselineMedianScore: number | null = null;
  let scoreDropRatio = 0;
  if (baselinePath) {
    const baselineRaw = await fs.readFile(baselinePath, "utf8");
    const baselineSummary = JSON.parse(baselineRaw) as EvalSummary;
    const baselineScores = baselineSummary.rawResults
      .map((entry) => entry.body?.selectedScore)
      .filter((score): score is number => Number.isFinite(score));
    baselineMedianScore = median(baselineScores);
    if (baselineMedianScore > 0) {
      scoreDropRatio = (baselineMedianScore - currentMedianScore) / baselineMedianScore;
    }
  }

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
      name: "recoverable_rate",
      passed: recoverableRate <= maxRecoverableRate,
      value: percentage(recoverableRate),
      expected: `<= ${percentage(maxRecoverableRate)}`
    },
    {
      name: "unknown_scale_rate",
      passed: unknownScaleRate <= maxUnknownScaleRate,
      value: percentage(unknownScaleRate),
      expected: `<= ${percentage(maxUnknownScaleRate)}`
    }
  ];

  if (baselineMedianScore !== null) {
    checks.push({
      name: "median_score_drop",
      passed: scoreDropRatio <= maxMedianScoreDrop,
      value: percentage(scoreDropRatio),
      expected: `<= ${percentage(maxMedianScoreDrop)}`
    });
  }

  console.log(`[eval-floorplan-gate] fixtures=${total} success=${successCount} recoverable=${recoverableCount}`);
  console.log(`[eval-floorplan-gate] selectedMedianScore=${currentMedianScore.toFixed(2)}`);
  checks.forEach((check) => {
    const status = check.passed ? "PASS" : "FAIL";
    console.log(`[${status}] ${check.name}: ${check.value} (expected ${check.expected})`);
  });

  const failedChecks = checks.filter((check) => !check.passed);
  if (failedChecks.length > 0) {
    const failedNames = failedChecks.map((check) => check.name).join(", ");
    throw new Error(`Eval gate failed: ${failedNames}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[eval-floorplan-gate] failed: ${message}`);
  process.exitCode = 1;
});
