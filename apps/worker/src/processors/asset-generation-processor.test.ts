import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service-role-test-key";

test("extractAssetProviderModelUrl finds direct and nested model URLs", () => {
  return loadProcessorHelpers().then(({ extractAssetProviderModelUrl }) => {
  assert.equal(extractAssetProviderModelUrl({ model_url: "https://example.com/a.glb" }), "https://example.com/a.glb");
  assert.equal(
    extractAssetProviderModelUrl({ result: { glb_url: "https://example.com/b.glb" } }),
    "https://example.com/b.glb"
  );
  assert.equal(extractAssetProviderModelUrl({ data: { url: "https://example.com/c.glb" } }), "https://example.com/c.glb");
  assert.equal(extractAssetProviderModelUrl({ foo: "bar" }), null);
  });
});

test("extractAssetProviderJobId finds direct and nested async job IDs", () => {
  return loadProcessorHelpers().then(({ extractAssetProviderJobId }) => {
  assert.equal(extractAssetProviderJobId({ job_id: "job-1" }), "job-1");
  assert.equal(extractAssetProviderJobId({ result: { id: "job-2" } }), "job-2");
  assert.equal(extractAssetProviderJobId({ data: { id: "job-3" } }), "job-3");
  assert.equal(extractAssetProviderJobId({ foo: "bar" }), null);
  });
});

async function loadProcessorHelpers() {
  return (await import("./asset-generation-processor")) as {
    extractAssetProviderJobId: (data: unknown) => string | null;
    extractAssetProviderModelUrl: (data: unknown) => string | null;
  };
}
