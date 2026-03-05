import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { computeImageHash } from "../../../../lib/ai/imageHash";
import { findCachedTopology, storeCachedTopology } from "../../../../lib/ai/floorplanCache";
import {
  findCatalogTemplateCandidates,
  findImageTemplateCandidates,
  loadTemplateTopology,
  type CatalogTemplateQuery,
  type TemplateCandidate
} from "../../../../lib/ai/template/retrieval";

export const runtime = "nodejs";

const WallSchema = z.object({
  id: z.string().min(1),
  start: z.tuple([z.number(), z.number()]),
  end: z.tuple([z.number(), z.number()]),
  thickness: z.number(),
  type: z.enum(["exterior", "interior", "balcony", "column"]),
  length: z.number(),
  isPartOfBalcony: z.boolean(),
  confidence: z.number().optional(),
  notes: z.string().optional()
});

const OpeningSchema = z.object({
  id: z.string().min(1),
  wallId: z.string().min(1),
  type: z.enum(["door", "window", "sliding_door", "double_door", "passage"]),
  position: z.tuple([z.number(), z.number()]),
  width: z.number(),
  direction: z.number().optional(),
  swingDirection: z.enum(["left", "right", "none", "sliding"]).optional(),
  location: z.enum(["exterior", "interior", "balcony"]).optional(),
  isEntrance: z.boolean().optional(),
  // For legacy compatibility in calculation
  offset: z.number().optional(),
  height: z.number().optional(),
  detectConfidence: z.number().optional(),
  attachConfidence: z.number().optional(),
  typeConfidence: z.number().optional()
});

const BalconySchema = z.object({
  id: z.string(),
  wallIds: z.array(z.string()),
  accessOpeningId: z.string().optional(),
  boundingBox: z.object({
    topLeft: z.tuple([z.number(), z.number()]),
    bottomRight: z.tuple([z.number(), z.number()])
  }),
  type: z.enum(["entrance", "service", "living", "bedroom"])
});

const ColumnSchema = z.object({
  id: z.string(),
  position: z.tuple([z.number(), z.number()]),
  width: z.number(),
  height: z.number(),
  shape: z.enum(["rectangular", "circular"])
});

const RoomSchema = z.object({
  id: z.string(),
  boundingBox: z.object({
    topLeft: z.tuple([z.number(), z.number()]),
    bottomRight: z.tuple([z.number(), z.number()])
  }),
  wallIds: z.array(z.string()),
  openingIds: z.array(z.string()),
  type: z.enum(["main", "balcony"])
});

const ScaleSourceSchema = z.enum(["ocr_dimension", "door_heuristic", "user_measure", "unknown"]);

const ScaleEvidenceSchema = z.object({
  mmValue: z.number().optional(),
  pxDistance: z.number().optional(),
  p1: z.tuple([z.number(), z.number()]).optional(),
  p2: z.tuple([z.number(), z.number()]).optional(),
  ocrText: z.string().optional(),
  ocrBox: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number()
    })
    .optional(),
  notes: z.string().optional()
});

const ScaleInfoSchema = z.object({
  value: z.number(),
  source: ScaleSourceSchema,
  confidence: z.number(),
  evidence: ScaleEvidenceSchema.optional()
});

const TopologySchema = z.object({
  metadata: z.object({
    imageWidth: z.number(),
    imageHeight: z.number(),
    scale: z.number(),
    scaleInfo: ScaleInfoSchema.optional(),
    unit: z.string(),
    confidence: z.number(),
    analysisCompleteness: z.object({
      totalWallSegments: z.number(),
      exteriorWalls: z.number(),
      interiorWalls: z.number(),
      totalOpenings: z.number(),
      doors: z.number(),
      windows: z.number(),
      balconies: z.number(),
      columns: z.number(),
      dimensionChecks: z.number().optional()
    })
  }),
  walls: z.array(WallSchema).min(1),
  openings: z.array(OpeningSchema),
  balconies: z.array(BalconySchema).optional(),
  columns: z.array(ColumnSchema).optional(),
  rooms: z.array(RoomSchema).optional(),
  // Legacy fields for backward compatibility during transition
  scale: z.number().optional(),
  scaleInfo: ScaleInfoSchema.optional()
});

const CatalogQuerySchema = z.object({
  apartmentName: z.string().min(1),
  typeName: z.string().min(1),
  region: z.string().optional()
});

const RequestSchema = z.object({
  mode: z.enum(["upload", "catalog"]).optional(),
  base64: z.string().optional(),
  mimeType: z.enum(["image/jpeg", "image/png"]).optional(),
  catalogQuery: CatalogQuerySchema.optional(),
  skipCache: z.boolean().optional(),
  forceProvider: z.string().optional(),
  debug: z.boolean().optional()
}).superRefine((payload, ctx) => {
  const mode = payload.mode ?? "upload";
  if (mode === "upload") {
    if (!payload.base64 || payload.base64.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "base64 is required for upload mode.",
        path: ["base64"]
      });
    }
  }
  if (mode === "catalog" && !payload.catalogQuery) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "catalogQuery is required for catalog mode.",
      path: ["catalogQuery"]
    });
  }
});

type Vec2 = [number, number];
type WallType = "exterior" | "interior" | "balcony" | "column";
type OpeningType = "door" | "window" | "sliding_door" | "double_door" | "passage";
type SwingDirection = "left" | "right" | "none" | "sliding";
type OpeningLocation = "exterior" | "interior" | "balcony";
type ScaleSource = "ocr_dimension" | "door_heuristic" | "user_measure" | "unknown";

type ScaleEvidence = {
  mmValue?: number;
  pxDistance?: number;
  p1?: Vec2;
  p2?: Vec2;
  ocrText?: string;
  ocrBox?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  notes?: string;
};

type ScaleInfo = {
  value: number;
  source: ScaleSource;
  confidence: number;
  evidence?: ScaleEvidence;
};

type Wall = {
  id: string;
  start: Vec2;
  end: Vec2;
  thickness: number;
  type: WallType;
  length: number;
  isPartOfBalcony: boolean;
  confidence: number | undefined;
  notes: string | undefined;
};

type Opening = {
  id: string;
  wallId: string;
  type: OpeningType;
  position: Vec2;
  width: number;
  direction: number | undefined;
  swingDirection: SwingDirection | undefined;
  location: OpeningLocation | undefined;
  isEntrance: boolean | undefined;
  offset: number | undefined;
  height: number | undefined;
  detectConfidence: number | undefined;
  attachConfidence: number | undefined;
  typeConfidence: number | undefined;
};

type Balcony = {
  id: string;
  wallIds: string[];
  accessOpeningId?: string;
  boundingBox: {
    topLeft: Vec2;
    bottomRight: Vec2;
  };
  type: "entrance" | "service" | "living" | "bedroom";
};

type Column = {
  id: string;
  position: Vec2;
  width: number;
  height: number;
  shape: "rectangular" | "circular";
};

type Room = {
  id: string;
  boundingBox: {
    topLeft: Vec2;
    bottomRight: Vec2;
  };
  wallIds: string[];
  openingIds: string[];
  type: "main" | "balcony";
};

type TopologyMetadata = {
  imageWidth: number;
  imageHeight: number;
  scale: number;
  scaleInfo?: ScaleInfo;
  unit: string;
  confidence: number;
  analysisCompleteness: {
    totalWallSegments: number;
    exteriorWalls: number;
    interiorWalls: number;
    totalOpenings: number;
    doors: number;
    windows: number;
    balconies: number;
    columns: number;
    dimensionChecks?: number;
  };
};

type Topology = {
  metadata: TopologyMetadata;
  walls: Wall[];
  openings: Opening[];
  balconies?: Balcony[];
  columns?: Column[];
  rooms?: Room[];
  scale?: number;
  scaleInfo?: ScaleInfo;
};

type CandidateMetrics = {
  wallCount: number;
  openingCount: number;
  axisAlignedRatio: number;
  orphanWallCount: number;
  selfIntersectionCount: number;
  openingsAttachedRatio: number;
  wallThicknessOutlierRate: number;
  openingOverlapCount: number;
  openingOutOfWallRangeCount: number;
  exteriorAreaSanity: boolean;
  openingTypeConfidenceMean: number;
  loopCountPenalty: number;
  scaleConfidence: number;
  scaleEvidenceCompleteness: number;
  scaleSource: ScaleSource;
  exteriorDetected: boolean;
  exteriorLoopClosed: boolean;
  entranceDetected: boolean;
};

type CandidateScoreBreakdown = {
  topologyScore: number;
  openingScore: number;
  scaleScore: number;
  penalty: number;
  total: number;
};

type ScaleCandidate = {
  source: ScaleSource;
  value: number;
  confidence: number;
  evidence?: ScaleInfo["evidence"];
  score: number;
  reason: string;
};

type Candidate = {
  provider: string;
  passId: string;
  preprocessProfile: PreprocessProfile;
  raw: unknown | null;
  normalized: Topology | null;
  refined: Topology | null;
  cleaned: Topology | null;
  validated: {
    success: boolean;
    errors: string[];
  };
  metrics: CandidateMetrics;
  scoreBreakdown: CandidateScoreBreakdown;
  scaleCandidates: ScaleCandidate[];
  score: number;
  timingMs: number;
};

type ProviderStatus = {
  provider: string;
  configured: boolean;
  status: "enabled" | "skipped";
  reason: string | null;
};

type PreprocessProfile = "balanced" | "lineart";

const FLOORPLAN_TOOL = {
  name: "floorplan_topology",
  description: "Return the parsed floor plan topology as structured JSON.",
  input_schema: {
    type: "object",
    properties: {
      metadata: {
        type: "object",
        properties: {
          imageWidth: { type: "number" },
          imageHeight: { type: "number" },
          scale: { type: "number" },
          scaleInfo: {
            type: "object",
            properties: {
              value: { type: "number" },
              source: { type: "string", enum: ["ocr_dimension", "door_heuristic", "user_measure", "unknown"] },
              confidence: { type: "number" },
              evidence: {
                type: "object",
                properties: {
                  mmValue: { type: "number" },
                  pxDistance: { type: "number" },
                  p1: {
                    type: "array",
                    items: { type: "number" },
                    minItems: 2,
                    maxItems: 2
                  },
                  p2: {
                    type: "array",
                    items: { type: "number" },
                    minItems: 2,
                    maxItems: 2
                  },
                  ocrText: { type: "string" },
                  ocrBox: {
                    type: "object",
                    properties: {
                      x: { type: "number" },
                      y: { type: "number" },
                      w: { type: "number" },
                      h: { type: "number" }
                    }
                  },
                  notes: { type: "string" }
                }
              }
            }
          },
          unit: { type: "string" },
          confidence: { type: "number" },
          analysisCompleteness: {
            type: "object",
            properties: {
              totalWallSegments: { type: "number" },
              exteriorWalls: { type: "number" },
              interiorWalls: { type: "number" },
              totalOpenings: { type: "number" },
              doors: { type: "number" },
              windows: { type: "number" },
              balconies: { type: "number" },
              columns: { type: "number" }
            }
          }
        }
      },
      walls: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            start: {
              type: "array",
              items: { type: "number" },
              minItems: 2,
              maxItems: 2
            },
            end: {
              type: "array",
              items: { type: "number" },
              minItems: 2,
              maxItems: 2
            },
            thickness: { type: "number" },
            type: { type: "string", enum: ["exterior", "interior", "balcony", "column"] },
            length: { type: "number" },
            isPartOfBalcony: { type: "boolean" },
            confidence: { type: "number" },
            notes: { type: "string" }
          },
          required: ["start", "end", "thickness", "type"]
        }
      },
      openings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            wallId: { type: "string" },
            type: { type: "string", enum: ["door", "window", "sliding_door", "double_door", "passage"] },
            position: {
              type: "array",
              items: { type: "number" },
              minItems: 2,
              maxItems: 2
            },
            width: { type: "number" },
            offset: { type: "number" },
            height: { type: "number" },
            detectConfidence: { type: "number" },
            attachConfidence: { type: "number" },
            typeConfidence: { type: "number" },
            swingDirection: { type: "string", enum: ["left", "right", "none", "sliding"] },
            location: { type: "string", enum: ["exterior", "interior", "balcony"] },
            isEntrance: { type: "boolean" }
          },
          required: ["type", "width"]
        }
      },
      balconies: { type: "array", items: { type: "object" } },
      columns: { type: "array", items: { type: "object" } },
      rooms: { type: "array", items: { type: "object" } }
    },
    required: ["walls", "openings"]
  }
} as const;

const MIN_WALL_LENGTH = 30;
const MIN_WALL_THICKNESS = Number(process.env.FLOORPLAN_MIN_WALL_THICKNESS ?? 6);
const ORPHAN_MAX_LENGTH = Number(process.env.FLOORPLAN_ORPHAN_MAX_LENGTH ?? 60);
const DEFAULT_WALL_THICKNESS = 12;
const DEFAULT_DOOR_HEIGHT = 210;
const DEFAULT_WINDOW_HEIGHT = 120;
const PROVIDER_ORDER = (process.env.FLOORPLAN_PROVIDER_ORDER ?? "anthropic,openai,snaptrude")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const PROVIDER_TIMEOUT_MS = Math.max(1000, Math.floor(getEnvNumber("FLOORPLAN_PROVIDER_TIMEOUT_MS", 45000)));
const SNAP_TOLERANCE = Number(process.env.FLOORPLAN_SNAP_TOLERANCE ?? 4);
const MERGE_GAP_TOLERANCE = Number(process.env.FLOORPLAN_MERGE_GAP_TOLERANCE ?? 6);
const MERGE_ALIGN_TOLERANCE = Number(process.env.FLOORPLAN_MERGE_ALIGN_TOLERANCE ?? 2);
const OPENING_ATTACH_DISTANCE = Number(process.env.FLOORPLAN_OPENING_ATTACH_DISTANCE ?? 20);
const OPENING_MIN_CONFIDENCE = Math.max(0, Math.min(1, getEnvNumber("FLOORPLAN_OPENING_MIN_CONFIDENCE", 0.45)));
const MIN_ACCEPT_SCORE = Number.isFinite(Number(process.env.FLOORPLAN_MIN_ACCEPT_SCORE))
  ? Number(process.env.FLOORPLAN_MIN_ACCEPT_SCORE)
  : 25;
const EARLY_STOP_SCORE = Number.isFinite(Number(process.env.FLOORPLAN_EARLY_STOP_SCORE))
  ? Number(process.env.FLOORPLAN_EARLY_STOP_SCORE)
  : 80;

function getEnvNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

const SCORE_WEIGHTS = {
  exteriorDetected: getEnvNumber("FLOORPLAN_SCORE_EXTERIOR_DETECTED", 20),
  exteriorLoopClosed: getEnvNumber("FLOORPLAN_SCORE_EXTERIOR_LOOP_CLOSED", 20),
  entranceDetected: getEnvNumber("FLOORPLAN_SCORE_ENTRANCE_DETECTED", 10),
  wallCount: getEnvNumber("FLOORPLAN_SCORE_WALL_COUNT", 0.5),
  openingCount: getEnvNumber("FLOORPLAN_SCORE_OPENING_COUNT", 0.7),
  axisAlignedRatio: getEnvNumber("FLOORPLAN_SCORE_AXIS_ALIGNED_RATIO", 10),
  wallThicknessOutlierRate: getEnvNumber("FLOORPLAN_SCORE_WALL_THICKNESS_OUTLIER_RATE", 12),
  exteriorAreaBonus: getEnvNumber("FLOORPLAN_SCORE_EXTERIOR_AREA_BONUS", 6),
  openingTypeConfidence: getEnvNumber("FLOORPLAN_SCORE_OPENING_TYPE_CONFIDENCE", 8),
  scaleConfidence: getEnvNumber("FLOORPLAN_SCORE_SCALE_CONFIDENCE", 10),
  scaleEvidenceCompleteness: getEnvNumber("FLOORPLAN_SCORE_SCALE_EVIDENCE_COMPLETENESS", 6),
  scaleUnknownPenalty: getEnvNumber("FLOORPLAN_SCORE_SCALE_UNKNOWN_PENALTY", 6),
  selfIntersectionPenalty: getEnvNumber("FLOORPLAN_SCORE_SELF_INTERSECTION_PENALTY", 15),
  orphanPenalty: getEnvNumber("FLOORPLAN_SCORE_ORPHAN_WALL_PENALTY", 2),
  openingAttachPenalty: getEnvNumber("FLOORPLAN_SCORE_OPENING_ATTACH_PENALTY", 20),
  openingOverlapPenalty: getEnvNumber("FLOORPLAN_SCORE_OPENING_OVERLAP_PENALTY", 6),
  openingOutOfRangePenalty: getEnvNumber("FLOORPLAN_SCORE_OPENING_OUT_OF_RANGE_PENALTY", 8),
  loopPenalty: getEnvNumber("FLOORPLAN_SCORE_LOOP_PENALTY", 10),
  exteriorAreaPenalty: getEnvNumber("FLOORPLAN_SCORE_EXTERIOR_AREA_PENALTY", 10)
} as const;

const TEMPLATE_MAX_CANDIDATES = Math.max(1, Math.floor(getEnvNumber("FLOORPLAN_TEMPLATE_MAX_CANDIDATES", 5)));
const TEMPLATE_MIN_CATALOG_SCORE = getEnvNumber("FLOORPLAN_TEMPLATE_MIN_CATALOG_SCORE", 0.78);
const TEMPLATE_MIN_IMAGE_SCORE = getEnvNumber("FLOORPLAN_TEMPLATE_MIN_IMAGE_SCORE", 0.92);

type PreprocessResult = {
  processed: string | null;
  structural: string | null;
  profile: PreprocessProfile;
};
function getModelCandidates() {
  const envValue = process.env.ANTHROPIC_MODEL;
  if (!envValue) return [];
  return envValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isModelNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as {
    status?: number;
    error?: { error?: { type?: string; message?: string } };
    message?: string;
  };
  if (record.status === 404 && record.error?.error?.type === "not_found_error") {
    return true;
  }
  return typeof record.message === "string" && record.message.includes("model:");
}

function getProviderOrder(forceProvider?: string) {
  const source = forceProvider ? [forceProvider] : PROVIDER_ORDER.length > 0 ? PROVIDER_ORDER : ["anthropic"];
  return Array.from(new Set(source.map((entry) => entry.toLowerCase()).filter(Boolean)));
}

function resolveProviderStatus(provider: string): ProviderStatus {
  const normalized = provider.toLowerCase();
  if (normalized === "anthropic") {
    const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
    const hasModel = getModelCandidates().length > 0;
    const configured = hasApiKey && hasModel;
    if (!configured) {
      return {
        provider,
        configured,
        status: "skipped",
        reason: !hasApiKey ? "ANTHROPIC_API_KEY is missing." : "ANTHROPIC_MODEL is missing."
      };
    }
    return { provider, configured: true, status: "enabled", reason: null };
  }
  if (normalized === "openai") {
    const configured = Boolean(process.env.OPENAI_API_KEY);
    return {
      provider,
      configured,
      status: configured ? "enabled" : "skipped",
      reason: configured ? null : "OPENAI_API_KEY is missing."
    };
  }
  if (normalized === "snaptrude") {
    const hasUrl = Boolean(process.env.SNAPTRUDE_API_URL);
    const hasKey = Boolean(process.env.SNAPTRUDE_API_KEY);
    const configured = hasUrl && hasKey;
    return {
      provider,
      configured,
      status: configured ? "enabled" : "skipped",
      reason: configured
        ? null
        : !hasUrl
          ? "SNAPTRUDE_API_URL is missing."
          : "SNAPTRUDE_API_KEY is missing."
    };
  }
  return {
    provider,
    configured: false,
    status: "skipped",
    reason: `Unknown provider "${provider}".`
  };
}

function formatProviderError(provider: string, error: unknown) {
  if (error && typeof error === "object" && "name" in error && (error as { name?: string }).name === "AbortError") {
    return `${provider}: provider timeout after ${PROVIDER_TIMEOUT_MS}ms`;
  }
  const message = error instanceof Error ? error.message : "Unknown provider error";
  if (message.toLowerCase().includes("fetch failed")) {
    return `${provider}: provider unavailable (network failure)`;
  }
  return `${provider}: ${message}`;
}

async function preprocessImage(base64: string, profile: PreprocessProfile): Promise<PreprocessResult> {
  try {
    // Remove data URL prefix if present for Buffer conversion
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    const resolveProfileNumber = (key: string, balancedDefault: number, lineArtDefault: number) => {
      if (profile === "lineart") {
        return getEnvNumber(
          `FLOORPLAN_PREPROCESS_LINEART_${key}`,
          getEnvNumber(`FLOORPLAN_PREPROCESS_${key}`, lineArtDefault)
        );
      }
      return getEnvNumber(`FLOORPLAN_PREPROCESS_${key}`, balancedDefault);
    };

    const clampNumber = (value: number, min: number, max: number) =>
      Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;
    const threshold = clampNumber(resolveProfileNumber("THRESHOLD", 200, 218), 0, 255);
    const median = Math.round(clampNumber(resolveProfileNumber("MEDIAN", 3, 2), 0, 5));
    const blur = clampNumber(resolveProfileNumber("BLUR", 0.3, 0.15), 0, 2);
    const backgroundBlur = clampNumber(resolveProfileNumber("BG_BLUR", 12, 8), 0, 20);
    const contrast = clampNumber(resolveProfileNumber("CONTRAST", 1.25, 1.45), 0.5, 2);
    const brightness = clampNumber(resolveProfileNumber("BRIGHTNESS", -15, -20), -50, 50);
    const downscale = clampNumber(resolveProfileNumber("DOWNSCALE", 0.35, 0.5), 0.1, 1);
    const claheSlope = clampNumber(resolveProfileNumber("CLAHE", 3, 5), 0, 100);
    const structuralBlur = clampNumber(resolveProfileNumber("STRUCTURAL_BLUR", 0.6, 1), 0, 2);

    // Process image: Grayscale -> Background suppression -> Denoise -> Contrast -> Threshold
    // Background suppression helps reduce watermarks and colored fills.
    const base = sharp(buffer).grayscale().normalize();
    const metadata = await base.metadata();
    const background =
      backgroundBlur > 0 ? await base.clone().blur(backgroundBlur).toBuffer() : null;
    const applyBasePipeline = (input: sharp.Sharp) => {
      let pipeline = input;
      if (background) {
        pipeline = pipeline.composite([{ input: background, blend: "difference" }]).normalize();
      }
      if (median > 0) {
        pipeline = pipeline.median(median);
      }
      if (blur > 0) {
        pipeline = pipeline.blur(blur);
      }
      return pipeline;
    };

    const processedBuffer = await applyBasePipeline(base.clone())
      .linear(contrast, brightness)
      .sharpen()
      .threshold(threshold)
      .toFormat("png")
      .toBuffer();

    let structuralPipeline = applyBasePipeline(base.clone());
    if (claheSlope > 0) {
      structuralPipeline = structuralPipeline.clahe({ width: 8, height: 8, maxSlope: claheSlope });
    }
    if (downscale < 1 && metadata.width && metadata.height) {
      const smallWidth = Math.max(32, Math.round(metadata.width * downscale));
      const smallHeight = Math.max(32, Math.round(metadata.height * downscale));
      structuralPipeline = structuralPipeline
        .resize(smallWidth, smallHeight, { kernel: "cubic" })
        .blur(structuralBlur)
        .resize(metadata.width, metadata.height, { kernel: "cubic" });
    }
    const structuralBuffer = await structuralPipeline
      .linear(contrast, brightness)
      .sharpen()
      .threshold(threshold)
      .toFormat("png")
      .toBuffer();

    return {
      processed: processedBuffer.toString("base64"),
      structural: structuralBuffer.toString("base64"),
      profile
    };
  } catch (error) {
    console.warn(`Image preprocessing failed (${profile}), falling back to original:`, error);
    return {
      processed: base64.replace(/^data:image\/\w+;base64,/, ""),
      structural: null,
      profile
    };
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function callJsonProvider(params: {
  label: string;
  url: string;
  apiKey?: string;
  payload: Record<string, unknown>;
}) {
  const { label, url, apiKey, payload } = params;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${label} provider failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function runAnthropicProvider(dataOriginal: string, dataProcessed: PreprocessResult | null, mimeType: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });

  const content: any[] = [];

  // 1. Original Image (Context & Dimensions)
  content.push({
    type: "image",
    source: {
      type: "base64",
      media_type: mimeType as "image/jpeg" | "image/png",
      data: dataOriginal
    }
  });

  // 2. Processed Image (Structure Detection)
  if (dataProcessed?.processed) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: dataProcessed.processed
      }
    });
  }

  // 3. Structural Image (Downsampled to suppress thin annotations)
  if (dataProcessed?.structural) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: dataProcessed.structural
      }
    });
  }

  // 3. Prompt
  content.push({
    type: "text",
    text: buildPrompt()
  });

  const buildPayload = (withTools: boolean) => ({
    max_tokens: 8192,
    temperature: 0.1, // Lower temperature for stricter rule following
    ...(withTools
      ? {
          tool_choice: {
            type: "tool" as const,
            name: FLOORPLAN_TOOL.name,
            disable_parallel_tool_use: true
          },
          tools: [FLOORPLAN_TOOL]
        }
      : {}),
    messages: [
      {
        role: "user" as const,
        content
      }
    ]
  });

  const shouldRetryWithoutTools = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();
    return normalized.includes("tool") && (normalized.includes("unsupported") || normalized.includes("tool_choice"));
  };

  let message: any;
  try {
    message = await createMessageWithFallback(anthropic, buildPayload(true));
  } catch (error) {
    if (!shouldRetryWithoutTools(error)) {
      throw error;
    }
    message = await createMessageWithFallback(anthropic, buildPayload(false));
  }

  const contentBlocks = (message as any).content ?? [];
  const toolUse = contentBlocks.find(
    (part: any) => part?.type === "tool_use" && part?.name === FLOORPLAN_TOOL.name
  );
  if (toolUse?.input && typeof toolUse.input === "object") {
    return toolUse.input as Record<string, unknown>;
  }

  const text = contentBlocks.map((part: any) => (part.type === "text" ? part.text : "")).join("\n").trim();
  if (!text) throw new Error("Anthropic returned empty response");
  return parseJsonStrict(text);
}

async function runOpenAIProvider(dataOriginal: string, dataProcessed: PreprocessResult | null, mimeType: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const content: any[] = [];

  // 3. Prompt (OpenAI supports text first usually, valid order)
  content.push({
    type: "text",
    text: buildPrompt()
  });

  // 1. Original Image
  content.push({
    type: "image_url",
    image_url: {
      url: `data:${mimeType};base64,${dataOriginal}`
    }
  });

  // 2. Processed Image
  if (dataProcessed?.processed) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${dataProcessed.processed}`
      }
    });
  }

  // 3. Structural Image
  if (dataProcessed?.structural) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${dataProcessed.structural}`
      }
    });
  }

  const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a floorplan analyst. Output JSON only."
        },
        {
          role: "user",
          content
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI provider failed (${response.status}): ${text}`);
  }
  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned empty response");
  return parseJsonStrict(text);
}

async function runCubiCasaProvider(data: string, mimeType: string) {
  const url = process.env.CUBICASA_API_URL;
  if (!url) return null;
  const apiKey = process.env.CUBICASA_API_KEY;
  return callJsonProvider({
    label: "CubiCasa",
    url,
    apiKey,
    payload: { base64: data, mimeType }
  });
}

async function runSnaptrudeProvider(data: string, mimeType: string) {
  const url = process.env.SNAPTRUDE_API_URL;
  if (!url) return null;
  const apiKey = process.env.SNAPTRUDE_API_KEY;
  return callJsonProvider({
    label: "Snaptrude",
    url,
    apiKey,
    payload: { base64: data, mimeType }
  });
}

async function createMessageWithFallback(
  anthropic: Anthropic,
  payload: Omit<Parameters<typeof anthropic.messages.create>[0], "model">
) {
  let lastError: unknown = null;
  const candidates = getModelCandidates();
  if (candidates.length === 0) {
    throw new Error("ANTHROPIC_MODEL is missing.");
  }

  for (const model of candidates) {
    try {
      return await anthropic.messages.create({ model, ...payload });
    } catch (error) {
      lastError = error;
      if (isModelNotFoundError(error)) {
        console.warn(`[parse-floorplan] Model not found: ${model}`);
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error("No Anthropic models available.");
}

function parseDataUrl(base64: string, fallbackMime: string | undefined) {
  const match = base64.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
  if (match) {
    return { data: match[2] ?? "", mimeType: match[1] ?? fallbackMime ?? "image/png" };
  }
  return { data: base64, mimeType: fallbackMime ?? "image/png" };
}

function parseJsonStrict(text: string): unknown {
  const cleaned = text
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .replace(/\u0000/g, "")
    .replace(/,\s*([}\]])/g, "$1");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in model output.");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
}

function coerceNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : fallback;
}

function coerceFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : null;
}

function coerceVec2(value: unknown): [number, number] | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = coerceFiniteNumber(value[0]);
    const y = coerceFiniteNumber(value[1]);
    if (x !== null && y !== null) return [x, y] as [number, number];
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const x = coerceFiniteNumber(record.x ?? record.X ?? record.left ?? record.col ?? record.cx);
    const y = coerceFiniteNumber(record.y ?? record.Y ?? record.top ?? record.row ?? record.cy);
    if (x !== null && y !== null) return [x, y] as [number, number];
  }
  if (typeof value === "string") {
    const match = value.match(/(-?\d+(?:\.\d+)?)[, ]+(-?\d+(?:\.\d+)?)/);
    if (match) {
      const x = coerceFiniteNumber(match[1]);
      const y = coerceFiniteNumber(match[2]);
      if (x !== null && y !== null) return [x, y] as [number, number];
    }
  }
  return null;
}

function toConfidence(value: unknown, fallback: number) {
  const numeric = coerceNumber(value, fallback);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function coerceScaleSource(value: unknown): ScaleSource | null {
  if (value === "ocr_dimension") return "ocr_dimension";
  if (value === "door_heuristic") return "door_heuristic";
  if (value === "user_measure") return "user_measure";
  if (value === "unknown") return "unknown";
  return null;
}

function buildScaleInfo(params: {
  scale: number;
  metadataRaw: Record<string, unknown>;
  analysisRaw: Record<string, unknown>;
  raw: Record<string, unknown>;
}): ScaleInfo {
  const { scale, metadataRaw, analysisRaw, raw } = params;
  const sourceCandidates = [
    coerceScaleSource(metadataRaw.scaleSource),
    coerceScaleSource(metadataRaw.scale_source),
    coerceScaleSource(raw.scaleSource),
    coerceScaleSource(raw.scale_source)
  ];
  const providedSource = sourceCandidates.find((entry): entry is ScaleSource => Boolean(entry)) ?? null;
  const dimensionChecks = coerceFiniteNumber(analysisRaw.dimensionChecks ?? metadataRaw.dimensionChecks) ?? 0;

  const fallbackSource: ScaleSource = dimensionChecks > 0 ? "ocr_dimension" : "unknown";
  let source: ScaleSource = providedSource ?? fallbackSource;

  const defaultConfidence = source === "unknown" ? 0 : source === "ocr_dimension" ? 0.7 : 0.6;
  let confidence = toConfidence(
    metadataRaw.scaleConfidence ?? metadataRaw.scale_confidence ?? metadataRaw.confidence ?? raw.confidence,
    defaultConfidence
  );

  const scaleInfoRaw =
    metadataRaw.scaleInfo && typeof metadataRaw.scaleInfo === "object"
      ? (metadataRaw.scaleInfo as Record<string, unknown>)
      : {};
  const scaleEvidenceRaw =
    scaleInfoRaw.evidence && typeof scaleInfoRaw.evidence === "object"
      ? (scaleInfoRaw.evidence as Record<string, unknown>)
      : {};

  const mmValue = coerceFiniteNumber(
    scaleEvidenceRaw.mmValue ?? scaleEvidenceRaw.mm ?? scaleInfoRaw.mmValue ?? metadataRaw.mmValue
  );
  const pxDistance = coerceFiniteNumber(
    scaleEvidenceRaw.pxDistance ??
      scaleEvidenceRaw.pixelDistance ??
      scaleInfoRaw.pxDistance ??
      metadataRaw.pxDistance
  );
  const p1 = coerceVec2(scaleEvidenceRaw.p1 ?? scaleEvidenceRaw.start ?? scaleEvidenceRaw.from);
  const p2 = coerceVec2(scaleEvidenceRaw.p2 ?? scaleEvidenceRaw.end ?? scaleEvidenceRaw.to);
  const ocrText =
    typeof scaleEvidenceRaw.ocrText === "string"
      ? scaleEvidenceRaw.ocrText
      : typeof scaleEvidenceRaw.text === "string"
        ? scaleEvidenceRaw.text
        : undefined;
  const ocrBox =
    scaleEvidenceRaw.ocrBox && typeof scaleEvidenceRaw.ocrBox === "object"
      ? {
          x: coerceNumber((scaleEvidenceRaw.ocrBox as Record<string, unknown>).x, 0),
          y: coerceNumber((scaleEvidenceRaw.ocrBox as Record<string, unknown>).y, 0),
          w: coerceNumber((scaleEvidenceRaw.ocrBox as Record<string, unknown>).w, 0),
          h: coerceNumber((scaleEvidenceRaw.ocrBox as Record<string, unknown>).h, 0)
        }
      : undefined;
  const notes =
    typeof scaleEvidenceRaw.notes === "string"
      ? scaleEvidenceRaw.notes
      : source === "unknown"
        ? "Scale could not be derived reliably from model output."
        : undefined;

  const evidence =
    mmValue !== null ||
    pxDistance !== null ||
    Boolean(p1) ||
    Boolean(p2) ||
    Boolean(ocrText) ||
    Boolean(ocrBox) ||
    Boolean(notes)
      ? {
          ...(mmValue !== null ? { mmValue } : {}),
          ...(pxDistance !== null ? { pxDistance } : {}),
          ...(p1 ? { p1 } : {}),
          ...(p2 ? { p2 } : {}),
          ...(ocrText ? { ocrText } : {}),
          ...(ocrBox ? { ocrBox } : {}),
          ...(notes ? { notes } : {})
        }
      : undefined;

  const hasStrongDimensionEvidence =
    mmValue !== null &&
    pxDistance !== null &&
    (Boolean(ocrText) || (Boolean(p1) && Boolean(p2)));
  if (source === "unknown" && hasStrongDimensionEvidence) {
    source = "ocr_dimension";
    confidence = Math.max(confidence, 0.65);
  }

  return {
    value: scale,
    source,
    confidence,
    ...(evidence ? { evidence } : {})
  };
}

function coerceLine(entry: Record<string, unknown>) {
  const start = coerceVec2(entry.start ?? entry.from ?? entry.a ?? entry.p1 ?? entry.point1 ?? entry.startPoint);
  const end = coerceVec2(entry.end ?? entry.to ?? entry.b ?? entry.p2 ?? entry.point2 ?? entry.endPoint);
  if (start && end) return { start, end };

  const x1 = coerceFiniteNumber(entry.x1 ?? entry.startX ?? entry.x_start ?? entry.xStart ?? entry.x0);
  const y1 = coerceFiniteNumber(entry.y1 ?? entry.startY ?? entry.y_start ?? entry.yStart ?? entry.y0);
  const x2 = coerceFiniteNumber(entry.x2 ?? entry.endX ?? entry.x_end ?? entry.xEnd);
  const y2 = coerceFiniteNumber(entry.y2 ?? entry.endY ?? entry.y_end ?? entry.yEnd);
  if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
    return { start: [x1, y1] as [number, number], end: [x2, y2] as [number, number] };
  }
  return null;
}

function coerceArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>);
}

function pickArray(record: Record<string, unknown>, keys: string[]) {
  let fallback: unknown[] | null = null;
  for (const key of keys) {
    if (!(key in record)) continue;
    const candidate = coerceArray(record[key]);
    if (candidate.length > 0) return candidate;
    if (!fallback) fallback = candidate;
  }
  return fallback ?? [];
}

function hasTopologyKeys(record: Record<string, unknown>) {
  return [
    "walls",
    "wallSegments",
    "wall_segments",
    "wallLines",
    "wall_lines",
    "lines",
    "segments",
    "edges",
    "openings",
    "opening",
    "doors",
    "windows"
  ].some((key) => key in record);
}

function extractTopologyRecord(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) {
    return { record: { walls: raw } as Record<string, unknown> };
  }
  const root = raw as Record<string, unknown>;
  const candidates = ["topology", "floorplan", "floorPlan", "result", "data", "output", "payload"];
  for (const key of candidates) {
    const value = root[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (hasTopologyKeys(record)) {
        const metadataFallback =
          root.metadata && typeof root.metadata === "object"
            ? (root.metadata as Record<string, unknown>)
            : undefined;
        return { record, metadataFallback };
      }
    }
  }
  return { record: root };
}

function formatZodIssues(error: z.ZodError) {
  if (!error.issues || error.issues.length === 0) return "";
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function sanitizeArrayBySchema<T>(entries: unknown[], schema: z.ZodType<T>) {
  if (!Array.isArray(entries)) return [];
  const sanitized: T[] = [];
  for (const entry of entries) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) sanitized.push(parsed.data);
  }
  return sanitized;
}

function computeOffsetFromPosition(
  wall: { start: [number, number]; end: [number, number] },
  position: [number, number]
) {
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dy) || 1;
  const vx = position[0] - wall.start[0];
  const vy = position[1] - wall.start[1];
  const projection = (vx * dx + vy * dy) / length;
  return Math.max(0, Math.min(length, projection));
}

function computePositionFromOffset(
  wall: { start: [number, number]; end: [number, number] },
  offset: number
): [number, number] {
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dy) || 1;
  const ratio = Math.max(0, Math.min(1, offset / length));
  return [wall.start[0] + dx * ratio, wall.start[1] + dy * ratio];
}

function hydrateMetadata(params: {
  raw: Record<string, unknown>;
  imageWidth: number;
  imageHeight: number;
  walls: Topology["walls"];
  openings: Topology["openings"];
  metadataOverride?: Record<string, unknown>;
}) {
  const { raw, imageWidth, imageHeight, walls, openings, metadataOverride } = params;
  const metadataRaw =
    metadataOverride ??
    (raw.metadata && typeof raw.metadata === "object" ? (raw.metadata as Record<string, unknown>) : {});
  const analysisRaw =
    metadataRaw.analysisCompleteness && typeof metadataRaw.analysisCompleteness === "object"
      ? (metadataRaw.analysisCompleteness as Record<string, unknown>)
      : {};
  const scale = coerceNumber(metadataRaw.scale ?? raw.scale, 1);
  const scaleInfo = buildScaleInfo({
    scale,
    metadataRaw,
    analysisRaw,
    raw
  });
  const wallSegments = walls.length;
  const exteriorWalls = walls.filter((wall) => wall.type === "exterior").length;
  const interiorWalls = walls.filter((wall) => wall.type === "interior").length;
  const doors = openings.filter((opening) => opening.type.includes("door")).length;
  const windows = openings.filter((opening) => opening.type === "window").length;

  return {
    imageWidth: coerceNumber(metadataRaw.imageWidth, imageWidth),
    imageHeight: coerceNumber(metadataRaw.imageHeight, imageHeight),
    scale,
    scaleInfo,
    unit: typeof metadataRaw.unit === "string" ? metadataRaw.unit : "pixels",
    confidence: coerceNumber(metadataRaw.confidence ?? raw.confidence, 0.6),
    analysisCompleteness: {
      totalWallSegments: wallSegments,
      exteriorWalls,
      interiorWalls,
      totalOpenings: openings.length,
      doors,
      windows,
      balconies: walls.filter((wall) => wall.isPartOfBalcony).length,
      columns: walls.filter((wall) => wall.type === "column").length,
      dimensionChecks: coerceFiniteNumber(analysisRaw.dimensionChecks ?? metadataRaw.dimensionChecks) ?? undefined
    }
  };
}

function normalizeTopologyPayload(raw: unknown, imageWidth: number, imageHeight: number) {
  const extracted = extractTopologyRecord(raw);
  if (!extracted) return null;
  const { record, metadataFallback } = extracted;
  const wallsRaw = pickArray(record, [
    "walls",
    "wallSegments",
    "wall_segments",
    "wallLines",
    "wall_lines",
    "lines",
    "segments",
    "edges"
  ]);
  const openingsBase = pickArray(record, ["openings", "opening", "openingsList", "openings_list"]);
  const doorsRaw = pickArray(record, ["doors", "doorways", "door_list", "doorList"]);
  const windowsRaw = pickArray(record, ["windows", "window_list", "windowList"]);
  const openingsRaw = [
    ...openingsBase,
    ...doorsRaw.map((entry) => (entry && typeof entry === "object" ? { ...(entry as Record<string, unknown>), type: "door" } : entry)),
    ...windowsRaw.map((entry) =>
      entry && typeof entry === "object" ? { ...(entry as Record<string, unknown>), type: "window" } : entry
    )
  ];
  const wallTypes = new Set(["exterior", "interior", "balcony", "column"]);
  const openingTypes = new Set(["door", "window", "sliding_door", "double_door", "passage"]);
  const swingTypes = new Set(["left", "right", "none", "sliding"]);
  const locationTypes = new Set(["exterior", "interior", "balcony"]);
  const attachDistance = Number.isFinite(OPENING_ATTACH_DISTANCE) ? OPENING_ATTACH_DISTANCE : 20;
  const openingTypeDefaults: Record<Topology["openings"][number]["type"], number> = {
    door: 0.8,
    window: 0.78,
    sliding_door: 0.76,
    double_door: 0.74,
    passage: 0.68
  };

  const walls = wallsRaw
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const wall = entry as Record<string, unknown>;
      const line = coerceLine(wall);
      if (!line) return null;
      const { start, end } = line;
      const thickness = coerceNumber(wall.thickness, DEFAULT_WALL_THICKNESS);
      const length = coerceNumber(wall.length, Math.hypot(end[0] - start[0], end[1] - start[1]));
      const typeValue = typeof wall.type === "string" ? wall.type : "interior";
      const type = wallTypes.has(typeValue) ? typeValue : "interior";
      return {
        id: typeof wall.id === "string" && wall.id ? wall.id : `w${index + 1}`,
        start: start as [number, number],
        end: end as [number, number],
        thickness,
        type: type as Topology["walls"][number]["type"],
        length,
        isPartOfBalcony: Boolean(wall.isPartOfBalcony),
        confidence: toConfidence(wall.confidence ?? wall.score ?? wall.wallConfidence, 0.72),
        notes: typeof wall.notes === "string" ? wall.notes : undefined
      };
    })
    .filter((wall): wall is Topology["walls"][number] => Boolean(wall));

  const wallMap = new Map(walls.map((wall) => [wall.id, wall]));

  const openings = openingsRaw
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const opening = entry as Record<string, unknown>;
      const rawWallId = (() => {
        if (typeof opening.wallId === "string") return opening.wallId;
        if (typeof opening.wall_id === "string") return opening.wall_id;
        if (typeof opening.wall === "string") return opening.wall;
        if (opening.wall && typeof opening.wall === "object") {
          const wallRecord = opening.wall as Record<string, unknown>;
          return typeof wallRecord.id === "string" ? wallRecord.id : "";
        }
        return "";
      })();
      let width = coerceFiniteNumber(opening.width ?? opening.size ?? opening.length ?? opening.span);
      const positionInput =
        coerceVec2(opening.position ?? opening.center ?? opening.midpoint ?? opening.midPoint ?? opening.location) ??
        null;
      const openingStart = coerceVec2(opening.start ?? opening.from ?? opening.a ?? opening.p1 ?? opening.point1);
      const openingEnd = coerceVec2(opening.end ?? opening.to ?? opening.b ?? opening.p2 ?? opening.point2);
      if (width === null && openingStart && openingEnd) {
        width = Math.hypot(openingEnd[0] - openingStart[0], openingEnd[1] - openingStart[1]);
      }
      if (width === null || !Number.isFinite(width) || width <= 0) width = 90;
      let wall = wallMap.get(rawWallId);
      let wallId = rawWallId;

      if (!wall) {
        const wallIndex = coerceFiniteNumber(opening.wallIndex ?? opening.wall_index ?? opening.wallIdx);
        if (wallIndex !== null) {
          const idx = wallIndex >= 1 && wallIndex <= walls.length ? wallIndex - 1 : wallIndex;
          const indexedWall = walls[idx];
          if (indexedWall) {
            wall = indexedWall;
            wallId = indexedWall.id;
          }
        }
      }

      if (!wall && positionInput) {
        const nearest = findNearestWall(positionInput, walls, attachDistance);
        if (nearest) {
          wall = nearest.wall;
          wallId = nearest.wall.id;
        }
      }

      if (!wall) return null;

      const midpoint = openingStart && openingEnd
        ? [(openingStart[0] + openingEnd[0]) / 2, (openingStart[1] + openingEnd[1]) / 2] as [number, number]
        : null;
      const positionCandidate = positionInput ?? midpoint;
      const offset =
        typeof opening.offset === "number"
          ? opening.offset
          : positionCandidate
            ? computeOffsetFromPosition(wall, positionCandidate)
            : 0;
      const position = positionCandidate ?? computePositionFromOffset(wall, offset);
      const typeValue = typeof opening.type === "string" ? opening.type : "door";
      const type = openingTypes.has(typeValue) ? typeValue : "door";
      const swingValue = typeof opening.swingDirection === "string" ? opening.swingDirection : "";
      const locationValue = typeof opening.location === "string" ? opening.location : "";
      const projection = projectPointToSegment(position as [number, number], wall.start, wall.end);
      const maxAttachDistance = Math.max(attachDistance, wall.thickness * 0.75, 6);
      const attachConfidence = toConfidence(
        opening.attachConfidence ??
          opening.wallConfidence ??
          opening.placementConfidence ??
          1 - projection.distance / Math.max(maxAttachDistance * 1.5, 1),
        0.65
      );
      const detectConfidence = toConfidence(
        opening.detectConfidence ?? opening.confidence ?? opening.score ?? opening.detectionConfidence,
        0.7
      );
      const typeConfidence = toConfidence(
        opening.typeConfidence ?? opening.classConfidence ?? opening.semanticConfidence,
        openingTypeDefaults[type as Topology["openings"][number]["type"]] ?? 0.7
      );
      return {
        id: typeof opening.id === "string" && opening.id ? opening.id : `o${index + 1}`,
        wallId,
        type: type as Topology["openings"][number]["type"],
        position: position as [number, number],
        width,
        direction: typeof opening.direction === "number" ? opening.direction : undefined,
        swingDirection: swingTypes.has(swingValue) ? (swingValue as Topology["openings"][number]["swingDirection"]) : undefined,
        location: locationTypes.has(locationValue) ? (locationValue as Topology["openings"][number]["location"]) : undefined,
        isEntrance: typeof opening.isEntrance === "boolean" ? opening.isEntrance : undefined,
        offset,
        height: typeof opening.height === "number" ? opening.height : undefined,
        detectConfidence,
        attachConfidence,
        typeConfidence
      };
    })
    .filter((opening): opening is Topology["openings"][number] => Boolean(opening));

  const metadata = hydrateMetadata({
    raw: record,
    imageWidth,
    imageHeight,
    walls,
    openings,
    metadataOverride: metadataFallback
  });

  const balconiesRaw = pickArray(record, ["balconies", "balcony", "terraces", "terrace"]);
  const columnsRaw = pickArray(record, ["columns", "column", "pillars"]);
  const roomsRaw = pickArray(record, ["rooms", "room", "spaces", "areas"]);

  const balconies = sanitizeArrayBySchema(balconiesRaw, BalconySchema) as Balcony[];
  const columns = sanitizeArrayBySchema(columnsRaw, ColumnSchema) as Column[];
  const rooms = sanitizeArrayBySchema(roomsRaw, RoomSchema) as Room[];

  return {
    metadata,
    walls,
    openings,
    balconies,
    columns,
    rooms,
    scale: metadata.scale,
    scaleInfo: metadata.scaleInfo
  };
}

function wallLength(wall: Topology["walls"][number]) {
  return Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
}

function projectPointToSegment(
  point: [number, number],
  start: [number, number],
  end: [number, number]
): { position: [number, number]; distance: number; t: number } {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    const distance = Math.hypot(point[0] - start[0], point[1] - start[1]);
    return { position: [start[0], start[1]], distance, t: 0 };
  }
  const tRaw = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSq;
  const t = Math.max(0, Math.min(1, tRaw));
  const position: [number, number] = [start[0] + dx * t, start[1] + dy * t];
  const distance = Math.hypot(point[0] - position[0], point[1] - position[1]);
  return { position, distance, t };
}

function findNearestWall(
  position: [number, number],
  walls: Topology["walls"],
  maxDistance: number
): { wall: Topology["walls"][number]; projection: [number, number] } | null {
  let closest: { wall: Topology["walls"][number]; projection: [number, number]; distance: number } | null = null;
  for (const wall of walls) {
    const projection = projectPointToSegment(position, wall.start, wall.end);
    if (!closest || projection.distance < closest.distance) {
      closest = { wall, projection: projection.position, distance: projection.distance };
    }
  }
  if (!closest) return null;
  return closest.distance <= maxDistance ? { wall: closest.wall, projection: closest.projection } : null;
}

function refineTopology(topology: Topology): Topology {
  const snapTolerance = Number.isFinite(SNAP_TOLERANCE) ? SNAP_TOLERANCE : 4;
  const gapTolerance = Number.isFinite(MERGE_GAP_TOLERANCE) ? MERGE_GAP_TOLERANCE : 6;
  const alignTolerance = Number.isFinite(MERGE_ALIGN_TOLERANCE) ? MERGE_ALIGN_TOLERANCE : 2;
  const attachDistance = Number.isFinite(OPENING_ATTACH_DISTANCE) ? OPENING_ATTACH_DISTANCE : 20;

  const walls = topology.walls.map((wall) => ({
    ...wall,
    start: [wall.start[0], wall.start[1]] as [number, number],
    end: [wall.end[0], wall.end[1]] as [number, number]
  }));
  const openings = topology.openings.map((opening) => ({
    ...opening,
    position: opening.position ? [opening.position[0], opening.position[1]] : undefined
  }));

  const clusterCoords = (coords: number[]) => {
    if (coords.length === 0) return [];
    const sorted = [...coords].sort((a, b) => a - b);
    const clusters: number[] = [];
    let sum = sorted[0];
    let count = 1;
    for (let i = 1; i < sorted.length; i += 1) {
      if (Math.abs(sorted[i] - sorted[i - 1]) <= snapTolerance) {
        sum += sorted[i];
        count += 1;
      } else {
        clusters.push(sum / count);
        sum = sorted[i];
        count = 1;
      }
    }
    clusters.push(sum / count);
    return clusters;
  };

  const snapToGrid = (value: number, grid: number[]) => {
    let best = value;
    let minDiff = snapTolerance;
    for (const candidate of grid) {
      const diff = Math.abs(value - candidate);
      if (diff < minDiff) {
        minDiff = diff;
        best = candidate;
      }
    }
    return best;
  };

  const xGrid = clusterCoords(walls.flatMap((wall) => [wall.start[0], wall.end[0]]));
  const yGrid = clusterCoords(walls.flatMap((wall) => [wall.start[1], wall.end[1]]));

  for (const wall of walls) {
    wall.start[0] = snapToGrid(wall.start[0], xGrid);
    wall.end[0] = snapToGrid(wall.end[0], xGrid);
    wall.start[1] = snapToGrid(wall.start[1], yGrid);
    wall.end[1] = snapToGrid(wall.end[1], yGrid);

    if (Math.abs(wall.start[0] - wall.end[0]) < snapTolerance) {
      const snapped = (wall.start[0] + wall.end[0]) / 2;
      wall.start[0] = snapped;
      wall.end[0] = snapped;
    }
    if (Math.abs(wall.start[1] - wall.end[1]) < snapTolerance) {
      const snapped = (wall.start[1] + wall.end[1]) / 2;
      wall.start[1] = snapped;
      wall.end[1] = snapped;
    }

    wall.length = wallLength(wall);
  }

  const mergedWalls: Topology["walls"] = [];
  const used = new Set<number>();
  const idMap = new Map<string, string>();

  for (let i = 0; i < walls.length; i += 1) {
    if (used.has(i)) continue;
    let current = { ...walls[i] };
    used.add(i);

    for (let j = i + 1; j < walls.length; j += 1) {
      if (used.has(j)) continue;
      const candidate = walls[j];
      if (candidate.type !== current.type) continue;

      const currentIsHorizontal = Math.abs(current.start[1] - current.end[1]) < alignTolerance;
      const candidateIsHorizontal = Math.abs(candidate.start[1] - candidate.end[1]) < alignTolerance;
      const currentIsVertical = Math.abs(current.start[0] - current.end[0]) < alignTolerance;
      const candidateIsVertical = Math.abs(candidate.start[0] - candidate.end[0]) < alignTolerance;

      if (currentIsHorizontal && candidateIsHorizontal) {
        if (Math.abs(current.start[1] - candidate.start[1]) > alignTolerance) continue;
        const minA = Math.min(current.start[0], current.end[0]);
        const maxA = Math.max(current.start[0], current.end[0]);
        const minB = Math.min(candidate.start[0], candidate.end[0]);
        const maxB = Math.max(candidate.start[0], candidate.end[0]);
        if (maxA >= minB - gapTolerance && maxB >= minA - gapTolerance) {
          current.start[0] = Math.min(minA, minB);
          current.end[0] = Math.max(maxA, maxB);
          current.start[1] = current.end[1] = (current.start[1] + candidate.start[1]) / 2;
          current.thickness = Math.max(current.thickness, candidate.thickness);
          current.confidence = Math.max(current.confidence ?? 0, candidate.confidence ?? 0);
          used.add(j);
          idMap.set(candidate.id, current.id);
        }
      } else if (currentIsVertical && candidateIsVertical) {
        if (Math.abs(current.start[0] - candidate.start[0]) > alignTolerance) continue;
        const minA = Math.min(current.start[1], current.end[1]);
        const maxA = Math.max(current.start[1], current.end[1]);
        const minB = Math.min(candidate.start[1], candidate.end[1]);
        const maxB = Math.max(candidate.start[1], candidate.end[1]);
        if (maxA >= minB - gapTolerance && maxB >= minA - gapTolerance) {
          current.start[1] = Math.min(minA, minB);
          current.end[1] = Math.max(maxA, maxB);
          current.start[0] = current.end[0] = (current.start[0] + candidate.start[0]) / 2;
          current.thickness = Math.max(current.thickness, candidate.thickness);
          current.confidence = Math.max(current.confidence ?? 0, candidate.confidence ?? 0);
          used.add(j);
          idMap.set(candidate.id, current.id);
        }
      }
    }

    current.length = wallLength(current);
    mergedWalls.push(current);
    if (!idMap.has(current.id)) {
      idMap.set(current.id, current.id);
    }
  }

  const wallMap = new Map(mergedWalls.map((wall) => [wall.id, wall]));

  const refinedOpenings = openings
    .map((opening) => {
      const mappedId = idMap.get(opening.wallId) ?? opening.wallId;
      let wall = wallMap.get(mappedId);
      let position = opening.position ? [opening.position[0], opening.position[1]] as [number, number] : undefined;

      if (!wall && position) {
        const nearest = findNearestWall(position, mergedWalls, attachDistance);
        if (nearest) {
          wall = nearest.wall;
          position = nearest.projection;
        }
      }
      if (!wall) return null;

      if (!position) {
        const offset = typeof opening.offset === "number" ? opening.offset : 0;
        position = computePositionFromOffset(wall, offset);
      }

      const projection = projectPointToSegment(position, wall.start, wall.end);
      const snappedPosition = projection.position;
      const offset = computeOffsetFromPosition(wall, snappedPosition);
      const maxAttachDistance = Math.max(attachDistance, wall.thickness * 0.75, 6);
      const attachConfidence = toConfidence(
        opening.attachConfidence ?? 1 - projection.distance / Math.max(maxAttachDistance * 1.5, 1),
        0.65
      );

      return {
        ...opening,
        wallId: wall.id,
        position: snappedPosition,
        offset,
        attachConfidence
      };
    })
    .filter((opening): opening is Topology["openings"][number] => Boolean(opening));

  return {
    ...topology,
    walls: mergedWalls,
    openings: refinedOpenings
  };
}

function computeWallBounds(walls: Topology["walls"]) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const wall of walls) {
    const points: [number, number][] = [wall.start, wall.end];
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, maxX, minY, maxY };
}

function markExteriorWallsIfMissing(walls: Topology["walls"]) {
  if (walls.some((wall) => wall.type === "exterior")) return walls;
  const bounds = computeWallBounds(walls);
  const edgeTolerance = Math.max(SNAP_TOLERANCE * 2, MIN_WALL_THICKNESS * 2, 8);
  return walls.map((wall) => {
    const nearMinX =
      Math.abs(wall.start[0] - bounds.minX) <= edgeTolerance &&
      Math.abs(wall.end[0] - bounds.minX) <= edgeTolerance;
    const nearMaxX =
      Math.abs(wall.start[0] - bounds.maxX) <= edgeTolerance &&
      Math.abs(wall.end[0] - bounds.maxX) <= edgeTolerance;
    const nearMinY =
      Math.abs(wall.start[1] - bounds.minY) <= edgeTolerance &&
      Math.abs(wall.end[1] - bounds.minY) <= edgeTolerance;
    const nearMaxY =
      Math.abs(wall.start[1] - bounds.maxY) <= edgeTolerance &&
      Math.abs(wall.end[1] - bounds.maxY) <= edgeTolerance;
    if (nearMinX || nearMaxX || nearMinY || nearMaxY) {
      return { ...wall, type: "exterior" as const };
    }
    return wall;
  });
}

function pruneOrphanWalls(walls: Topology["walls"], tolerance: number) {
  if (walls.length < 4) return walls;
  const isNear = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
  return walls.filter((wall, index) => {
    if (wallLength(wall) > ORPHAN_MAX_LENGTH) return true;
    const endpoints: [number, number][] = [wall.start, wall.end];
    const hasNeighbor = walls.some((candidate, candidateIndex) => {
      if (candidateIndex === index) return false;
      return endpoints.some((point) => isNear(point, candidate.start) || isNear(point, candidate.end));
    });
    return hasNeighbor;
  });
}

function validateTopology(topology: Topology) {
  // Ensure backward compatibility fields are populated if missing
  const scaleCandidate = topology.metadata?.scaleInfo?.value ?? topology.metadata?.scale ?? topology.scaleInfo?.value ?? topology.scale ?? 1;
  const scale = Number.isFinite(scaleCandidate) && scaleCandidate > 0 ? scaleCandidate : 1;

  const normalizedWalls = topology.walls.map((wall) => ({
    ...wall,
    thickness:
      Number.isFinite(wall.thickness) && wall.thickness > 0 ? wall.thickness : DEFAULT_WALL_THICKNESS,
    length: wallLength(wall),
    confidence: toConfidence(wall.confidence, 0.75)
  }));

  const thickWalls = normalizedWalls.filter((wall) => wall.thickness >= MIN_WALL_THICKNESS);
  const lengthFiltered = thickWalls.filter((wall) => wallLength(wall) >= MIN_WALL_LENGTH);
  const fallbackLengthFiltered = normalizedWalls.filter((wall) => wallLength(wall) >= MIN_WALL_LENGTH);
  const baseWalls = lengthFiltered.length >= 3 ? lengthFiltered : fallbackLengthFiltered;
  const connectionTolerance = Math.max(SNAP_TOLERANCE * 2, MIN_WALL_THICKNESS * 2, 8);
  const prunedWalls = pruneOrphanWalls(baseWalls, connectionTolerance);
  const filteredWalls = prunedWalls.length >= 3 ? prunedWalls : baseWalls;
  const typedWalls = markExteriorWallsIfMissing(filteredWalls);
  if (filteredWalls.length === 0) {
    throw new Error("No valid walls found after filtering.");
  }

  const wallMap = new Map(typedWalls.map((wall) => [wall.id, wall]));
  const attachDistance = Math.max(OPENING_ATTACH_DISTANCE, connectionTolerance);
  const doorTypes = new Set(["door", "sliding_door", "double_door", "passage"]);

  const processedOpenings = topology.openings
    .map((opening) => {
      let wall = wallMap.get(opening.wallId);
      let position = opening.position ? [opening.position[0], opening.position[1]] as [number, number] : null;

      if (!wall && position) {
        const nearest = findNearestWall(position, typedWalls, attachDistance);
        if (nearest) {
          wall = nearest.wall;
          position = nearest.projection;
        }
      }

      if (!wall) return null;

      const length = wallLength(wall);
      if (length <= 0) return null;

      const width = Number.isFinite(opening.width) && opening.width > 0 ? Math.min(opening.width, length) : 0;
      if (width <= 0) return null;

      if (!position) {
        const offsetValue = Number.isFinite(opening.offset) ? opening.offset : 0;
        position = computePositionFromOffset(wall, offsetValue);
      }

      const projection = projectPointToSegment(position, wall.start, wall.end);
      const offset = computeOffsetFromPosition(wall, projection.position);
      const maxOffset = Math.max(0, length - width);
      const clampedOffset = Math.max(0, Math.min(maxOffset, offset));
      const snappedPosition = computePositionFromOffset(wall, clampedOffset);
      const isDoor = doorTypes.has(opening.type);
      const height =
        Number.isFinite(opening.height) && opening.height > 0
          ? opening.height
          : isDoor
            ? DEFAULT_DOOR_HEIGHT
            : DEFAULT_WINDOW_HEIGHT;
      const maxAttachDistance = Math.max(attachDistance, wall.thickness * 0.75, 6);
      const attachDistancePx = Math.hypot(snappedPosition[0] - projection.position[0], snappedPosition[1] - projection.position[1]);
      const attachConfidence = toConfidence(
        opening.attachConfidence ?? 1 - attachDistancePx / Math.max(maxAttachDistance * 1.5, 1),
        0.65
      );
      const detectConfidence = toConfidence(opening.detectConfidence, 0.7);
      const typeConfidence = toConfidence(opening.typeConfidence, 0.7);

      return {
        ...opening,
        wallId: wall.id,
        position: snappedPosition,
        offset: clampedOffset,
        height,
        attachConfidence,
        detectConfidence,
        typeConfidence
      };
    })
    .filter((opening): opening is Topology["openings"][number] => Boolean(opening));
  const filteredOpenings = processedOpenings.filter((opening) => {
    const confidence = Math.min(
      toConfidence(opening.detectConfidence, 0.7),
      toConfidence(opening.attachConfidence, 0.65),
      toConfidence(opening.typeConfidence, 0.7)
    );
    return confidence >= OPENING_MIN_CONFIDENCE || Boolean(opening.isEntrance);
  });

  if (!filteredOpenings.some((opening) => opening.isEntrance)) {
    const doorCandidates = filteredOpenings.filter((opening) => doorTypes.has(opening.type));
    const exteriorDoors = doorCandidates.filter((opening) => {
      const wall = wallMap.get(opening.wallId);
      return wall?.type === "exterior" || wall?.isPartOfBalcony;
    });
    const pickEntrance = (candidates: Topology["openings"]) =>
      candidates.reduce((best, candidate) => (!best || candidate.width > best.width ? candidate : best), null as Topology["openings"][number] | null);
    const entrance = pickEntrance(exteriorDoors.length > 0 ? exteriorDoors : doorCandidates);
    if (entrance) {
      entrance.isEntrance = true;
    }
  }

  const metadata = hydrateMetadata({
    raw: topology as unknown as Record<string, unknown>,
    imageWidth: topology.metadata?.imageWidth ?? 0,
    imageHeight: topology.metadata?.imageHeight ?? 0,
    walls: typedWalls,
    openings: filteredOpenings
  });

  return {
    ...topology,
    scale,
    scaleInfo: metadata.scaleInfo,
    metadata,
    walls: typedWalls,
    openings: filteredOpenings
  };
}

const EMPTY_METRICS: CandidateMetrics = {
  wallCount: 0,
  openingCount: 0,
  axisAlignedRatio: 0,
  orphanWallCount: 0,
  selfIntersectionCount: 0,
  openingsAttachedRatio: 0,
  wallThicknessOutlierRate: 0,
  openingOverlapCount: 0,
  openingOutOfWallRangeCount: 0,
  exteriorAreaSanity: false,
  openingTypeConfidenceMean: 0,
  loopCountPenalty: 0,
  scaleConfidence: 0,
  scaleEvidenceCompleteness: 0,
  scaleSource: "unknown",
  exteriorDetected: false,
  exteriorLoopClosed: false,
  entranceDetected: false
};

function pointKey(point: [number, number], tolerance: number) {
  const x = Math.round(point[0] / tolerance) * tolerance;
  const y = Math.round(point[1] / tolerance) * tolerance;
  return `${x},${y}`;
}

function computeAxisAlignedRatio(walls: Topology["walls"]) {
  if (walls.length === 0) return 0;
  const threshold = Math.max(2, SNAP_TOLERANCE);
  const aligned = walls.filter((wall) => {
    const dx = Math.abs(wall.end[0] - wall.start[0]);
    const dy = Math.abs(wall.end[1] - wall.start[1]);
    return dx <= threshold || dy <= threshold;
  });
  return aligned.length / walls.length;
}

function countOrphanWalls(walls: Topology["walls"], tolerance: number) {
  if (walls.length === 0) return 0;
  const isNear = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
  return walls.filter((wall, index) => {
    if (wallLength(wall) > ORPHAN_MAX_LENGTH) return false;
    const endpoints: [number, number][] = [wall.start, wall.end];
    const hasNeighbor = walls.some((candidate, candidateIndex) => {
      if (candidateIndex === index) return false;
      return endpoints.some((point) => isNear(point, candidate.start) || isNear(point, candidate.end));
    });
    return !hasNeighbor;
  }).length;
}

function isSamePoint(a: [number, number], b: [number, number], tolerance: number) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
}

function orientation(a: [number, number], b: [number, number], c: [number, number]) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-6) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a: [number, number], b: [number, number], c: [number, number]) {
  return (
    Math.min(a[0], c[0]) - 1e-6 <= b[0] &&
    b[0] <= Math.max(a[0], c[0]) + 1e-6 &&
    Math.min(a[1], c[1]) - 1e-6 <= b[1] &&
    b[1] <= Math.max(a[1], c[1]) + 1e-6
  );
}

function segmentsIntersect(
  p1: [number, number],
  q1: [number, number],
  p2: [number, number],
  q2: [number, number]
) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function countSelfIntersections(walls: Topology["walls"]) {
  let intersections = 0;
  const endpointTolerance = Math.max(SNAP_TOLERANCE, 3);
  for (let i = 0; i < walls.length; i += 1) {
    const a = walls[i];
    for (let j = i + 1; j < walls.length; j += 1) {
      const b = walls[j];
      const sharesEndpoint =
        isSamePoint(a.start, b.start, endpointTolerance) ||
        isSamePoint(a.start, b.end, endpointTolerance) ||
        isSamePoint(a.end, b.start, endpointTolerance) ||
        isSamePoint(a.end, b.end, endpointTolerance);
      if (sharesEndpoint) continue;
      if (segmentsIntersect(a.start, a.end, b.start, b.end)) {
        intersections += 1;
      }
    }
  }
  return intersections;
}

function isExteriorWall(wall: Topology["walls"][number]) {
  return wall.type === "exterior" || wall.type === "balcony" || wall.isPartOfBalcony;
}

function isExteriorLoopClosed(walls: Topology["walls"]) {
  const exteriorWalls = walls.filter(isExteriorWall);
  if (exteriorWalls.length < 3) return false;
  const tolerance = Math.max(2, SNAP_TOLERANCE);
  const adjacency = new Map<string, Set<string>>();
  for (const wall of exteriorWalls) {
    const startKey = pointKey(wall.start, tolerance);
    const endKey = pointKey(wall.end, tolerance);
    if (startKey === endKey) continue;
    const startNeighbors = adjacency.get(startKey) ?? new Set<string>();
    startNeighbors.add(endKey);
    adjacency.set(startKey, startNeighbors);
    const endNeighbors = adjacency.get(endKey) ?? new Set<string>();
    endNeighbors.add(startKey);
    adjacency.set(endKey, endNeighbors);
  }
  if (adjacency.size < 3) return false;
  const nodes = Array.from(adjacency.keys());
  const queue = [nodes[0] as string];
  const visited = new Set<string>(queue);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    });
  }
  if (visited.size !== adjacency.size) return false;
  return Array.from(adjacency.values()).every((neighbors) => neighbors.size >= 2);
}

function computeOpeningsAttachedRatio(topology: Topology) {
  if (topology.openings.length === 0) return 1;
  const wallMap = new Map(topology.walls.map((wall) => [wall.id, wall]));
  let attached = 0;
  for (const opening of topology.openings) {
    const wall = wallMap.get(opening.wallId);
    if (!wall || !opening.position) continue;
    const projection = projectPointToSegment(opening.position, wall.start, wall.end);
    const maxDistance = Math.max(OPENING_ATTACH_DISTANCE, wall.thickness * 0.75, 6);
    if (projection.distance <= maxDistance) {
      attached += 1;
    }
  }
  return attached / topology.openings.length;
}

function computeMedian(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid] ?? 0;
}

function computeWallThicknessOutlierRate(walls: Topology["walls"]) {
  if (walls.length === 0) return 0;
  const thicknesses = walls.map((wall) => Math.max(0, wall.thickness));
  const median = computeMedian(thicknesses);
  const absoluteDeviations = thicknesses.map((value) => Math.abs(value - median));
  const mad = computeMedian(absoluteDeviations);
  const threshold = mad > 0 ? Math.max(mad * 3, median * 0.6) : Math.max(median * 0.8, 2);
  const outliers = thicknesses.filter((value) => Math.abs(value - median) > threshold).length;
  return outliers / Math.max(walls.length, 1);
}

function countOpeningOverlapAndRangeViolations(topology: Topology) {
  const wallMap = new Map(topology.walls.map((wall) => [wall.id, wall]));
  const segmentsByWall = new Map<string, Array<{ start: number; end: number }>>();
  let outOfRangeCount = 0;
  const tolerance = Math.max(2, SNAP_TOLERANCE);

  for (const opening of topology.openings) {
    const wall = wallMap.get(opening.wallId);
    if (!wall) {
      outOfRangeCount += 1;
      continue;
    }
    const length = wallLength(wall);
    const offset =
      Number.isFinite(opening.offset) && typeof opening.offset === "number"
        ? opening.offset
        : opening.position
          ? computeOffsetFromPosition(wall, opening.position)
          : 0;
    const width = Math.max(0, opening.width);
    const start = offset;
    const end = offset + width;
    if (start < -tolerance || end > length + tolerance || width <= 0) {
      outOfRangeCount += 1;
    }
    const list = segmentsByWall.get(wall.id) ?? [];
    list.push({
      start: Math.max(0, Math.min(start, end)),
      end: Math.min(length, Math.max(start, end))
    });
    segmentsByWall.set(wall.id, list);
  }

  let overlapCount = 0;
  segmentsByWall.forEach((segments) => {
    const sorted = segments.sort((a, b) => a.start - b.start);
    for (let index = 1; index < sorted.length; index += 1) {
      const prev = sorted[index - 1];
      const current = sorted[index];
      if (!prev || !current) continue;
      if (current.start < prev.end - tolerance) {
        overlapCount += 1;
      }
    }
  });

  return { overlapCount, outOfRangeCount };
}

function computeExteriorGraphStats(walls: Topology["walls"]) {
  const exteriorWalls = walls.filter(isExteriorWall);
  const tolerance = Math.max(2, SNAP_TOLERANCE);
  const adjacency = new Map<string, Set<string>>();
  for (const wall of exteriorWalls) {
    const startKey = pointKey(wall.start, tolerance);
    const endKey = pointKey(wall.end, tolerance);
    if (startKey === endKey) continue;
    const startNeighbors = adjacency.get(startKey) ?? new Set<string>();
    const endNeighbors = adjacency.get(endKey) ?? new Set<string>();
    startNeighbors.add(endKey);
    endNeighbors.add(startKey);
    adjacency.set(startKey, startNeighbors);
    adjacency.set(endKey, endNeighbors);
  }

  const nodes = Array.from(adjacency.keys());
  if (nodes.length === 0) {
    return { components: 0, oddDegreeNodes: 0 };
  }
  const visited = new Set<string>();
  let components = 0;
  for (const node of nodes) {
    if (visited.has(node)) continue;
    components += 1;
    const queue = [node];
    visited.add(node);
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;
      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
  }

  const oddDegreeNodes = Array.from(adjacency.values()).filter((neighbors) => neighbors.size !== 2).length;
  return { components, oddDegreeNodes };
}

function computeLoopCountPenalty(walls: Topology["walls"]) {
  const exteriorWalls = walls.filter(isExteriorWall);
  if (exteriorWalls.length < 3) return 2;
  const graph = computeExteriorGraphStats(walls);
  let penalty = 0;
  if (graph.components > 1) {
    penalty += graph.components - 1;
  }
  if (graph.oddDegreeNodes > 0) {
    penalty += graph.oddDegreeNodes / 2;
  }
  return penalty;
}

function computeExteriorAreaSanity(walls: Topology["walls"]) {
  const exteriorWalls = walls.filter(isExteriorWall);
  if (exteriorWalls.length < 3) return false;
  const bounds = computeWallBounds(exteriorWalls);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false;
  const aspect = width >= height ? width / Math.max(height, 1e-6) : height / Math.max(width, 1e-6);
  const area = width * height;
  const perimeter = exteriorWalls.reduce((sum, wall) => sum + wallLength(wall), 0);
  const compactness = perimeter > 0 && area > 0 ? (perimeter * perimeter) / Math.max(4 * Math.PI * area, 1e-6) : 999;
  return width >= MIN_WALL_LENGTH && height >= MIN_WALL_LENGTH && aspect <= 8 && compactness <= 90;
}

function computeOpeningTypeConfidenceMean(openings: Topology["openings"]) {
  if (openings.length === 0) return 1;
  let sum = 0;
  for (const opening of openings) {
    const fallback = opening.type === "window" ? 0.78 : opening.type === "door" ? 0.8 : 0.72;
    sum += toConfidence(opening.typeConfidence, fallback);
  }
  return sum / openings.length;
}

function computeScaleEvidenceCompleteness(scaleInfo: ScaleInfo | undefined) {
  if (!scaleInfo?.evidence) return 0;
  const { evidence } = scaleInfo;
  let score = 0;
  if (Number.isFinite(evidence.mmValue)) score += 0.3;
  if (Number.isFinite(evidence.pxDistance)) score += 0.3;
  if (Array.isArray(evidence.p1) && Array.isArray(evidence.p2)) score += 0.2;
  if (typeof evidence.ocrText === "string" && evidence.ocrText.length > 0) score += 0.1;
  if (evidence.ocrBox) score += 0.1;
  if (typeof evidence.notes === "string" && evidence.notes.length > 0) score += 0.05;
  return Math.min(1, score);
}

function clampScaleConfidence(value: number) {
  return Math.max(0, Math.min(1, value));
}

function sourcePrior(source: ScaleSource) {
  if (source === "user_measure") return 0.25;
  if (source === "ocr_dimension") return 0.18;
  if (source === "door_heuristic") return 0.04;
  return -0.2;
}

function scoreScaleCandidate(candidate: Omit<ScaleCandidate, "score">) {
  const evidenceCompleteness = computeScaleEvidenceCompleteness({
    value: candidate.value,
    source: candidate.source,
    confidence: candidate.confidence,
    evidence: candidate.evidence
  });
  return candidate.confidence + sourcePrior(candidate.source) + evidenceCompleteness * 0.2;
}

function buildScaleCandidates(topology: Topology): ScaleCandidate[] {
  const candidates: ScaleCandidate[] = [];
  const metadataScale = topology.metadata?.scale;
  const metadataScaleInfo = topology.metadata?.scaleInfo ?? topology.scaleInfo;
  if (metadataScaleInfo && Number.isFinite(metadataScaleInfo.value) && metadataScaleInfo.value > 0) {
    const base: Omit<ScaleCandidate, "score"> = {
      source: metadataScaleInfo.source,
      value: metadataScaleInfo.value,
      confidence: clampScaleConfidence(metadataScaleInfo.confidence),
      evidence: metadataScaleInfo.evidence,
      reason: "provider_scale_info"
    };
    candidates.push({
      ...base,
      score: scoreScaleCandidate(base)
    });
  } else if (Number.isFinite(metadataScale) && (metadataScale ?? 0) > 0) {
    const base: Omit<ScaleCandidate, "score"> = {
      source: "unknown",
      value: metadataScale ?? 1,
      confidence: 0.25,
      reason: "metadata_scale_only",
      evidence: {
        notes: "Scale value exists without explicit source or evidence."
      }
    };
    candidates.push({
      ...base,
      score: scoreScaleCandidate(base)
    });
  }

  const doorOpenings = topology.openings.filter((opening) =>
    opening.type === "door" || opening.type === "sliding_door" || opening.type === "double_door"
  );
  if (doorOpenings.length > 0) {
    const widths = doorOpenings.map((opening) => opening.width).filter((width) => Number.isFinite(width) && width > 10);
    if (widths.length > 0) {
      const avgWidthPx = widths.reduce((sum, width) => sum + width, 0) / widths.length;
      const doorWidthAssumedMm = Number(process.env.FLOORPLAN_DOOR_WIDTH_ASSUMED_MM ?? 900);
      const value = doorWidthAssumedMm / 1000 / avgWidthPx;
      if (Number.isFinite(value) && value > 0) {
        const base: Omit<ScaleCandidate, "score"> = {
          source: "door_heuristic",
          value,
          confidence: 0.55,
          reason: "door_width_heuristic",
          evidence: {
            mmValue: doorWidthAssumedMm,
            pxDistance: avgWidthPx,
            notes: `Derived from ${widths.length} door opening(s).`
          }
        };
        candidates.push({
          ...base,
          score: scoreScaleCandidate(base)
        });
      }
    }
  }

  if (candidates.length === 0) {
    const fallback: Omit<ScaleCandidate, "score"> = {
      source: "unknown",
      value: Number.isFinite(topology.metadata.scale) && topology.metadata.scale > 0 ? topology.metadata.scale : 1,
      confidence: 0,
      reason: "no_scale_signal",
      evidence: {
        notes: "No reliable scale evidence found."
      }
    };
    candidates.push({
      ...fallback,
      score: scoreScaleCandidate(fallback)
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function applySelectedScaleCandidate(topology: Topology) {
  const scaleCandidates = buildScaleCandidates(topology);
  const selected = scaleCandidates[0] ?? null;
  if (!selected) {
    return {
      topology,
      scaleCandidates: [] as ScaleCandidate[]
    };
  }
  const nextScaleInfo: ScaleInfo = {
    value: selected.value,
    source: selected.source,
    confidence: selected.confidence,
    ...(selected.evidence ? { evidence: selected.evidence } : {})
  };
  return {
    topology: {
      ...topology,
      scale: selected.value,
      scaleInfo: nextScaleInfo,
      metadata: {
        ...topology.metadata,
        scale: selected.value,
        scaleInfo: nextScaleInfo
      }
    },
    scaleCandidates
  };
}

function computeCandidateMetrics(topology: Topology | null): CandidateMetrics {
  if (!topology) return { ...EMPTY_METRICS };
  const wallCount = topology.walls.length;
  const openingCount = topology.openings.length;
  const axisAlignedRatio = computeAxisAlignedRatio(topology.walls);
  const orphanWallCount = countOrphanWalls(topology.walls, Math.max(SNAP_TOLERANCE * 2, MIN_WALL_THICKNESS * 2, 8));
  const selfIntersectionCount = countSelfIntersections(topology.walls);
  const openingsAttachedRatio = computeOpeningsAttachedRatio(topology);
  const wallThicknessOutlierRate = computeWallThicknessOutlierRate(topology.walls);
  const { overlapCount: openingOverlapCount, outOfRangeCount: openingOutOfWallRangeCount } =
    countOpeningOverlapAndRangeViolations(topology);
  const exteriorAreaSanity = computeExteriorAreaSanity(topology.walls);
  const openingTypeConfidenceMean = computeOpeningTypeConfidenceMean(topology.openings);
  const loopCountPenalty = computeLoopCountPenalty(topology.walls);
  const scaleInfo = topology.metadata?.scaleInfo ?? topology.scaleInfo;
  const scaleSource = scaleInfo?.source ?? "unknown";
  const scaleConfidence = toConfidence(scaleInfo?.confidence, scaleSource === "unknown" ? 0 : 0.6);
  const scaleEvidenceCompleteness = computeScaleEvidenceCompleteness(scaleInfo);
  const exteriorDetected = topology.walls.some(isExteriorWall);
  const exteriorLoopClosed = isExteriorLoopClosed(topology.walls);
  const entranceDetected = topology.openings.some((opening) => Boolean(opening.isEntrance));
  return {
    wallCount,
    openingCount,
    axisAlignedRatio,
    orphanWallCount,
    selfIntersectionCount,
    openingsAttachedRatio,
    wallThicknessOutlierRate,
    openingOverlapCount,
    openingOutOfWallRangeCount,
    exteriorAreaSanity,
    openingTypeConfidenceMean,
    loopCountPenalty,
    scaleConfidence,
    scaleEvidenceCompleteness,
    scaleSource,
    exteriorDetected,
    exteriorLoopClosed,
    entranceDetected
  };
}

function scoreCandidate(candidate: Candidate): CandidateScoreBreakdown {
  if (!candidate.validated.success || !candidate.cleaned) {
    return {
      topologyScore: Number.NEGATIVE_INFINITY,
      openingScore: 0,
      scaleScore: 0,
      penalty: 0,
      total: Number.NEGATIVE_INFINITY
    };
  }
  const { metrics } = candidate;
  const topologyScore =
    (metrics.exteriorDetected ? SCORE_WEIGHTS.exteriorDetected : 0) +
    (metrics.exteriorLoopClosed ? SCORE_WEIGHTS.exteriorLoopClosed : 0) +
    (metrics.entranceDetected ? SCORE_WEIGHTS.entranceDetected : 0) +
    Math.min(metrics.wallCount, 80) * SCORE_WEIGHTS.wallCount +
    Math.min(metrics.openingCount, 30) * SCORE_WEIGHTS.openingCount +
    metrics.axisAlignedRatio * SCORE_WEIGHTS.axisAlignedRatio +
    (1 - metrics.wallThicknessOutlierRate) * SCORE_WEIGHTS.wallThicknessOutlierRate +
    (metrics.exteriorAreaSanity ? 1 : 0) * SCORE_WEIGHTS.exteriorAreaBonus;

  const openingScore = metrics.openingTypeConfidenceMean * SCORE_WEIGHTS.openingTypeConfidence;

  const scaleScore =
    metrics.scaleConfidence * SCORE_WEIGHTS.scaleConfidence +
    metrics.scaleEvidenceCompleteness * SCORE_WEIGHTS.scaleEvidenceCompleteness -
    (metrics.scaleSource === "unknown" ? SCORE_WEIGHTS.scaleUnknownPenalty : 0);

  const penalty =
    metrics.selfIntersectionCount * SCORE_WEIGHTS.selfIntersectionPenalty +
    metrics.orphanWallCount * SCORE_WEIGHTS.orphanPenalty +
    (1 - metrics.openingsAttachedRatio) * SCORE_WEIGHTS.openingAttachPenalty +
    metrics.openingOverlapCount * SCORE_WEIGHTS.openingOverlapPenalty +
    metrics.openingOutOfWallRangeCount * SCORE_WEIGHTS.openingOutOfRangePenalty +
    metrics.loopCountPenalty * SCORE_WEIGHTS.loopPenalty +
    (metrics.exteriorAreaSanity ? 0 : SCORE_WEIGHTS.exteriorAreaPenalty);

  const total = topologyScore + openingScore + scaleScore - penalty;
  return {
    topologyScore,
    openingScore,
    scaleScore,
    penalty,
    total
  };
}

function buildCandidateDebug(candidate: Candidate) {
  return {
    provider: candidate.provider,
    passId: candidate.passId,
    preprocessProfile: candidate.preprocessProfile,
    score: candidate.score,
    scoreBreakdown: candidate.scoreBreakdown,
    metrics: candidate.metrics,
    scaleCandidates: candidate.scaleCandidates,
    errors: candidate.validated.errors,
    timingMs: candidate.timingMs
  };
}

function getCacheMeta(payload: unknown): {
  provider?: string;
  score?: number;
  metrics?: CandidateMetrics;
} | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const cacheMetaRaw =
    root.cacheMeta && typeof root.cacheMeta === "object" ? (root.cacheMeta as Record<string, unknown>) : null;
  if (!cacheMetaRaw) return null;
  const provider = typeof cacheMetaRaw.provider === "string" ? cacheMetaRaw.provider : undefined;
  const score = coerceFiniteNumber(cacheMetaRaw.score) ?? undefined;
  const metricsRaw =
    cacheMetaRaw.metrics && typeof cacheMetaRaw.metrics === "object"
      ? (cacheMetaRaw.metrics as Record<string, unknown>)
      : null;
  const metrics = metricsRaw
    ? ({
        wallCount: coerceNumber(metricsRaw.wallCount, 0),
        openingCount: coerceNumber(metricsRaw.openingCount, 0),
        axisAlignedRatio: coerceNumber(metricsRaw.axisAlignedRatio, 0),
        orphanWallCount: coerceNumber(metricsRaw.orphanWallCount, 0),
        selfIntersectionCount: coerceNumber(metricsRaw.selfIntersectionCount, 0),
        openingsAttachedRatio: coerceNumber(metricsRaw.openingsAttachedRatio, 0),
        wallThicknessOutlierRate: coerceNumber(metricsRaw.wallThicknessOutlierRate, 0),
        openingOverlapCount: coerceNumber(metricsRaw.openingOverlapCount, 0),
        openingOutOfWallRangeCount: coerceNumber(metricsRaw.openingOutOfWallRangeCount, 0),
        exteriorAreaSanity: Boolean(metricsRaw.exteriorAreaSanity),
        openingTypeConfidenceMean: coerceNumber(metricsRaw.openingTypeConfidenceMean, 0),
        loopCountPenalty: coerceNumber(metricsRaw.loopCountPenalty, 0),
        scaleConfidence: coerceNumber(metricsRaw.scaleConfidence, 0),
        scaleEvidenceCompleteness: coerceNumber(metricsRaw.scaleEvidenceCompleteness, 0),
        scaleSource: coerceScaleSource(metricsRaw.scaleSource) ?? "unknown",
        exteriorDetected: Boolean(metricsRaw.exteriorDetected),
        exteriorLoopClosed: Boolean(metricsRaw.exteriorLoopClosed),
        entranceDetected: Boolean(metricsRaw.entranceDetected)
      } satisfies CandidateMetrics)
    : undefined;
  return {
    ...(provider ? { provider } : {}),
    ...(score !== undefined ? { score } : {}),
    ...(metrics ? { metrics } : {})
  };
}

function buildPrompt() {
  return `
You are an architectural floor plan analyzer.

You are given three images:
1) Original image for text/dimensions context.
2) High-contrast B/W image for wall ink.
3) Structural simplified image (downsampled) to suppress thin annotations.

Task:
- Extract wall centerlines and openings (doors/windows) only.
- Ignore furniture, labels, dimension lines, hatching, colored fills, symbols, and watermarks.
- Treat balconies as exterior walls only when clearly visible; otherwise omit them.
- Coordinate system: pixel coordinates in the ORIGINAL image (top-left is 0,0).
- If dimension strings (e.g. 2700mm, 3.6m) clearly map to a wall, estimate metadata.scale as meters per pixel and include metadata.scaleInfo={value,source:"ocr_dimension",confidence,evidence}. Set analysisCompleteness.dimensionChecks to the count used.
- If scale cannot be estimated confidently, set metadata.scaleInfo.source to "unknown" with low confidence and include a short reason in evidence.notes.
- Output only metadata, walls, openings. Do not include rooms, balconies, or columns arrays.

Wall rules:
- Represent each wall as a line segment (start/end).
- Prefer axis-aligned walls; if a wall is nearly horizontal/vertical, make it exact.
- Connect endpoints at intersections.
- Avoid short orphan segments that do not connect to the structure.
- thickness is approximate in pixels.
- type is "exterior" for perimeter walls, otherwise "interior".
- confidence is optional (0..1) for each wall.

Opening rules:
- Doors/windows are gaps on walls.
- Provide type, width in pixels, and position at the center of the opening.
- If wallId is unknown, still provide position (it will be attached to the nearest wall).
- Mark isEntrance for the main entrance when confident.
- Include detectConfidence/attachConfidence/typeConfidence (0..1) when available.
- Use arrays for points: start/end/position must be [x, y] numbers.

If tools are available, return the result using the "${FLOORPLAN_TOOL.name}" tool.
If tools are not available, output JSON only with no extra text.
  `.trim();
}

function createEmptyCandidate(
  provider: string,
  passId = "pass1",
  preprocessProfile: PreprocessProfile = "balanced"
): Candidate {
  return {
    provider,
    passId,
    preprocessProfile,
    raw: null,
    normalized: null,
    refined: null,
    cleaned: null,
    validated: {
      success: false,
      errors: []
    },
    metrics: { ...EMPTY_METRICS },
    scoreBreakdown: {
      topologyScore: Number.NEGATIVE_INFINITY,
      openingScore: 0,
      scaleScore: 0,
      penalty: 0,
      total: Number.NEGATIVE_INFINITY
    },
    scaleCandidates: [],
    score: Number.NEGATIVE_INFINITY,
    timingMs: 0
  };
}

function processCandidateRaw(candidate: Candidate, raw: unknown, imageWidth: number, imageHeight: number) {
  candidate.raw = raw;
  const normalized = normalizeTopologyPayload(raw, imageWidth, imageHeight);
  if (!normalized) {
    candidate.validated.errors.push(`${candidate.provider}: normalization failed`);
    return candidate;
  }

  const parsed = TopologySchema.safeParse(normalized);
  if (!parsed.success) {
    const issueText = formatZodIssues(parsed.error);
    const counts = `walls=${normalized.walls.length}, openings=${normalized.openings.length}`;
    const details = issueText ? ` (${counts}; ${issueText})` : ` (${counts})`;
    candidate.validated.errors.push(`${candidate.provider}: schema validation failed${details}`);
    candidate.normalized = normalized as Topology;
    candidate.metrics = computeCandidateMetrics(candidate.normalized);
    return candidate;
  }

  const parsedTopology = parsed.data as Topology;
  candidate.normalized = parsedTopology;
  candidate.refined = refineTopology(parsedTopology);

  try {
    const cleaned = validateTopology(candidate.refined);
    const scaled = applySelectedScaleCandidate(cleaned);
    candidate.cleaned = scaled.topology;
    candidate.scaleCandidates = scaled.scaleCandidates;
    candidate.validated.success = true;
  } catch (validationError) {
    const message = validationError instanceof Error ? validationError.message : "validation failed";
    candidate.validated.errors.push(`${candidate.provider}: ${message}`);
  }

  candidate.metrics = computeCandidateMetrics(candidate.cleaned ?? candidate.refined);
  candidate.scoreBreakdown = scoreCandidate(candidate);
  candidate.score = candidate.scoreBreakdown.total;
  return candidate;
}

function toTemplateDebugCandidate(candidate: TemplateCandidate) {
  return {
    id: candidate.entry.id,
    apartmentName: candidate.entry.apartmentName,
    typeName: candidate.entry.typeName,
    region: candidate.entry.region ?? null,
    score: candidate.score,
    matchType: candidate.matchType,
    reasons: candidate.reasons,
    licenseStatus: candidate.entry.licenseStatus,
    version: candidate.entry.version
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload = RequestSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ error: "Invalid request body", details: payload.error.flatten() }, { status: 400 });
    }

    const mode = payload.data.mode ?? "upload";
    if (mode === "catalog") {
      const query = payload.data.catalogQuery as CatalogTemplateQuery;
      const debug = payload.data.debug ?? process.env.NODE_ENV !== "production";
      const templateCandidates = await findCatalogTemplateCandidates(query, {
        limit: TEMPLATE_MAX_CANDIDATES
      });
      const debugInfo = debug
        ? {
            templateCandidates: templateCandidates.map(toTemplateDebugCandidate)
          }
        : {};
      if (templateCandidates.length === 0) {
        return NextResponse.json(
          {
            error: "No verified template matched this apartment query.",
            errorCode: "TEMPLATE_NOT_FOUND",
            recoverable: true,
            details: `No verified template for "${query.apartmentName} ${query.typeName}". Upload a floorplan image to continue.`,
            ...debugInfo
          },
          { status: 422, headers: { "Cache-Control": "no-cache" } }
        );
      }

      const selectedTemplate = templateCandidates[0];
      if (!selectedTemplate || selectedTemplate.score < TEMPLATE_MIN_CATALOG_SCORE) {
        return NextResponse.json(
          {
            error: "Template candidates found but confidence is too low.",
            errorCode: "TEMPLATE_LOW_CONF",
            recoverable: true,
            details: `Top template score ${selectedTemplate?.score.toFixed(3) ?? "0.000"} is below ${TEMPLATE_MIN_CATALOG_SCORE.toFixed(3)}.`,
            ...debugInfo
          },
          { status: 422, headers: { "Cache-Control": "no-cache" } }
        );
      }

      const topologyRaw = await loadTemplateTopology(selectedTemplate.entry);
      if (!topologyRaw) {
        return NextResponse.json(
          {
            error: "Template topology could not be loaded.",
            errorCode: "TEMPLATE_TOPOLOGY_UNAVAILABLE",
            recoverable: true,
            details: `Template "${selectedTemplate.entry.id}" exists but topology artifact is missing.`,
            ...debugInfo
          },
          { status: 422, headers: { "Cache-Control": "no-cache" } }
        );
      }

      const startedAt = Date.now();
      const candidate = createEmptyCandidate("template");
      processCandidateRaw(candidate, topologyRaw, 0, 0);
      candidate.timingMs = Date.now() - startedAt;

      if (!candidate.validated.success || !candidate.cleaned || candidate.score < MIN_ACCEPT_SCORE) {
        const details = !candidate.validated.success
          ? candidate.validated.errors[0] ?? "Template topology validation failed."
          : `Template score ${candidate.score.toFixed(2)} is below minimum ${MIN_ACCEPT_SCORE}.`;
        return NextResponse.json(
          {
            error: "Template topology failed quality gate.",
            errorCode: "TEMPLATE_TOPOLOGY_LOW_SCORE",
            recoverable: true,
            details,
            ...debugInfo,
            ...(debug
              ? {
                  candidates: [buildCandidateDebug(candidate)],
                  selectedProvider: candidate.provider,
                  selectedScore: candidate.score,
                  scaleCandidates: candidate.scaleCandidates
                }
              : {})
          },
          { status: 422, headers: { "Cache-Control": "no-cache" } }
        );
      }

      return NextResponse.json(
        {
          ...candidate.cleaned,
          source: "template",
          cacheHit: false,
          selection: {
            sourceModule: "template",
            selectedScore: candidate.score
          },
          ...(debug
            ? {
                templateCandidates: templateCandidates.map(toTemplateDebugCandidate),
                candidates: [buildCandidateDebug(candidate)],
                selectedProvider: candidate.provider,
                selectedScore: candidate.score,
                scaleCandidates: candidate.scaleCandidates
              }
            : {})
        },
        { status: 200, headers: { "Cache-Control": "no-cache" } }
      );
    }

    const { data, mimeType } = parseDataUrl(payload.data.base64 ?? "", payload.data.mimeType);
    if (!data) {
      return NextResponse.json({ error: "Empty base64 payload" }, { status: 400 });
    }

    const skipCache = payload.data.skipCache ?? false;
    const forceProvider = payload.data.forceProvider?.toLowerCase();
    const debug = payload.data.debug ?? process.env.NODE_ENV !== "production";

    let imageWidth = 0;
    let imageHeight = 0;
    let imageHash: Awaited<ReturnType<typeof computeImageHash>> | null = null;

    try {
      imageHash = await computeImageHash(data);
      imageWidth = imageHash.width;
      imageHeight = imageHash.height;
    } catch (error) {
      console.warn("[parse-floorplan] image hash unavailable:", error);
    }

    if (!skipCache && imageHash) {
      const cached = await findCachedTopology({
        hash: imageHash.hash,
        sha256: imageHash.sha256,
        width: imageHash.width,
        height: imageHash.height
      });
      if (cached) {
        const normalized = normalizeTopologyPayload(cached.topology, imageWidth, imageHeight);
        const cachedValidated = normalized ? TopologySchema.safeParse(normalized) : null;
        if (cachedValidated?.success) {
          const refined = refineTopology(cachedValidated.data as Topology);
          const cleanedValidated = validateTopology(refined);
          const scaled = applySelectedScaleCandidate(cleanedValidated);
          const cleaned = scaled.topology;
          const cacheMeta = getCacheMeta(cached.topology);
          return NextResponse.json(
            {
              ...cleaned,
              source: cacheMeta?.provider ?? cached.entry.source,
              cacheHit: true,
              cacheDistance: cached.distance,
              cacheHash: cached.entry.hash,
              cacheScore: cacheMeta?.score ?? cached.entry.score ?? null,
              cacheMetrics: cacheMeta?.metrics ?? cached.entry.metricsSummary ?? null,
              ...(debug ? { scaleCandidates: scaled.scaleCandidates } : {})
            },
            { status: 200, headers: { "Cache-Control": "no-cache" } }
          );
        }
      }
    }

    const providerOrder = getProviderOrder(forceProvider);
    const providerStatus = providerOrder.map((provider) => resolveProviderStatus(provider));
    const enabledProviders = providerStatus.filter((entry) => entry.status === "enabled").map((entry) => entry.provider);
    const candidates: Candidate[] = [];
    const templateCandidates: TemplateCandidate[] = [];

    // Always run multi-pass preprocessing and score all viable candidates.
    const preprocessPassProfiles: PreprocessProfile[] = ["balanced", "lineart"];
    const preprocessPasses: Array<{ passId: string; profile: PreprocessProfile; data: PreprocessResult }> = [];
    for (const [index, profile] of preprocessPassProfiles.entries()) {
      const passId = `pass${index + 1}`;
      try {
        const preprocessed = await preprocessImage(data, profile);
        preprocessPasses.push({ passId, profile, data: preprocessed });
      } catch (error) {
        console.warn(`[parse-floorplan] preprocessing pass failed (${passId}/${profile})`, error);
        preprocessPasses.push({
          passId,
          profile,
          data: { processed: data, structural: null, profile }
        });
      }
    }
    if (preprocessPasses.length === 0) {
      preprocessPasses.push({
        passId: "pass1",
        profile: "balanced",
        data: { processed: data, structural: null, profile: "balanced" }
      });
    }

    if (imageHash) {
      try {
        const imageTemplateCandidates = await findImageTemplateCandidates(
          {
            sha256: imageHash.sha256,
            hash: imageHash.hash,
            width: imageHash.width,
            height: imageHash.height
          },
          { limit: TEMPLATE_MAX_CANDIDATES }
        );
        templateCandidates.push(...imageTemplateCandidates);
        const selectedImageTemplate = imageTemplateCandidates[0];
        if (selectedImageTemplate && selectedImageTemplate.score >= TEMPLATE_MIN_IMAGE_SCORE) {
          const templateTopology = await loadTemplateTopology(selectedImageTemplate.entry);
          if (templateTopology) {
            const startedAt = Date.now();
            const templateCandidate = createEmptyCandidate("template");
            processCandidateRaw(templateCandidate, templateTopology, imageWidth, imageHeight);
            templateCandidate.timingMs = Date.now() - startedAt;
            candidates.push(templateCandidate);
          }
        }
      } catch (templateError) {
        const message = templateError instanceof Error ? templateError.message : String(templateError);
        console.warn("[parse-floorplan] template image retrieval failed:", message);
      }
    }

    let shouldStopAll = false;
    for (const provider of enabledProviders) {
      const name = provider.toLowerCase();
      const passes = name === "snaptrude" ? preprocessPasses.slice(0, 1) : preprocessPasses;
      for (const pass of passes) {
        const startedAt = Date.now();
        const candidate = createEmptyCandidate(provider, pass.passId, pass.profile);
        try {
          let raw: unknown | null = null;
          if (name === "snaptrude") {
            raw = await runSnaptrudeProvider(data, mimeType);
          } else if (name === "anthropic") {
            raw = await runAnthropicProvider(data, pass.data, mimeType);
          } else if (name === "openai") {
            raw = await runOpenAIProvider(data, pass.data, mimeType);
          } else {
            candidate.validated.errors.push(`${provider}: unknown provider`);
          }
          candidate.raw = raw;

          if (!raw) {
            if (candidate.validated.errors.length === 0) {
              candidate.validated.errors.push(`${provider}: provider unavailable (empty response)`);
            }
            continue;
          }
          processCandidateRaw(candidate, raw, imageWidth, imageHeight);
        } catch (error) {
          candidate.validated.errors.push(formatProviderError(provider, error));
        } finally {
          candidate.timingMs = Date.now() - startedAt;
          if (!Number.isFinite(candidate.score)) {
            candidate.scoreBreakdown = scoreCandidate(candidate);
            candidate.score = candidate.scoreBreakdown.total;
          }
          if (
            candidate.metrics.wallCount === 0 &&
            candidate.metrics.openingCount === 0 &&
            (candidate.normalized || candidate.refined || candidate.cleaned)
          ) {
            candidate.metrics = computeCandidateMetrics(candidate.cleaned ?? candidate.refined ?? candidate.normalized);
          }
          candidates.push(candidate);
        }

        if (candidate.validated.success && candidate.score >= EARLY_STOP_SCORE) {
          shouldStopAll = true;
          break;
        }
      }
      if (shouldStopAll) {
        break;
      }
    }

    const selected = candidates
      .filter((candidate) => candidate.validated.success && candidate.cleaned)
      .sort((a, b) => b.score - a.score)[0] ?? null;
    const providerErrors = candidates
      .flatMap((candidate) => candidate.validated.errors)
      .filter((message) => message.trim().length > 0);
    const skippedReasons = providerStatus
      .filter((entry) => entry.status === "skipped" && entry.reason)
      .map((entry) => `${entry.provider}: ${entry.reason}`);
    const noConfiguredProviders = enabledProviders.length === 0;

    if (!selected || !selected.cleaned || selected.score < MIN_ACCEPT_SCORE) {
      const debugInfo = debug
        ? {
            providerOrder,
            forceProvider: forceProvider ?? null,
            templateCandidates: templateCandidates.map(toTemplateDebugCandidate),
            candidates: candidates.map(buildCandidateDebug),
            selectedProvider: selected?.provider ?? null,
            selectedPassId: selected?.passId ?? null,
            selectedPreprocessProfile: selected?.preprocessProfile ?? null,
            selectedScore: selected?.score ?? null,
            scaleCandidates: selected?.scaleCandidates ?? []
          }
        : {};
      const detail = !selected
        ? providerErrors[0] ?? skippedReasons[0] ?? "No provider produced a valid topology."
        : `Best candidate score ${selected.score.toFixed(2)} is below minimum ${MIN_ACCEPT_SCORE}.`;
      const errorCode = noConfiguredProviders ? "PROVIDER_NOT_CONFIGURED" : "TOPOLOGY_EXTRACTION_FAILED";
      return NextResponse.json(
        {
          error: "Failed to extract a valid floorplan topology from providers.",
          errorCode,
          recoverable: true,
          details: detail,
          providerErrors: providerErrors.length > 0 ? providerErrors : skippedReasons,
          providerStatus,
          ...debugInfo
        },
        { status: 422, headers: { "Cache-Control": "no-cache" } }
      );
    }

    const cleaned = selected.cleaned;

    if (!skipCache && imageHash) {
      try {
        await storeCachedTopology({
          hash: imageHash.hash,
          sha256: imageHash.sha256,
          source: selected.provider,
          width: imageHash.width,
          height: imageHash.height,
          score: selected.score,
          metricsSummary: selected.metrics,
          topology: {
            topology: cleaned,
            cacheMeta: {
              provider: selected.provider,
              score: selected.score,
              metrics: selected.metrics
            }
          }
        });
      } catch (cacheError) {
        console.warn("[parse-floorplan] cache write skipped:", cacheError);
      }
    }

    const debugInfo = debug
      ? {
          providerOrder,
          forceProvider: forceProvider ?? null,
          templateCandidates: templateCandidates.map(toTemplateDebugCandidate),
          candidates: candidates.map(buildCandidateDebug),
          selectedProvider: selected.provider,
          selectedPassId: selected.passId,
          selectedPreprocessProfile: selected.preprocessProfile,
          selectedScore: selected.score,
          scaleCandidates: selected.scaleCandidates
        }
      : {};
    return NextResponse.json(
      {
        ...cleaned,
        source: selected.provider,
        cacheHit: false,
        selection: {
          sourceModule: selected.provider === "template" ? "template" : "cv",
          selectedScore: selected.score,
          selectedPassId: selected.passId,
          preprocessProfile: selected.preprocessProfile
        },
        providerStatus,
        providerErrors,
        ...debugInfo
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-cache"
        }
      }
    );
  } catch (error) {
    console.error("parse-floorplan failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "parse-floorplan failed", details: message }, { status: 500 });
  }
}
