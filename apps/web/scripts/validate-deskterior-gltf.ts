import { readFile } from "node:fs/promises";
import { validateBytes } from "gltf-validator";
import { curatedDeskteriorAssets } from "./deskterior-curated-assets";

type ValidationMessage = {
  code: string;
  message: string;
  severity: number;
  pointer?: string;
};

type ValidationReport = {
  info?: {
    drawCallCount?: number;
    totalTriangleCount?: number;
    totalVertexCount?: number;
    materialCount?: number;
    extensionsUsed?: string[];
  };
  issues?: {
    numErrors?: number;
    numWarnings?: number;
    numInfos?: number;
    numHints?: number;
    messages?: ValidationMessage[];
  };
};

type ValidationResult = {
  key: string;
  manifestId: string;
  runtimePath: string;
  ok: boolean;
  exists: boolean;
  numErrors: number;
  numWarnings: number;
  numInfos: number;
  numHints: number;
  drawCallCount: number | null;
  totalTriangleCount: number | null;
  totalVertexCount: number | null;
  materialCount: number | null;
  extensionsUsed: string[];
  messages: ValidationMessage[];
};

type Summary = {
  ok: boolean;
  strictWarnings: boolean;
  counts: {
    assets: number;
    validated: number;
    missingRuntime: number;
    errors: number;
    warnings: number;
  };
  results: ValidationResult[];
};

function parseArgs(argv: string[]) {
  const json = argv.includes("--json");
  const strictWarnings = argv.includes("--strict-warnings");
  const help = argv.includes("--help");
  const unknownArgs = argv.filter((arg) => !["--json", "--strict-warnings", "--help"].includes(arg));
  return { json, strictWarnings, help, unknownArgs };
}

function severityLabel(severity: number) {
  switch (severity) {
    case 0:
      return "error";
    case 1:
      return "warning";
    case 2:
      return "info";
    case 3:
      return "hint";
    default:
      return "unknown";
  }
}

function toSafeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toSafeMetric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function validateRuntimeAsset(
  key: string,
  manifestId: string,
  runtimePath: string,
  strictWarnings: boolean
): Promise<ValidationResult> {
  try {
    const bytes = await readFile(runtimePath);
    const report = (await validateBytes(new Uint8Array(bytes), {
      uri: runtimePath,
      maxIssues: 50,
      writeTimestamp: false
    })) as ValidationReport;
    const issues = report.issues ?? {};
    const numErrors = toSafeCount(issues.numErrors);
    const numWarnings = toSafeCount(issues.numWarnings);
    const numInfos = toSafeCount(issues.numInfos);
    const numHints = toSafeCount(issues.numHints);

    return {
      key,
      manifestId,
      runtimePath,
      ok: numErrors === 0 && (!strictWarnings || numWarnings === 0),
      exists: true,
      numErrors,
      numWarnings,
      numInfos,
      numHints,
      drawCallCount: toSafeMetric(report.info?.drawCallCount),
      totalTriangleCount: toSafeMetric(report.info?.totalTriangleCount),
      totalVertexCount: toSafeMetric(report.info?.totalVertexCount),
      materialCount: toSafeMetric(report.info?.materialCount),
      extensionsUsed: Array.isArray(report.info?.extensionsUsed)
        ? report.info.extensionsUsed.filter((value): value is string => typeof value === "string")
        : [],
      messages: Array.isArray(issues.messages) ? issues.messages : []
    };
  } catch (error) {
    return {
      key,
      manifestId,
      runtimePath,
      ok: false,
      exists: false,
      numErrors: 1,
      numWarnings: 0,
      numInfos: 0,
      numHints: 0,
      drawCallCount: null,
      totalTriangleCount: null,
      totalVertexCount: null,
      materialCount: null,
      extensionsUsed: [],
      messages: [
        {
          code: "RUNTIME_MISSING_OR_INVALID",
          message: error instanceof Error ? error.message : String(error),
          severity: 0
        }
      ]
    };
  }
}

async function buildSummary(strictWarnings: boolean): Promise<Summary> {
  const results = await Promise.all(
    curatedDeskteriorAssets.map((asset) =>
      validateRuntimeAsset(asset.key, asset.manifestId, asset.runtimePath, strictWarnings)
    )
  );

  return {
    ok: results.every((result) => result.ok),
    strictWarnings,
    counts: {
      assets: curatedDeskteriorAssets.length,
      validated: results.filter((result) => result.exists).length,
      missingRuntime: results.filter((result) => !result.exists).length,
      errors: results.reduce((sum, result) => sum + result.numErrors, 0),
      warnings: results.reduce((sum, result) => sum + result.numWarnings, 0)
    },
    results
  };
}

function printHumanReadable(summary: Summary) {
  console.log("Deskterior GLTF Validation");
  console.log(`Status: ${summary.ok ? "PASS" : "FAIL"}`);
  console.log(`Strict warnings: ${summary.strictWarnings ? "on" : "off"}`);
  console.log("");
  console.log("Counts:");
  console.log(`- Curated assets: ${summary.counts.assets}`);
  console.log(`- Validated runtime files: ${summary.counts.validated}`);
  console.log(`- Missing runtime files: ${summary.counts.missingRuntime}`);
  console.log(`- Errors: ${summary.counts.errors}`);
  console.log(`- Warnings: ${summary.counts.warnings}`);
  console.log("");
  console.log("Assets:");

  for (const result of summary.results) {
    console.log(
      `- ${result.key} -> ${result.manifestId} | status=${result.ok ? "ok" : "fail"} | errors=${result.numErrors} | warnings=${result.numWarnings} | infos=${result.numInfos} | drawCalls=${result.drawCallCount ?? "-"} | triangles=${result.totalTriangleCount ?? "-"}`
    );

    const surfacedMessages = result.messages.filter((message) => message.severity <= 1).slice(0, 5);
    for (const message of surfacedMessages) {
      const pointer = message.pointer ? ` @ ${message.pointer}` : "";
      console.log(`  • ${severityLabel(message.severity)} ${message.code}${pointer}: ${message.message}`);
    }
  }
}

async function main() {
  const { json, strictWarnings, help, unknownArgs } = parseArgs(process.argv.slice(2));

  if (help) {
    console.log(
      [
        "Usage: node --import tsx apps/web/scripts/validate-deskterior-gltf.ts [options]",
        "",
        "Options:",
        "  --json             Print machine-readable summary JSON",
        "  --strict-warnings  Treat warnings as failures",
        "  --help             Show help"
      ].join("\n")
    );
    process.exit(0);
  }

  if (unknownArgs.length > 0) {
    console.error(`Unknown arguments: ${unknownArgs.join(", ")}`);
    process.exit(1);
  }

  const summary = await buildSummary(strictWarnings);

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printHumanReadable(summary);
  }

  process.exit(summary.ok ? 0 : 1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
