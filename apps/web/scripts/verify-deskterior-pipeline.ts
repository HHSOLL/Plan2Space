import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type CuratedAsset = {
  key: string;
  manifestId: string;
  sourcePath: string;
  runtimePath: string;
  expectedAssetId: string;
  requiredMetadata: Array<"brand" | "externalUrl" | "description" | "category" | "options">;
  optionsHint?: string;
};

type ManifestEntry = Record<string, unknown> & {
  id?: unknown;
  assetId?: unknown;
  brand?: unknown;
  externalUrl?: unknown;
  description?: unknown;
  category?: unknown;
  options?: unknown;
  dimensionsMm?: unknown;
  finishColor?: unknown;
  finishMaterial?: unknown;
  detailNotes?: unknown;
  scaleLocked?: unknown;
};

type VerificationError = {
  code: string;
  message: string;
  assetKey?: string;
  manifestId?: string;
  path?: string;
};

type CuratedAssetResult = {
  key: string;
  manifestId: string;
  sourcePath: string;
  runtimePath: string;
  expectedAssetId: string;
  sourceExists: boolean;
  runtimeExists: boolean;
  runtimeFresh: boolean;
  manifestEntryExists: boolean;
  manifestAssetIdMatches: boolean;
  metadataValid: boolean;
  optionsHintValid: boolean;
};

type Summary = {
  ok: boolean;
  counts: {
    curatedAssets: number;
    manifestEntries: number;
    sourceFilesFound: number;
    runtimeFilesFound: number;
    freshRuntimeFiles: number;
    curatedManifestEntriesValid: number;
    duplicateManifestIds: number;
    errors: number;
  };
  manifestPath: string;
  curatedAssets: CuratedAssetResult[];
  errors: VerificationError[];
};

const scriptFile = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptFile);
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(appRoot, "../..");
const publicRoot = path.join(appRoot, "public");
const manifestPath = path.join(publicRoot, "assets", "catalog", "manifest.json");

const curatedAssets: CuratedAsset[] = [
  {
    key: "p2s_desk_oak",
    manifestId: "p2s_desk_oak_140",
    sourcePath: path.join(repoRoot, "assets", "blender", "deskterior", "p2s_desk_oak.blend"),
    runtimePath: path.join(publicRoot, "assets", "models", "p2s_desk_oak", "p2s_desk_oak.glb"),
    expectedAssetId: "/assets/models/p2s_desk_oak/p2s_desk_oak.glb",
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"]
  },
  {
    key: "p2s_monitor_stand",
    manifestId: "p2s_monitor_stand_wood",
    sourcePath: path.join(repoRoot, "assets", "blender", "deskterior", "p2s_monitor_stand.blend"),
    runtimePath: path.join(publicRoot, "assets", "models", "p2s_monitor_stand", "p2s_monitor_stand.glb"),
    expectedAssetId: "/assets/models/p2s_monitor_stand/p2s_monitor_stand.glb",
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"]
  },
  {
    key: "p2s_desk_lamp_glow",
    manifestId: "p2s_desk_lamp_glow",
    sourcePath: path.join(repoRoot, "assets", "blender", "deskterior", "p2s_desk_lamp_glow.blend"),
    runtimePath: path.join(publicRoot, "assets", "models", "p2s_desk_lamp_glow", "p2s_desk_lamp_glow.glb"),
    expectedAssetId: "/assets/models/p2s_desk_lamp_glow/p2s_desk_lamp_glow.glb",
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
    optionsHint: "light-emitter"
  }
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function toAssetId(runtimePath: string) {
  return `/${path.relative(publicRoot, runtimePath).split(path.sep).join("/")}`;
}

function createError(
  errors: VerificationError[],
  code: string,
  message: string,
  details: Omit<VerificationError, "code" | "message"> = {}
) {
  errors.push({ code, message, ...details });
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv: string[]) {
  const json = argv.includes("--json");
  const help = argv.includes("--help");
  const unknownArgs = argv.filter((arg) => !["--json", "--help"].includes(arg));
  return { json, help, unknownArgs };
}

async function buildSummary(): Promise<Summary> {
  const errors: VerificationError[] = [];
  const results: CuratedAssetResult[] = [];

  let manifestEntries: ManifestEntry[] = [];
  let duplicateManifestIds = 0;

  let manifestRaw: string | null = null;
  try {
    manifestRaw = await readFile(manifestPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    createError(errors, "manifest.read_failed", `Failed to read manifest: ${message}`, { path: manifestPath });
  }

  if (manifestRaw !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(manifestRaw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      createError(errors, "manifest.invalid_json", `Manifest is not valid JSON: ${message}`, { path: manifestPath });
    }

    if (parsed !== undefined && !Array.isArray(parsed)) {
      createError(errors, "manifest.not_array", "Manifest root value must be a JSON array.", { path: manifestPath });
    }

    if (Array.isArray(parsed)) {
      manifestEntries = parsed as ManifestEntry[];
      const counts = new Map<string, number>();
      for (const entry of manifestEntries) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        const id = entry.id;
        if (!isNonEmptyString(id)) {
          continue;
        }
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }

      for (const [id, count] of counts.entries()) {
        if (count > 1) {
          duplicateManifestIds += 1;
          createError(
            errors,
            "manifest.duplicate_id",
            `Manifest contains duplicate id "${id}" (${count} entries).`,
            { manifestId: id, path: manifestPath }
          );
        }
      }
    }
  }

  const manifestById = new Map<string, ManifestEntry[]>();
  for (const entry of manifestEntries) {
    if (!entry || typeof entry !== "object" || !isNonEmptyString(entry.id)) {
      continue;
    }
    const bucket = manifestById.get(entry.id) ?? [];
    bucket.push(entry);
    manifestById.set(entry.id, bucket);
  }

  let sourceFilesFound = 0;
  let runtimeFilesFound = 0;
  let freshRuntimeFiles = 0;
  let curatedManifestEntriesValid = 0;

  for (const asset of curatedAssets) {
    const result: CuratedAssetResult = {
      key: asset.key,
      manifestId: asset.manifestId,
      sourcePath: asset.sourcePath,
      runtimePath: asset.runtimePath,
      expectedAssetId: asset.expectedAssetId,
      sourceExists: false,
      runtimeExists: false,
      runtimeFresh: false,
      manifestEntryExists: false,
      manifestAssetIdMatches: false,
      metadataValid: false,
      optionsHintValid: asset.optionsHint ? false : true
    };

    const sourceExists = await fileExists(asset.sourcePath);
    result.sourceExists = sourceExists;
    if (sourceExists) {
      sourceFilesFound += 1;
    } else {
      createError(errors, "asset.source_missing", "Curated source .blend file is missing.", {
        assetKey: asset.key,
        path: asset.sourcePath
      });
    }

    const runtimeExists = await fileExists(asset.runtimePath);
    result.runtimeExists = runtimeExists;
    if (runtimeExists) {
      runtimeFilesFound += 1;
    } else {
      createError(errors, "asset.runtime_missing", "Curated runtime .glb file is missing.", {
        assetKey: asset.key,
        path: asset.runtimePath
      });
    }

    if (sourceExists && runtimeExists) {
      const [sourceStat, runtimeStat] = await Promise.all([stat(asset.sourcePath), stat(asset.runtimePath)]);
      if (runtimeStat.mtimeMs >= sourceStat.mtimeMs) {
        result.runtimeFresh = true;
        freshRuntimeFiles += 1;
      } else {
        createError(errors, "asset.runtime_stale", "Runtime .glb is older than its source .blend.", {
          assetKey: asset.key,
          path: asset.runtimePath
        });
      }
    }

    const derivedAssetId = toAssetId(asset.runtimePath);
    if (derivedAssetId !== asset.expectedAssetId) {
      createError(errors, "asset.mapping_mismatch", "Expected assetId does not match the runtime file path.", {
        assetKey: asset.key,
        manifestId: asset.manifestId,
        path: asset.runtimePath
      });
    }

    const matchingEntries = manifestById.get(asset.manifestId) ?? [];
    if (matchingEntries.length === 0) {
      createError(errors, "manifest.curated_missing", "Curated manifest entry is missing.", {
        assetKey: asset.key,
        manifestId: asset.manifestId,
        path: manifestPath
      });
      results.push(result);
      continue;
    }

    result.manifestEntryExists = true;
    const entry = matchingEntries[0];
    if (entry.assetId === asset.expectedAssetId) {
      result.manifestAssetIdMatches = true;
    } else {
      createError(errors, "manifest.asset_id_mismatch", "Manifest assetId does not match the curated runtime path.", {
        assetKey: asset.key,
        manifestId: asset.manifestId,
        path: manifestPath
      });
    }

    let metadataValid = true;
    for (const field of asset.requiredMetadata) {
      if (!isNonEmptyString(entry[field])) {
        metadataValid = false;
        createError(errors, "manifest.required_metadata_missing", `Manifest field "${field}" must be a non-empty string.`, {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: manifestPath
        });
      }
    }

    const dimensionsMm = entry.dimensionsMm;
    if (!isObjectRecord(dimensionsMm)) {
      metadataValid = false;
      createError(
        errors,
        "manifest.curated_physical_metadata_missing",
        'Manifest field "dimensionsMm" must be an object with positive width/depth/height values for curated assets.',
        {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: manifestPath
        }
      );
    } else {
      for (const dimension of ["width", "depth", "height"] as const) {
        if (!isPositiveNumber(dimensionsMm[dimension])) {
          metadataValid = false;
          createError(
            errors,
            "manifest.curated_physical_metadata_invalid",
            `Manifest field "dimensionsMm.${dimension}" must be a positive number for curated assets.`,
            {
              assetKey: asset.key,
              manifestId: asset.manifestId,
              path: manifestPath
            }
          );
        }
      }
    }

    for (const field of ["finishColor", "finishMaterial", "detailNotes"] as const) {
      if (!isNonEmptyString(entry[field])) {
        metadataValid = false;
        createError(
          errors,
          "manifest.curated_physical_metadata_missing",
          `Manifest field "${field}" must be a non-empty string for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
    }

    if (entry.scaleLocked !== true) {
      metadataValid = false;
      createError(
        errors,
        "manifest.curated_physical_metadata_invalid",
        'Manifest field "scaleLocked" must be true for curated assets.',
        {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: manifestPath
        }
      );
    }

    result.metadataValid = metadataValid;

    if (asset.optionsHint) {
      const options = entry.options;
      if (isNonEmptyString(options) && options.includes(asset.optionsHint)) {
        result.optionsHintValid = true;
      } else {
        createError(
          errors,
          "manifest.options_hint_missing",
          `Manifest options must include "${asset.optionsHint}" for this curated asset.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
    }

    if (
      result.manifestEntryExists &&
      result.manifestAssetIdMatches &&
      result.metadataValid &&
      result.optionsHintValid
    ) {
      curatedManifestEntriesValid += 1;
    }

    results.push(result);
  }

  return {
    ok: errors.length === 0,
    counts: {
      curatedAssets: curatedAssets.length,
      manifestEntries: manifestEntries.length,
      sourceFilesFound,
      runtimeFilesFound,
      freshRuntimeFiles,
      curatedManifestEntriesValid,
      duplicateManifestIds,
      errors: errors.length
    },
    manifestPath,
    curatedAssets: results,
    errors
  };
}

function printHumanReadable(summary: Summary) {
  console.log("Deskterior Pipeline Verification");
  console.log(`Status: ${summary.ok ? "PASS" : "FAIL"}`);
  console.log(`Manifest: ${summary.manifestPath}`);
  console.log("");
  console.log("Counts:");
  console.log(`- Curated assets checked: ${summary.counts.curatedAssets}`);
  console.log(`- Manifest entries: ${summary.counts.manifestEntries}`);
  console.log(`- Source .blend files found: ${summary.counts.sourceFilesFound}/${summary.counts.curatedAssets}`);
  console.log(`- Runtime .glb files found: ${summary.counts.runtimeFilesFound}/${summary.counts.curatedAssets}`);
  console.log(`- Fresh runtime exports: ${summary.counts.freshRuntimeFiles}/${summary.counts.curatedAssets}`);
  console.log(
    `- Curated manifest entries valid: ${summary.counts.curatedManifestEntriesValid}/${summary.counts.curatedAssets}`
  );
  console.log(`- Duplicate manifest ids: ${summary.counts.duplicateManifestIds}`);
  console.log(`- Errors: ${summary.counts.errors}`);
  console.log("");
  console.log("Curated assets:");
  for (const asset of summary.curatedAssets) {
    console.log(
      `- ${asset.key} -> ${asset.manifestId} | source=${asset.sourceExists ? "ok" : "missing"} | runtime=${
        asset.runtimeExists ? "ok" : "missing"
      } | fresh=${asset.runtimeFresh ? "ok" : "fail"} | manifest=${asset.manifestEntryExists ? "ok" : "missing"} | assetId=${
        asset.manifestAssetIdMatches ? "ok" : "fail"
      } | metadata=${asset.metadataValid ? "ok" : "fail"} | optionsHint=${asset.optionsHintValid ? "ok" : "fail"}`
    );
  }

  if (summary.errors.length === 0) {
    console.log("");
    console.log("No errors found.");
    return;
  }

  console.log("");
  console.log("Errors:");
  summary.errors.forEach((error, index) => {
    const context = [error.assetKey, error.manifestId, error.path].filter(Boolean).join(" | ");
    console.log(`${index + 1}. [${error.code}] ${error.message}${context ? ` (${context})` : ""}`);
  });
}

async function main() {
  const { json, help, unknownArgs } = parseArgs(process.argv.slice(2));

  if (help) {
    console.log("Usage: node --import tsx apps/web/scripts/verify-deskterior-pipeline.ts [--json]");
    process.exit(0);
  }

  if (unknownArgs.length > 0) {
    console.error(`Unknown arguments: ${unknownArgs.join(", ")}`);
    console.error("Usage: node --import tsx apps/web/scripts/verify-deskterior-pipeline.ts [--json]");
    process.exit(1);
  }

  const summary = await buildSummary();

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
