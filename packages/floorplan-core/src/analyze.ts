import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { z } from "zod";

export type Vec2 = [number, number];

export type ScaleSource = "ocr_dimension" | "door_heuristic" | "user_measure" | "unknown";

export type ScaleInfo = {
  value: number;
  source: ScaleSource;
  confidence: number;
  evidence?: {
    mmValue?: number;
    pxDistance?: number;
    p1?: Vec2;
    p2?: Vec2;
    ocrText?: string;
    notes?: string;
  };
};

export type TopologyWall = {
  id: string;
  start: Vec2;
  end: Vec2;
  thickness: number;
  type: "exterior" | "interior" | "balcony" | "column";
  length: number;
  isPartOfBalcony: boolean;
  confidence?: number;
};

export type TopologyOpening = {
  id: string;
  wallId: string;
  type: "door" | "window" | "sliding_door" | "double_door" | "passage";
  position: Vec2;
  width: number;
  offset: number;
  height?: number;
  isEntrance?: boolean;
  detectConfidence?: number;
  attachConfidence?: number;
  typeConfidence?: number;
};

export type TopologyPayload = {
  metadata: {
    imageWidth: number;
    imageHeight: number;
    scale: number;
    scaleInfo: ScaleInfo;
    unit: "pixels";
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
    };
  };
  walls: TopologyWall[];
  openings: TopologyOpening[];
  source: string;
  cacheHit: false;
  selection: {
    sourceModule: "provider";
    selectedScore: number;
    selectedPassId: string;
    preprocessProfile: PreprocessProfile;
  };
  providerStatus: ProviderStatus[];
  providerErrors: string[];
  selectedScore: number;
  candidates?: CandidateDebug[];
  selectedProvider?: string;
  selectedPassId?: string;
  selectedPreprocessProfile?: PreprocessProfile;
};

export type AnalyzeUploadRequest = {
  base64: string;
  mimeType?: string;
  forceProvider?: string;
  debug?: boolean;
};

export type ProviderStatus = {
  provider: string;
  configured: boolean;
  status: "enabled" | "skipped";
  reason: string | null;
};

export type CandidateDebug = {
  provider: string;
  passId: string;
  preprocessProfile: PreprocessProfile;
  score: number;
  scoreBreakdown: {
    topologyScore: number;
    openingScore: number;
    scaleScore: number;
    penalty: number;
    total: number;
  };
  metrics: {
    wallCount: number;
    openingCount: number;
    exteriorDetected: boolean;
    openingsAttachedRatio: number;
    scaleConfidence: number;
    scaleSource: ScaleSource;
  };
  errors: string[];
  timingMs: number;
};

export type AnalyzeUploadResult =
  | {
      ok: true;
      status: 200;
      data: TopologyPayload;
    }
  | {
      ok: false;
      status: 422 | 500;
      error: {
        recoverable: boolean;
        errorCode: string;
        details: string;
        providerStatus: ProviderStatus[];
        providerErrors: string[];
        candidates?: CandidateDebug[];
      };
    };

type PreprocessProfile = "balanced" | "lineart";

type ProviderName = "anthropic" | "openai" | "snaptrude";

type Candidate = {
  provider: ProviderName;
  passId: string;
  preprocessProfile: PreprocessProfile;
  walls: TopologyWall[];
  openings: TopologyOpening[];
  scale: number;
  scaleInfo: ScaleInfo;
  score: number;
  scoreBreakdown: CandidateDebug["scoreBreakdown"];
  metrics: CandidateDebug["metrics"];
  errors: string[];
  elapsedMs: number;
};

const WallSchema = z.object({
  id: z.string(),
  start: z.tuple([z.number(), z.number()]),
  end: z.tuple([z.number(), z.number()]),
  thickness: z.number(),
  type: z.enum(["exterior", "interior", "balcony", "column"]),
  length: z.number(),
  isPartOfBalcony: z.boolean(),
  confidence: z.number().optional()
});

const OpeningSchema = z.object({
  id: z.string(),
  wallId: z.string(),
  type: z.enum(["door", "window", "sliding_door", "double_door", "passage"]),
  position: z.tuple([z.number(), z.number()]),
  width: z.number(),
  offset: z.number(),
  height: z.number().optional(),
  isEntrance: z.boolean().optional(),
  detectConfidence: z.number().optional(),
  attachConfidence: z.number().optional(),
  typeConfidence: z.number().optional()
});

const NormalizedTopologySchema = z.object({
  walls: z.array(WallSchema).min(1),
  openings: z.array(OpeningSchema),
  scale: z.number(),
  scaleInfo: z.object({
    value: z.number(),
    source: z.enum(["ocr_dimension", "door_heuristic", "user_measure", "unknown"]),
    confidence: z.number(),
    evidence: z
      .object({
        mmValue: z.number().optional(),
        pxDistance: z.number().optional(),
        p1: z.tuple([z.number(), z.number()]).optional(),
        p2: z.tuple([z.number(), z.number()]).optional(),
        ocrText: z.string().optional(),
        notes: z.string().optional()
      })
      .optional()
  })
});

type NormalizedTopology = {
  walls: TopologyWall[];
  openings: TopologyOpening[];
  scale: number;
  scaleInfo: ScaleInfo;
};

const PROVIDER_ORDER = (process.env.FLOORPLAN_PROVIDER_ORDER ?? "anthropic,openai,snaptrude")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter((value): value is ProviderName => value === "anthropic" || value === "openai" || value === "snaptrude");

const PROVIDER_TIMEOUT_MS = Number(process.env.FLOORPLAN_PROVIDER_TIMEOUT_MS ?? 45000);

function stripDataUrl(dataUrl: string) {
  const matched = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matched) return { mimeType: "image/png", base64: dataUrl };
  return {
    mimeType: matched[1] ?? "image/png",
    base64: matched[2] ?? ""
  };
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonCandidate(raw: string): unknown {
  const direct = safeJsonParse(raw);
  if (direct) return direct;
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = safeJsonParse(fenced[1]);
    if (parsed) return parsed;
  }
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const parsed = safeJsonParse(raw.slice(first, last + 1));
    if (parsed) return parsed;
  }
  return null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function resolveProviderStatus(provider: ProviderName): ProviderStatus {
  if (provider === "anthropic") {
    const configured = Boolean(process.env.ANTHROPIC_API_KEY);
    return {
      provider,
      configured,
      status: configured ? "enabled" : "skipped",
      reason: configured ? null : "ANTHROPIC_API_KEY is missing."
    };
  }
  if (provider === "openai") {
    const configured = Boolean(process.env.OPENAI_API_KEY);
    return {
      provider,
      configured,
      status: configured ? "enabled" : "skipped",
      reason: configured ? null : "OPENAI_API_KEY is missing."
    };
  }
  const configured = Boolean(process.env.SNAPTRUDE_API_URL);
  return {
    provider,
    configured,
    status: configured ? "enabled" : "skipped",
    reason: configured ? null : "SNAPTRUDE_API_URL is missing."
  };
}

function toNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
}

function asVec2(value: unknown): Vec2 | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const x = Number(record.x ?? record.X ?? record.left);
    const y = Number(record.y ?? record.Y ?? record.top);
    if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
  }
  return null;
}

function distance(a: Vec2, b: Vec2) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function normalizeScaleInfo(rawScaleInfo: unknown, scale: number): ScaleInfo {
  const unknown = {
    value: scale,
    source: "unknown" as const,
    confidence: 0,
    evidence: {
      notes: "Scale was not confidently detected."
    }
  };

  if (!rawScaleInfo || typeof rawScaleInfo !== "object" || Array.isArray(rawScaleInfo)) {
    return unknown;
  }

  const record = rawScaleInfo as Record<string, unknown>;
  let source: ScaleSource =
    record.source === "ocr_dimension" ||
    record.source === "door_heuristic" ||
    record.source === "user_measure" ||
    record.source === "unknown"
      ? record.source
      : "unknown";

  let confidence = Math.max(0, Math.min(1, toNumber(record.confidence, source === "unknown" ? 0 : 0.6)));
  const evidence =
    record.evidence && typeof record.evidence === "object" && !Array.isArray(record.evidence)
      ? (record.evidence as Record<string, unknown>)
      : {};

  const normalizedEvidence: ScaleInfo["evidence"] = {
    ...(Number.isFinite(Number(evidence.mmValue)) ? { mmValue: Number(evidence.mmValue) } : {}),
    ...(Number.isFinite(Number(evidence.pxDistance)) ? { pxDistance: Number(evidence.pxDistance) } : {}),
    ...(asVec2(evidence.p1) ? { p1: asVec2(evidence.p1) ?? undefined } : {}),
    ...(asVec2(evidence.p2) ? { p2: asVec2(evidence.p2) ?? undefined } : {}),
    ...(typeof evidence.ocrText === "string" ? { ocrText: evidence.ocrText } : {}),
    ...(typeof evidence.notes === "string" ? { notes: evidence.notes } : {})
  };

  const hasStrongEvidence = Boolean(
    normalizedEvidence &&
      Number.isFinite(normalizedEvidence.mmValue) &&
      Number.isFinite(normalizedEvidence.pxDistance) &&
      (normalizedEvidence.ocrText || (normalizedEvidence.p1 && normalizedEvidence.p2))
  );

  if (source === "unknown" && hasStrongEvidence) {
    source = "ocr_dimension";
    confidence = Math.max(confidence, 0.65);
  }

  return {
    value: toNumber(record.value, scale),
    source,
    confidence,
    ...(Object.keys(normalizedEvidence ?? {}).length > 0 ? { evidence: normalizedEvidence } : {})
  };
}

function unwrapTopologyPayload(input: unknown): Record<string, unknown> {
  let current = input;
  const keys = ["topology", "floorplan", "result", "data", "output", "payload"];
  for (let i = 0; i < 5; i += 1) {
    if (!current || typeof current !== "object" || Array.isArray(current)) break;
    const record = current as Record<string, unknown>;
    const nestedKey = keys.find((key) => record[key] && typeof record[key] === "object");
    if (!nestedKey) break;
    current = record[nestedKey] as unknown;
  }
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    return {};
  }
  return current as Record<string, unknown>;
}

function normalizeTopology(raw: unknown): NormalizedTopology {
  const payload = unwrapTopologyPayload(raw);

  const wallSourceRaw = payload.walls ?? payload.wallSegments ?? payload.lines ?? payload.segments ?? [];
  const wallSource = Array.isArray(wallSourceRaw) ? wallSourceRaw : [];

  const walls = wallSource
    .map<TopologyWall | null>((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const start = asVec2(record.start ?? record.from ?? [record.x1, record.y1]);
      const end = asVec2(record.end ?? record.to ?? [record.x2, record.y2]);
      if (!start || !end) return null;
      const thickness = Math.max(2, toNumber(record.thickness, 12));
      const typeRaw = typeof record.type === "string" ? record.type.toLowerCase() : "interior";
      const type: TopologyWall["type"] =
        typeRaw === "exterior" || typeRaw === "balcony" || typeRaw === "column" ? (typeRaw as TopologyWall["type"]) : "interior";
      return {
        id: typeof record.id === "string" && record.id.length > 0 ? record.id : `w${index + 1}`,
        start,
        end,
        thickness,
        type,
        length: distance(start, end),
        isPartOfBalcony: type === "balcony" || Boolean(record.isPartOfBalcony),
        ...(Number.isFinite(Number(record.confidence)) ? { confidence: Number(record.confidence) } : {})
      };
    })
    .filter((wall): wall is TopologyWall => wall !== null);

  const openingsFromArray = (source: unknown, forcedType?: TopologyOpening["type"]): TopologyOpening[] => {
    const list = Array.isArray(source) ? source : [];
    return list
      .map<TopologyOpening | null>((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const record = item as Record<string, unknown>;
        const position = asVec2(record.position ?? record.center ?? [record.x, record.y]);
        if (!position) return null;

        let wallId = typeof record.wallId === "string" ? record.wallId : typeof record.wall_id === "string" ? record.wall_id : "";

        const openingTypeRaw = forcedType ?? (typeof record.type === "string" ? record.type.toLowerCase() : "door");
        const openingType: TopologyOpening["type"] =
          openingTypeRaw === "window" ||
          openingTypeRaw === "sliding_door" ||
          openingTypeRaw === "double_door" ||
          openingTypeRaw === "passage"
            ? (openingTypeRaw as TopologyOpening["type"])
            : "door";

        if (!wallId && walls.length > 0) {
          const nearest = walls
            .map((wall) => {
              const cx = (wall.start[0] + wall.end[0]) / 2;
              const cy = (wall.start[1] + wall.end[1]) / 2;
              return {
                wall,
                d: Math.hypot(position[0] - cx, position[1] - cy)
              };
            })
            .sort((a, b) => a.d - b.d)[0];
          wallId = nearest?.wall.id ?? walls[0].id;
        }

        const parentWall = walls.find((wall) => wall.id === wallId) ?? walls[0];
        if (!parentWall) return null;
        const offset = Number.isFinite(Number(record.offset))
          ? Number(record.offset)
          : Math.max(0, Math.min(parentWall.length, distance(parentWall.start, position)));

        return {
          id: typeof record.id === "string" && record.id.length > 0 ? record.id : `o${index + 1}`,
          wallId: parentWall.id,
          type: openingType,
          position,
          width: Math.max(20, toNumber(record.width, openingType === "window" ? 120 : 90)),
          offset,
          ...(Number.isFinite(Number(record.height))
            ? { height: Math.max(40, Number(record.height)) }
            : {}),
          ...(record.isEntrance ? { isEntrance: true } : {}),
          ...(Number.isFinite(Number(record.detectConfidence))
            ? { detectConfidence: Number(record.detectConfidence) }
            : {}),
          ...(Number.isFinite(Number(record.attachConfidence))
            ? { attachConfidence: Number(record.attachConfidence) }
            : {}),
          ...(Number.isFinite(Number(record.typeConfidence))
            ? { typeConfidence: Number(record.typeConfidence) }
            : {})
        };
      })
      .filter((opening): opening is TopologyOpening => opening !== null);
  };

  const openings = [
    ...openingsFromArray(payload.openings),
    ...openingsFromArray(payload.doors, "door"),
    ...openingsFromArray(payload.windows, "window")
  ];

  const scale = Math.max(0.0001, toNumber(payload.scale ?? (payload.metadata as Record<string, unknown> | undefined)?.scale, 1));
  const scaleInfo = normalizeScaleInfo(payload.scaleInfo ?? (payload.metadata as Record<string, unknown> | undefined)?.scaleInfo, scale);

  const parsed = NormalizedTopologySchema.parse({
    walls,
    openings,
    scale,
    scaleInfo
  });

  return {
    walls: parsed.walls as TopologyWall[],
    openings: parsed.openings as TopologyOpening[],
    scale: parsed.scale,
    scaleInfo: parsed.scaleInfo as ScaleInfo
  };
}

function scoreCandidate(candidate: {
  walls: TopologyWall[];
  openings: TopologyOpening[];
  scaleInfo: ScaleInfo;
}): {
  total: number;
  breakdown: CandidateDebug["scoreBreakdown"];
  metrics: CandidateDebug["metrics"];
} {
  const wallCount = candidate.walls.length;
  const openingCount = candidate.openings.length;
  const exteriorDetected = candidate.walls.some((wall) => wall.type === "exterior");
  const attachedOpenings = candidate.openings.filter((opening) => candidate.walls.some((wall) => wall.id === opening.wallId));
  const openingsAttachedRatio = openingCount === 0 ? 1 : attachedOpenings.length / openingCount;

  const topologyScore = Math.min(60, wallCount * 2.5 + (exteriorDetected ? 10 : 0));
  const openingScore = Math.min(20, openingCount * 2 + openingsAttachedRatio * 5);
  const scaleScore = Math.min(20, Math.max(0, candidate.scaleInfo.confidence * 20));

  let penalty = 0;
  if (wallCount < 4) penalty += 20;
  if (openingsAttachedRatio < 0.6) penalty += 8;
  if (candidate.scaleInfo.source === "unknown") penalty += 4;

  const total = Math.max(0, topologyScore + openingScore + scaleScore - penalty);

  return {
    total,
    breakdown: {
      topologyScore,
      openingScore,
      scaleScore,
      penalty,
      total
    },
    metrics: {
      wallCount,
      openingCount,
      exteriorDetected,
      openingsAttachedRatio,
      scaleConfidence: candidate.scaleInfo.confidence,
      scaleSource: candidate.scaleInfo.source
    }
  };
}

function makePrompt() {
  return [
    "Analyze this architectural floorplan image and return strict JSON only.",
    "Focus on structural geometry (walls and openings). Ignore furniture labels and decorative text.",
    "Output schema:",
    "{",
    "  \"scale\": number,",
    "  \"scaleInfo\": { \"value\": number, \"source\": \"ocr_dimension|door_heuristic|user_measure|unknown\", \"confidence\": number, \"evidence\": { \"mmValue\"?: number, \"pxDistance\"?: number, \"ocrText\"?: string } },",
    "  \"walls\": [{ \"id\": string, \"start\": [number, number], \"end\": [number, number], \"thickness\": number, \"type\": \"exterior|interior\", \"confidence\"?: number }],",
    "  \"openings\": [{ \"id\": string, \"wallId\": string, \"type\": \"door|window\", \"position\": [number, number], \"width\": number, \"height\": number, \"offset\"?: number, \"isEntrance\"?: boolean, \"detectConfidence\"?: number, \"attachConfidence\"?: number, \"typeConfidence\"?: number }]",
    "}",
    "Do not include markdown fences. JSON only."
  ].join("\n");
}

async function analyzeWithAnthropic(base64: string, mimeType: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing.");
  const anthropic = new Anthropic({ apiKey });
  const model = (process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest").split(",")[0]?.trim() || "claude-3-5-sonnet-latest";

  const message = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64
            }
          },
          {
            type: "text",
            text: makePrompt()
          }
        ]
      }
    ]
  });

  const text = message.content
    .filter((item) => item.type === "text")
    .map((item) => (item.type === "text" ? item.text : ""))
    .join("\n");

  const parsed = extractJsonCandidate(text);
  if (!parsed) throw new Error("Anthropic returned non-JSON output.");
  return parsed;
}

async function analyzeWithOpenAI(dataUrl: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing.");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: makePrompt()
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ]
      })
    },
    PROVIDER_TIMEOUT_MS
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as any;
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new Error("OpenAI response content is empty.");
  }

  const parsed = extractJsonCandidate(text);
  if (!parsed) throw new Error("OpenAI returned non-JSON output.");
  return parsed;
}

async function analyzeWithSnaptrude(dataUrl: string, mimeType: string) {
  const url = process.env.SNAPTRUDE_API_URL;
  if (!url) throw new Error("SNAPTRUDE_API_URL is missing.");

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SNAPTRUDE_API_KEY ? { Authorization: `Bearer ${process.env.SNAPTRUDE_API_KEY}` } : {})
      },
      body: JSON.stringify({
        image: dataUrl,
        mimeType,
        mode: "topology"
      })
    },
    PROVIDER_TIMEOUT_MS
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Snaptrude request failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as any;
  if (!payload || typeof payload !== "object") {
    throw new Error("Snaptrude returned invalid payload.");
  }
  return payload;
}

async function preprocessImage(base64: string, profile: PreprocessProfile) {
  const source = Buffer.from(base64, "base64");
  const normalized = sharp(source).grayscale().normalize();

  const configured = profile === "lineart"
    ? normalized
        .median(Math.max(1, Number(process.env.FLOORPLAN_PREPROCESS_LINEART_MEDIAN ?? 2)))
        .blur(Number(process.env.FLOORPLAN_PREPROCESS_LINEART_BLUR ?? 0.15))
        .linear(
          Number(process.env.FLOORPLAN_PREPROCESS_LINEART_CONTRAST ?? 1.45),
          Number(process.env.FLOORPLAN_PREPROCESS_LINEART_BRIGHTNESS ?? -20)
        )
        .threshold(Number(process.env.FLOORPLAN_PREPROCESS_LINEART_THRESHOLD ?? 218))
    : normalized
        .median(Math.max(1, Number(process.env.FLOORPLAN_PREPROCESS_MEDIAN ?? 3)))
        .blur(Number(process.env.FLOORPLAN_PREPROCESS_BLUR ?? 0.3))
        .linear(
          Number(process.env.FLOORPLAN_PREPROCESS_CONTRAST ?? 1.25),
          Number(process.env.FLOORPLAN_PREPROCESS_BRIGHTNESS ?? -15)
        )
        .threshold(Number(process.env.FLOORPLAN_PREPROCESS_THRESHOLD ?? 200));

  const output = await configured.png().toBuffer();
  return output.toString("base64");
}

async function runProvider(provider: ProviderName, pass: { passId: string; profile: PreprocessProfile; base64: string; mimeType: string }) {
  const imageDataUrl = `data:${pass.mimeType};base64,${pass.base64}`;
  const start = Date.now();
  try {
    const payload =
      provider === "anthropic"
        ? await analyzeWithAnthropic(pass.base64, pass.mimeType)
        : provider === "openai"
          ? await analyzeWithOpenAI(imageDataUrl)
          : await analyzeWithSnaptrude(imageDataUrl, pass.mimeType);

    const normalized = normalizeTopology(payload);
    const scored = scoreCandidate({
      walls: normalized.walls,
      openings: normalized.openings,
      scaleInfo: normalized.scaleInfo
    });

    return {
      ok: true as const,
      candidate: {
        provider,
        passId: pass.passId,
        preprocessProfile: pass.profile,
        walls: normalized.walls,
        openings: normalized.openings,
        scale: normalized.scale,
        scaleInfo: normalized.scaleInfo,
        score: scored.total,
        scoreBreakdown: scored.breakdown,
        metrics: scored.metrics,
        errors: [],
        elapsedMs: Date.now() - start
      }
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - start
    };
  }
}

function toCandidateDebug(candidate: Candidate): CandidateDebug {
  return {
    provider: candidate.provider,
    passId: candidate.passId,
    preprocessProfile: candidate.preprocessProfile,
    score: candidate.score,
    scoreBreakdown: candidate.scoreBreakdown,
    metrics: candidate.metrics,
    errors: candidate.errors,
    timingMs: candidate.elapsedMs
  };
}

export async function analyzeFloorplanUpload(request: AnalyzeUploadRequest): Promise<AnalyzeUploadResult> {
  try {
    const stripped = stripDataUrl(request.base64);
    const mimeType = request.mimeType ?? stripped.mimeType ?? "image/png";
    const base64 = stripped.base64;
    const sourceBuffer = Buffer.from(base64, "base64");
    const metadata = await sharp(sourceBuffer).metadata();

    const providerOrder = request.forceProvider
      ? [request.forceProvider.toLowerCase()]
      : PROVIDER_ORDER.length > 0
        ? PROVIDER_ORDER
        : ["anthropic"];

    const resolvedProviderOrder = providerOrder.filter(
      (provider): provider is ProviderName => provider === "anthropic" || provider === "openai" || provider === "snaptrude"
    );

    const providerStatus = resolvedProviderOrder.map((provider) => resolveProviderStatus(provider));
    const enabledProviders = providerStatus.filter((entry) => entry.status === "enabled").map((entry) => entry.provider as ProviderName);

    const preprocessPasses: Array<{ passId: string; profile: PreprocessProfile; base64: string; mimeType: string }> = [];
    for (const [index, profile] of (["balanced", "lineart"] as PreprocessProfile[]).entries()) {
      try {
        const processedBase64 = await preprocessImage(base64, profile);
        preprocessPasses.push({
          passId: `pass${index + 1}`,
          profile,
          base64: processedBase64,
          mimeType: "image/png"
        });
      } catch {
        preprocessPasses.push({
          passId: `pass${index + 1}`,
          profile,
          base64,
          mimeType
        });
      }
    }

    if (enabledProviders.length === 0) {
      return {
        ok: false,
        status: 422,
        error: {
          recoverable: true,
          errorCode: "PROVIDER_NOT_CONFIGURED",
          details: "No AI provider is configured. Configure ANTHROPIC_API_KEY, OPENAI_API_KEY, or SNAPTRUDE_API_URL.",
          providerStatus,
          providerErrors: providerStatus.filter((entry) => entry.reason).map((entry) => `${entry.provider}: ${entry.reason}`)
        }
      };
    }

    const candidates: Candidate[] = [];
    const providerErrors: string[] = [];

    for (const provider of enabledProviders) {
      for (const pass of preprocessPasses) {
        const run = await runProvider(provider, pass);
        if (run.ok) {
          candidates.push(run.candidate);
        } else {
          providerErrors.push(`${provider}/${pass.passId}: ${run.error}`);
          candidates.push({
            provider,
            passId: pass.passId,
            preprocessProfile: pass.profile,
            walls: [],
            openings: [],
            scale: 1,
            scaleInfo: {
              value: 1,
              source: "unknown",
              confidence: 0,
              evidence: { notes: run.error }
            },
            score: 0,
            scoreBreakdown: {
              topologyScore: 0,
              openingScore: 0,
              scaleScore: 0,
              penalty: 0,
              total: 0
            },
            metrics: {
              wallCount: 0,
              openingCount: 0,
              exteriorDetected: false,
              openingsAttachedRatio: 0,
              scaleConfidence: 0,
              scaleSource: "unknown"
            },
            errors: [run.error],
            elapsedMs: run.elapsedMs
          });
        }
      }
    }

    const selected = candidates
      .filter((candidate) => candidate.walls.length > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (!selected || selected.score < Number(process.env.FLOORPLAN_MIN_ACCEPT_SCORE ?? 25)) {
      return {
        ok: false,
        status: 422,
        error: {
          recoverable: true,
          errorCode: "TOPOLOGY_EXTRACTION_FAILED",
          details: "Unable to extract a reliable topology. Continue with manual 2D correction.",
          providerStatus,
          providerErrors,
          ...(request.debug ? { candidates: candidates.map(toCandidateDebug) } : {})
        }
      };
    }

    const doors = selected.openings.filter((opening) => opening.type === "door" || opening.type === "double_door" || opening.type === "sliding_door").length;
    const windows = selected.openings.filter((opening) => opening.type === "window").length;

    const response: TopologyPayload = {
      metadata: {
        imageWidth: metadata.width ?? 0,
        imageHeight: metadata.height ?? 0,
        scale: selected.scale,
        scaleInfo: selected.scaleInfo,
        unit: "pixels",
        confidence: Math.max(0.1, Math.min(1, selected.score / 100)),
        analysisCompleteness: {
          totalWallSegments: selected.walls.length,
          exteriorWalls: selected.walls.filter((wall) => wall.type === "exterior").length,
          interiorWalls: selected.walls.filter((wall) => wall.type === "interior").length,
          totalOpenings: selected.openings.length,
          doors,
          windows,
          balconies: selected.walls.filter((wall) => wall.type === "balcony").length,
          columns: selected.walls.filter((wall) => wall.type === "column").length
        }
      },
      walls: selected.walls,
      openings: selected.openings,
      source: selected.provider,
      cacheHit: false,
      selection: {
        sourceModule: "provider",
        selectedScore: selected.score,
        selectedPassId: selected.passId,
        preprocessProfile: selected.preprocessProfile
      },
      providerStatus,
      providerErrors,
      selectedScore: selected.score,
      ...(request.debug
        ? {
            selectedProvider: selected.provider,
            selectedPassId: selected.passId,
            selectedPreprocessProfile: selected.preprocessProfile,
            candidates: candidates.map(toCandidateDebug)
          }
        : {})
    };

    return {
      ok: true,
      status: 200,
      data: response
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 500,
      error: {
        recoverable: true,
        errorCode: "INTERNAL_ANALYSIS_ERROR",
        details: message,
        providerStatus: [],
        providerErrors: [message]
      }
    };
  }
}
