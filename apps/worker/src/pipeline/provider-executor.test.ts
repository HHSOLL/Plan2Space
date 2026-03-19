import test from "node:test";
import assert from "node:assert/strict";
import { executeProviders } from "./provider-executor";

const SAMPLE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5nXioAAAAASUVORK5CYII=";

test("executeProviders selects hf dedicated candidate and merges paddle OCR semantics", async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SNAPTRUDE_API_URL: process.env.SNAPTRUDE_API_URL,
    PADDLEOCR_API_URL: process.env.PADDLEOCR_API_URL,
    HF_FLOORPLAN_ENDPOINT_URL: process.env.HF_FLOORPLAN_ENDPOINT_URL,
    HF_FLOORPLAN_ENDPOINT_TOKEN: process.env.HF_FLOORPLAN_ENDPOINT_TOKEN
  };

  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SNAPTRUDE_API_URL;
  process.env.PADDLEOCR_API_URL = "https://paddle.example.com/ocr";
  process.env.HF_FLOORPLAN_ENDPOINT_URL = "https://hf.example.com/floorplan";
  process.env.HF_FLOORPLAN_ENDPOINT_TOKEN = "secret";

  global.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url === "https://paddle.example.com/ocr") {
      return new Response(
        JSON.stringify({
          rec_texts: ["거실", "10,000"],
          rec_scores: [0.98, 0.99],
          dt_polys: [
            [
              [20, 20],
              [60, 20],
              [60, 40],
              [20, 40]
            ],
            [
              [0, 0],
              [200, 0],
              [200, 8],
              [0, 8]
            ]
          ]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (url === "https://hf.example.com/floorplan") {
      return new Response(
        JSON.stringify({
          topology: {
            scale: 0.05,
            scaleInfo: {
              value: 0.05,
              source: "ocr_dimension",
              confidence: 0.92,
              evidence: {
                mmValue: 10000,
                pxDistance: 200,
                p1: [0, 0],
                p2: [200, 0]
              }
            },
            walls: [
              { id: "w1", start: [0, 0], end: [200, 0], thickness: 12, type: "exterior" },
              { id: "w2", start: [200, 0], end: [200, 120], thickness: 12, type: "exterior" },
              { id: "w3", start: [200, 120], end: [0, 120], thickness: 12, type: "exterior" },
              { id: "w4", start: [0, 120], end: [0, 0], thickness: 12, type: "exterior" }
            ],
            openings: [{ id: "d1", position: [20, 0], width: 24, type: "door", isEntrance: true }]
          }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const result = await executeProviders({
      base64: SAMPLE_DATA_URL,
      mimeType: "image/png",
      debug: true
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.data.source, "hf_dedicated");
    assert.ok(result.data.semanticAnnotations.roomHints.some((roomHint) => roomHint.label === "거실"));
    assert.ok(result.data.semanticAnnotations.dimensionAnnotations.some((annotation) => annotation.mmValue === 10000));
    assert.ok(result.data.providerStatus.some((status) => status.provider === "paddleocr" && status.configured));
    assert.ok(result.data.providerStatus.some((status) => status.provider === "hf_dedicated" && status.configured));
  } finally {
    global.fetch = originalFetch;
    process.env.ANTHROPIC_API_KEY = originalEnv.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
    process.env.SNAPTRUDE_API_URL = originalEnv.SNAPTRUDE_API_URL;
    process.env.PADDLEOCR_API_URL = originalEnv.PADDLEOCR_API_URL;
    process.env.HF_FLOORPLAN_ENDPOINT_URL = originalEnv.HF_FLOORPLAN_ENDPOINT_URL;
    process.env.HF_FLOORPLAN_ENDPOINT_TOKEN = originalEnv.HF_FLOORPLAN_ENDPOINT_TOKEN;
  }
});
