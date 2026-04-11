import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type GateProbeResult = {
  health: number;
  projects: number;
  jobs: number;
  intake: number;
  sceneLatest: number;
};

const APP_ENTRY = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "app.ts")).href;
const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const REQUIRED_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  CORS_ORIGINS: "http://127.0.0.1:3100"
};

const PROBE_SCRIPT = `
import { once } from "node:events";

const { createApp } = await import(process.env.APP_ENTRY);
const app = createApp();
const server = app.listen(0);

await once(server, "listening");
const address = server.address();
const baseUrl = typeof address === "object" && address ? \`http://127.0.0.1:\${address.port}\` : null;

if (!baseUrl) {
  console.error("Failed to resolve probe server port.");
  process.exit(1);
}

async function request(pathname, method = "GET") {
  const response = await fetch(\`\${baseUrl}\${pathname}\`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? "{}" : undefined
  });
  return response.status;
}

const result = {
  health: await request("/v1/health"),
  projects: await request("/v1/projects"),
  jobs: await request("/v1/jobs/test-job"),
  intake: await request("/v1/intake-sessions", "POST"),
  sceneLatest: await request("/v1/projects/test-project/scene/latest")
};

await new Promise((resolve, reject) => {
  server.close((error) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(undefined);
  });
});

console.log(JSON.stringify(result));
`;

function runRouteGateProbe(flags: { ENABLE_LIGHTWEIGHT_API_ROUTES: "true" | "false"; ENABLE_LEGACY_API_ROUTES: "true" | "false" }) {
  const probe = runRouteGateProbeRaw(flags);
  if (probe.status !== 0) {
    throw new Error(
      [
        "route gate probe failed",
        `status=${probe.status}`,
        `stdout=${probe.stdout}`,
        `stderr=${probe.stderr}`
      ].join("\n")
    );
  }

  return JSON.parse(probe.stdout.trim()) as GateProbeResult;
}

function runRouteGateProbeRaw(
  flags: {
    ENABLE_LIGHTWEIGHT_API_ROUTES: "true" | "false";
    ENABLE_LEGACY_API_ROUTES: "true" | "false";
  },
  extraEnv: Record<string, string> = {}
) {
  const probe = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", PROBE_SCRIPT], {
    cwd: WORKSPACE_ROOT,
    env: {
      ...process.env,
      ...REQUIRED_ENV,
      ...flags,
      ...extraEnv,
      APP_ENTRY
    },
    encoding: "utf8"
  });
  return probe;
}

test("default flags(false/false) keep compatibility and legacy routes closed", () => {
  const result = runRouteGateProbe({
    ENABLE_LIGHTWEIGHT_API_ROUTES: "false",
    ENABLE_LEGACY_API_ROUTES: "false"
  });

  assert.equal(result.health, 200);
  assert.equal(result.projects, 404);
  assert.equal(result.jobs, 404);
  assert.equal(result.intake, 404);
  assert.equal(result.sceneLatest, 404);
});

test("lightweight=true opens browse routes, legacy=false keeps jobs/intake/scene routes closed", () => {
  const result = runRouteGateProbe({
    ENABLE_LIGHTWEIGHT_API_ROUTES: "true",
    ENABLE_LEGACY_API_ROUTES: "false"
  });

  assert.equal(result.health, 200);
  assert.equal(result.projects, 401);
  assert.equal(result.jobs, 404);
  assert.equal(result.intake, 404);
  assert.equal(result.sceneLatest, 404);
});

test("legacy=true opens jobs/intake/scene routes, lightweight=false keeps browse routes closed", () => {
  const result = runRouteGateProbe({
    ENABLE_LIGHTWEIGHT_API_ROUTES: "false",
    ENABLE_LEGACY_API_ROUTES: "true"
  });

  assert.equal(result.health, 200);
  assert.equal(result.projects, 404);
  assert.equal(result.jobs, 401);
  assert.equal(result.intake, 401);
  assert.equal(result.sceneLatest, 401);
});

test("production rejects lightweight compatibility reopen", () => {
  const probe = runRouteGateProbeRaw(
    {
      ENABLE_LIGHTWEIGHT_API_ROUTES: "true",
      ENABLE_LEGACY_API_ROUTES: "false"
    },
    {
      NODE_ENV: "production"
    }
  );

  assert.notEqual(probe.status, 0);
  const output = `${probe.stderr ?? ""}\n${probe.stdout ?? ""}`;
  assert.match(output, /ENABLE_LIGHTWEIGHT_API_ROUTES must remain false in production/);
});
