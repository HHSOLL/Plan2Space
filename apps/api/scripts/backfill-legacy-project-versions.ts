import { backfillLegacyProjectVersion, listLegacyBackfillCandidates } from "../src/services/legacy-backfill-service";

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
      continue;
    }
    args.set(key, next);
    index += 1;
  }
  return {
    projectId: typeof args.get("project-id") === "string" ? (args.get("project-id") as string) : undefined,
    limit: typeof args.get("limit") === "string" ? Number(args.get("limit")) : undefined,
    dryRun: Boolean(args.get("dry-run"))
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const candidates = await listLegacyBackfillCandidates({
    projectId: options.projectId,
    limit: Number.isFinite(options.limit) ? options.limit : undefined
  });

  if (candidates.length === 0) {
    console.log(JSON.stringify({ count: 0, items: [] }, null, 2));
    return;
  }

  const results = [];
  for (const project of candidates) {
    const result = await backfillLegacyProjectVersion(project, options.dryRun);
    results.push(result);
  }

  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        count: results.length,
        items: results
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
