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

export type SemanticRoomType =
  | "living_room"
  | "bedroom"
  | "kitchen"
  | "dining"
  | "bathroom"
  | "foyer"
  | "corridor"
  | "balcony"
  | "utility"
  | "pantry"
  | "dress_room"
  | "alpha_room"
  | "service_area"
  | "evacuation_space"
  | "other";

export type RoomHint = {
  id: string;
  label: string;
  normalizedLabel: string;
  roomType: SemanticRoomType;
  position: Vec2;
  polygon?: Vec2[];
  confidence: number;
  source: "ocr" | "provider";
};

export type DimensionAnnotation = {
  id: string;
  text: string;
  mmValue?: number;
  p1?: Vec2;
  p2?: Vec2;
  pxDistance?: number;
  confidence: number;
  orientation?: "horizontal" | "vertical" | "diagonal";
  source: "ocr" | "provider";
};

export type SemanticAnnotations = {
  roomHints: RoomHint[];
  dimensionAnnotations: DimensionAnnotation[];
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
  semanticAnnotations: SemanticAnnotations;
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
    axisAlignedRatio: number;
    orphanWallCount: number;
    selfIntersectionCount: number;
    exteriorDetected: boolean;
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
    exteriorLoopClosed: boolean;
    entranceDetected: boolean;
    roomHintCount: number;
    labeledRoomHintCount: number;
    dimensionAnnotationCount: number;
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

type PreprocessProfile = "balanced" | "lineart" | "filled_plan";

type ProviderName = "anthropic" | "openai" | "snaptrude";

type Candidate = {
  provider: ProviderName;
  passId: string;
  preprocessProfile: PreprocessProfile;
  walls: TopologyWall[];
  openings: TopologyOpening[];
  scale: number;
  scaleInfo: ScaleInfo;
  semanticAnnotations: SemanticAnnotations;
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

const RoomHintSchema = z.object({
  id: z.string(),
  label: z.string(),
  normalizedLabel: z.string(),
  roomType: z.enum([
    "living_room",
    "bedroom",
    "kitchen",
    "dining",
    "bathroom",
    "foyer",
    "corridor",
    "balcony",
    "utility",
    "pantry",
    "dress_room",
    "alpha_room",
    "service_area",
    "evacuation_space",
    "other"
  ]),
  position: z.tuple([z.number(), z.number()]),
  polygon: z.array(z.tuple([z.number(), z.number()])).optional(),
  confidence: z.number(),
  source: z.enum(["ocr", "provider"])
});

const DimensionAnnotationSchema = z.object({
  id: z.string(),
  text: z.string(),
  mmValue: z.number().optional(),
  p1: z.tuple([z.number(), z.number()]).optional(),
  p2: z.tuple([z.number(), z.number()]).optional(),
  pxDistance: z.number().optional(),
  confidence: z.number(),
  orientation: z.enum(["horizontal", "vertical", "diagonal"]).optional(),
  source: z.enum(["ocr", "provider"])
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
  }),
  semanticAnnotations: z.object({
    roomHints: z.array(RoomHintSchema),
    dimensionAnnotations: z.array(DimensionAnnotationSchema)
  })
});

type NormalizedTopology = {
  walls: TopologyWall[];
  openings: TopologyOpening[];
  scale: number;
  scaleInfo: ScaleInfo;
  semanticAnnotations: SemanticAnnotations;
};

const PROVIDER_ORDER = (process.env.FLOORPLAN_PROVIDER_ORDER ?? "anthropic,openai,snaptrude")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter((value): value is ProviderName => value === "anthropic" || value === "openai" || value === "snaptrude");

const PROVIDER_TIMEOUT_MS = Number(process.env.FLOORPLAN_PROVIDER_TIMEOUT_MS ?? 45000);
const PREPROCESS_PROFILES = (process.env.FLOORPLAN_PREPROCESS_PROFILES ?? "balanced,lineart,filled_plan")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter((value): value is PreprocessProfile => value === "balanced" || value === "lineart" || value === "filled_plan");

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

function asPolygon(value: unknown): Vec2[] | null {
  if (!Array.isArray(value)) return null;
  const points = value.map((point) => asVec2(point)).filter((point): point is Vec2 => Boolean(point));
  return points.length >= 3 ? points : null;
}

function distance(a: Vec2, b: Vec2) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function averagePoint(points: Vec2[]): Vec2 {
  if (points.length === 0) return [0, 0];
  const [sumX, sumY] = points.reduce<[number, number]>(
    (accumulator, point) => [accumulator[0] + point[0], accumulator[1] + point[1]],
    [0, 0]
  );
  return [sumX / points.length, sumY / points.length];
}

function formatNumberForKey(value: number) {
  if (!Number.isFinite(value)) return "na";
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
}

function pointKey(point?: Vec2) {
  return point ? `${formatNumberForKey(point[0])},${formatNumberForKey(point[1])}` : "na";
}

function polygonKey(polygon?: Vec2[]) {
  return polygon && polygon.length > 0 ? polygon.map((point) => pointKey(point)).join(";") : "na";
}

function normalizeSemanticLabel(text: string) {
  return text
    .trim()
    .replace(/\s+/g, "")
    .replace(/[·•ㆍ.\-_/()[\]{}]/g, "")
    .toLowerCase();
}

function inferRoomTypeFromLabel(label: string): SemanticRoomType {
  const normalized = normalizeSemanticLabel(label);
  if (!normalized) return "other";
  if (normalized.includes("대피공간") || normalized.includes("evacuation")) return "evacuation_space";
  if (normalized.includes("알파룸") || normalized.includes("알파")) return "alpha_room";
  if (normalized.includes("드레스룸") || normalized.includes("드레스") || normalized.includes("dress")) return "dress_room";
  if (normalized.includes("팬트리") || normalized.includes("pantry")) return "pantry";
  if (normalized.includes("다용도실") || normalized.includes("세탁실") || normalized.includes("utility")) return "utility";
  if (normalized.includes("서비스") || normalized.includes("실외기실") || normalized.includes("service")) return "service_area";
  if (normalized.includes("발코니") || normalized.includes("베란다") || normalized.includes("balcony") || normalized.includes("terrace"))
    return "balcony";
  if (normalized.includes("현관") || normalized.includes("foyer") || normalized.includes("entry")) return "foyer";
  if (normalized.includes("복도") || normalized.includes("corridor") || normalized.includes("hall")) return "corridor";
  if (
    normalized.includes("욕실") ||
    normalized.includes("화장실") ||
    normalized.includes("bathroom") ||
    normalized.includes("toilet") ||
    normalized.includes("wc")
  ) {
    return "bathroom";
  }
  if (normalized.includes("주방식당") || normalized.includes("kitchendining")) return "kitchen";
  if (normalized.includes("주방") || normalized.includes("kitchen")) return "kitchen";
  if (normalized.includes("식당") || normalized.includes("다이닝") || normalized.includes("dining")) return "dining";
  if (normalized.includes("거실") || normalized.includes("living")) return "living_room";
  if (
    normalized.includes("침실") ||
    normalized.includes("안방") ||
    normalized.includes("작은방") ||
    normalized.includes("bedroom") ||
    /^방\d*$/.test(normalized)
  ) {
    return "bedroom";
  }
  return "other";
}

function parseDimensionMmValue(text: string, orientation?: DimensionAnnotation["orientation"]) {
  const raw = text.trim();
  if (!raw) return null;
  if (/[평㎡]/.test(raw) || /m²|m2|sq\.?\s*m|sqm/i.test(raw)) return null;

  const compact = raw.replace(/\s+/g, "");
  const numericTokens = compact.match(/\d+(?:[.,]\d+)?/g);
  if (!numericTokens || numericTokens.length === 0) return null;

  let chosen = [...numericTokens].sort((left, right) => right.length - left.length)[0]!;
  if ((compact.includes("x") || compact.includes("X") || compact.includes("×")) && numericTokens.length >= 2) {
    if (orientation === "horizontal") {
      chosen = numericTokens[0]!;
    } else if (orientation === "vertical") {
      chosen = numericTokens[1]!;
    }
  }

  const normalized = chosen.replace(/,/g, "");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;

  if (/cm/i.test(compact)) return Math.round(value * 10);
  if (/mm|㎜/i.test(compact)) return Math.round(value);
  if (/m/i.test(compact) || normalized.includes(".")) {
    if (value >= 1 && value <= 50) return Math.round(value * 1000);
  }
  if (value >= 100 && value <= 50000) return Math.round(value);
  return null;
}

function getDimensionOrientation(p1?: Vec2, p2?: Vec2): DimensionAnnotation["orientation"] | undefined {
  if (!p1 || !p2) return undefined;
  const dx = Math.abs(p2[0] - p1[0]);
  const dy = Math.abs(p2[1] - p1[1]);
  const tolerance = Math.max(2, Math.max(dx, dy) * 0.06);
  if (dx <= tolerance) return "vertical";
  if (dy <= tolerance) return "horizontal";
  return "diagonal";
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  }
  return sorted[middle] ?? 0;
}

function orderVec2(a: Vec2, b: Vec2): [Vec2, Vec2] {
  if (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])) {
    return [a, b];
  }
  return [b, a];
}

function arePointsNear(a: Vec2, b: Vec2, tolerance = 12) {
  return distance(a, b) <= tolerance;
}

function isAxisAlignedWall(wall: Pick<TopologyWall, "start" | "end" | "length">) {
  const dx = Math.abs(wall.end[0] - wall.start[0]);
  const dy = Math.abs(wall.end[1] - wall.start[1]);
  const tolerance = Math.max(6, wall.length * 0.08);
  return dx <= tolerance || dy <= tolerance;
}

function getWallOrientation(wall: Pick<TopologyWall, "start" | "end" | "length">) {
  if (!isAxisAlignedWall(wall)) return "diagonal" as const;
  const dx = Math.abs(wall.end[0] - wall.start[0]);
  const dy = Math.abs(wall.end[1] - wall.start[1]);
  return dx >= dy ? ("horizontal" as const) : ("vertical" as const);
}

function snapWallToAxis(wall: TopologyWall): TopologyWall {
  let start = [...wall.start] as Vec2;
  let end = [...wall.end] as Vec2;
  const tolerance = Math.max(6, wall.length * 0.08);
  const dx = Math.abs(end[0] - start[0]);
  const dy = Math.abs(end[1] - start[1]);

  if (dx <= tolerance) {
    const avgX = (start[0] + end[0]) / 2;
    start = [avgX, start[1]];
    end = [avgX, end[1]];
  } else if (dy <= tolerance) {
    const avgY = (start[1] + end[1]) / 2;
    start = [start[0], avgY];
    end = [end[0], avgY];
  }

  const [orderedStart, orderedEnd] = orderVec2(start, end);
  return {
    ...wall,
    start: orderedStart,
    end: orderedEnd,
    length: distance(orderedStart, orderedEnd)
  };
}

function pointToSegmentProjection(point: Vec2, wall: Pick<TopologyWall, "start" | "end" | "length">) {
  const [ax, ay] = wall.start;
  const [bx, by] = wall.end;
  const abx = bx - ax;
  const aby = by - ay;
  const abLengthSquared = abx * abx + aby * aby;
  if (abLengthSquared === 0) {
    return {
      distance: distance(point, wall.start),
      offset: 0,
      t: 0,
      projected: wall.start
    };
  }

  const apx = point[0] - ax;
  const apy = point[1] - ay;
  const rawT = (apx * abx + apy * aby) / abLengthSquared;
  const t = clamp(rawT, 0, 1);
  const projected: Vec2 = [ax + abx * t, ay + aby * t];
  return {
    distance: distance(point, projected),
    offset: wall.length * t,
    t,
    projected
  };
}

function haveSameEndpoints(a: TopologyWall, b: TopologyWall, tolerance = 12) {
  return (
    (arePointsNear(a.start, b.start, tolerance) && arePointsNear(a.end, b.end, tolerance)) ||
    (arePointsNear(a.start, b.end, tolerance) && arePointsNear(a.end, b.start, tolerance))
  );
}

function dedupeWalls(walls: TopologyWall[]) {
  const deduped: TopologyWall[] = [];
  for (const wall of walls) {
    const duplicateIndex = deduped.findIndex(
      (existing) =>
        existing.type === wall.type &&
        Math.abs(existing.thickness - wall.thickness) <= 12 &&
        haveSameEndpoints(existing, wall)
    );

    if (duplicateIndex >= 0) {
      const existing = deduped[duplicateIndex];
      deduped[duplicateIndex] = {
        ...existing,
        thickness: Math.max(existing.thickness, wall.thickness),
        confidence: Math.max(existing.confidence ?? 0, wall.confidence ?? 0)
      };
      continue;
    }

    deduped.push(wall);
  }
  return deduped;
}

function canMergeWalls(a: TopologyWall, b: TopologyWall) {
  if (a.type !== b.type) return false;
  if (a.isPartOfBalcony !== b.isPartOfBalcony) return false;
  if (Math.abs(a.thickness - b.thickness) > 12) return false;

  const orientationA = getWallOrientation(a);
  const orientationB = getWallOrientation(b);
  if (orientationA === "diagonal" || orientationA !== orientationB) return false;

  if (orientationA === "horizontal") {
    if (Math.abs(a.start[1] - b.start[1]) > 10) return false;
    const aMin = Math.min(a.start[0], a.end[0]);
    const aMax = Math.max(a.start[0], a.end[0]);
    const bMin = Math.min(b.start[0], b.end[0]);
    const bMax = Math.max(b.start[0], b.end[0]);
    return Math.max(aMin, bMin) <= Math.min(aMax, bMax) + 18;
  }

  if (Math.abs(a.start[0] - b.start[0]) > 10) return false;
  const aMin = Math.min(a.start[1], a.end[1]);
  const aMax = Math.max(a.start[1], a.end[1]);
  const bMin = Math.min(b.start[1], b.end[1]);
  const bMax = Math.max(b.start[1], b.end[1]);
  return Math.max(aMin, bMin) <= Math.min(aMax, bMax) + 18;
}

function mergeWalls(a: TopologyWall, b: TopologyWall): TopologyWall {
  const orientation = getWallOrientation(a);
  if (orientation === "horizontal") {
    const y = (a.start[1] + a.end[1] + b.start[1] + b.end[1]) / 4;
    const minX = Math.min(a.start[0], a.end[0], b.start[0], b.end[0]);
    const maxX = Math.max(a.start[0], a.end[0], b.start[0], b.end[0]);
    const start: Vec2 = [minX, y];
    const end: Vec2 = [maxX, y];
    return {
      ...a,
      start,
      end,
      length: distance(start, end),
      thickness: Math.max(a.thickness, b.thickness),
      confidence: Math.max(a.confidence ?? 0, b.confidence ?? 0)
    };
  }

  const x = (a.start[0] + a.end[0] + b.start[0] + b.end[0]) / 4;
  const minY = Math.min(a.start[1], a.end[1], b.start[1], b.end[1]);
  const maxY = Math.max(a.start[1], a.end[1], b.start[1], b.end[1]);
  const start: Vec2 = [x, minY];
  const end: Vec2 = [x, maxY];
  return {
    ...a,
    start,
    end,
    length: distance(start, end),
    thickness: Math.max(a.thickness, b.thickness),
    confidence: Math.max(a.confidence ?? 0, b.confidence ?? 0)
  };
}

function mergeAxisAlignedWalls(walls: TopologyWall[]) {
  const merged = [...walls];
  let changed = true;

  while (changed) {
    changed = false;
    outer: for (let i = 0; i < merged.length; i += 1) {
      for (let j = i + 1; j < merged.length; j += 1) {
        if (!canMergeWalls(merged[i]!, merged[j]!)) continue;
        merged[i] = mergeWalls(merged[i]!, merged[j]!);
        merged.splice(j, 1);
        changed = true;
        break outer;
      }
    }
  }

  return merged.map((wall) => snapWallToAxis(wall));
}

function sanitizeWalls(walls: TopologyWall[]) {
  if (walls.length === 0) return [];
  const snapped = walls.map((wall) => snapWallToAxis(wall));
  const wallLengths = snapped.map((wall) => wall.length).filter((length) => Number.isFinite(length) && length > 0);
  const medianLength = median(wallLengths);
  const minWallLength = snapped.length >= 8 ? clamp(medianLength * 0.12, 12, 56) : 10;
  const filtered = snapped.filter((wall) => wall.type === "column" || wall.length >= minWallLength);
  return mergeAxisAlignedWalls(dedupeWalls(filtered));
}

function getOpeningConfidence(opening: Pick<TopologyOpening, "detectConfidence" | "attachConfidence" | "typeConfidence">) {
  const values = [opening.detectConfidence, opening.attachConfidence, opening.typeConfidence].filter(
    (value): value is number => Number.isFinite(value)
  );
  if (values.length === 0) return 0.55;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function resolveOpeningAttachment(position: Vec2, walls: TopologyWall[], preferredWallId?: string) {
  const preferredWall = preferredWallId ? walls.find((wall) => wall.id === preferredWallId) : undefined;
  const candidates = walls
    .map((wall) => {
      const projection = pointToSegmentProjection(position, wall);
      return {
        wall,
        ...projection
      };
    })
    .sort((a, b) => a.distance - b.distance);

  const preferredProjection = preferredWall ? candidates.find((candidate) => candidate.wall.id === preferredWall.id) : undefined;
  const best = preferredProjection && preferredProjection.distance <= Math.max(20, preferredProjection.wall.thickness * 3.5)
    ? preferredProjection
    : candidates[0];

  if (!best) return null;
  const attachThreshold = Math.max(24, best.wall.thickness * 4, best.wall.length * 0.04);
  if (best.distance > attachThreshold) {
    return null;
  }

  return best;
}

function filterOverlappingOpenings(openings: TopologyOpening[]) {
  const grouped = new Map<string, TopologyOpening[]>();
  for (const opening of openings) {
    const list = grouped.get(opening.wallId) ?? [];
    list.push(opening);
    grouped.set(opening.wallId, list);
  }

  const kept: TopologyOpening[] = [];
  for (const list of grouped.values()) {
    const sorted = [...list].sort((a, b) => a.offset - b.offset);
    const accepted: TopologyOpening[] = [];

    for (const opening of sorted) {
      const overlappingIndex = accepted.findIndex((candidate) => {
        const start = Math.max(candidate.offset, opening.offset);
        const end = Math.min(candidate.offset + candidate.width, opening.offset + opening.width);
        return end - start > Math.min(candidate.width, opening.width) * 0.6;
      });

      if (overlappingIndex < 0) {
        accepted.push(opening);
        continue;
      }

      const existing = accepted[overlappingIndex]!;
      const winner =
        getOpeningConfidence(opening) + (opening.isEntrance ? 0.15 : 0) >
        getOpeningConfidence(existing) + (existing.isEntrance ? 0.15 : 0)
          ? opening
          : existing;

      accepted[overlappingIndex] = winner;
    }

    kept.push(...accepted);
  }

  return kept;
}

function countScaleEvidenceCompleteness(scaleInfo: ScaleInfo) {
  const evidence = scaleInfo.evidence;
  if (!evidence) return 0;
  let score = 0;
  if (Number.isFinite(evidence.mmValue)) score += 0.35;
  if (Number.isFinite(evidence.pxDistance)) score += 0.35;
  if (typeof evidence.ocrText === "string" && evidence.ocrText.trim().length > 0) score += 0.15;
  if (evidence.p1 && evidence.p2) score += 0.15;
  return clamp(score, 0, 1);
}

function dedupeDimensionAnnotations(items: DimensionAnnotation[]) {
  const byKey = new Map<string, DimensionAnnotation>();
  for (const item of items) {
    const key = [
      normalizeSemanticLabel(item.text),
      item.mmValue ?? "na",
      pointKey(item.p1),
      pointKey(item.p2),
      item.pxDistance !== undefined ? formatNumberForKey(item.pxDistance) : "na",
      item.orientation ?? "na"
    ].join("|");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const existingSignal =
      existing.confidence +
      (existing.mmValue ? 0.2 : 0) +
      (existing.p1 && existing.p2 ? 0.2 : 0) +
      (existing.pxDistance ? 0.1 : 0);
    const nextSignal =
      item.confidence +
      (item.mmValue ? 0.2 : 0) +
      (item.p1 && item.p2 ? 0.2 : 0) +
      (item.pxDistance ? 0.1 : 0);
    if (nextSignal > existingSignal) {
      byKey.set(key, item);
    }
  }

  return [...byKey.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([_, item], index) => ({
      ...item,
      id: `dim${index + 1}`
    }));
}

function dedupeRoomHints(items: RoomHint[]) {
  const byKey = new Map<string, RoomHint>();
  for (const item of items) {
    const key = [item.normalizedLabel, item.roomType, pointKey(item.position), polygonKey(item.polygon)].join("|");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const existingSignal = existing.confidence + (existing.roomType !== "other" ? 0.25 : 0) + (existing.polygon ? 0.25 : 0);
    const nextSignal = item.confidence + (item.roomType !== "other" ? 0.25 : 0) + (item.polygon ? 0.25 : 0);
    if (nextSignal > existingSignal) {
      byKey.set(key, item);
    }
  }

  return [...byKey.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([_, item], index) => ({
      ...item,
      id: `rh${index + 1}`
    }));
}

function normalizeSemanticAnnotations(payload: Record<string, unknown>): SemanticAnnotations {
  const semanticPayload =
    payload.semanticAnnotations && typeof payload.semanticAnnotations === "object" && !Array.isArray(payload.semanticAnnotations)
      ? (payload.semanticAnnotations as Record<string, unknown>)
      : {};
  const roomHintSources = [
    semanticPayload.roomHints,
    semanticPayload.roomLabels,
    semanticPayload.rooms,
    payload.roomHints,
    payload.roomLabels,
    payload.rooms,
    (payload.annotations as Record<string, unknown> | undefined)?.roomHints,
    (payload.annotations as Record<string, unknown> | undefined)?.roomLabels,
    (payload.annotations as Record<string, unknown> | undefined)?.rooms
  ];
  const dimensionSources = [
    semanticPayload.dimensionAnnotations,
    semanticPayload.dimensions,
    payload.dimensionAnnotations,
    payload.dimensions,
    (payload.annotations as Record<string, unknown> | undefined)?.dimensionAnnotations,
    (payload.annotations as Record<string, unknown> | undefined)?.dimensions
  ];

  const roomHints = dedupeRoomHints(
    roomHintSources.flatMap((source) => {
      const list = Array.isArray(source) ? source : [];
      return list
        .map<RoomHint | null>((item, index) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const record = item as Record<string, unknown>;
          const polygon = asPolygon(record.polygon ?? record.outline ?? record.points ?? record.vertices);
          const position =
            asVec2(record.position ?? record.center ?? [record.x, record.y]) ??
            (polygon ? averagePoint(polygon) : null);
          const rawLabel =
            typeof record.label === "string"
              ? record.label
              : typeof record.text === "string"
                ? record.text
                : typeof record.name === "string"
                  ? record.name
                  : "";
          const label = rawLabel.trim();
          if (!position || !label) return null;
          const normalizedLabel = normalizeSemanticLabel(label);
          const explicitRoomType = typeof record.roomType === "string" ? record.roomType : "";
          const genericType = typeof record.type === "string" ? record.type : "";
          const inferredFromStructuredType = inferRoomTypeFromLabel(explicitRoomType || genericType);
          const inferredRoomType =
            inferredFromStructuredType !== "other" ? inferredFromStructuredType : inferRoomTypeFromLabel(label);
          return {
            id: typeof record.id === "string" && record.id.length > 0 ? record.id : `rh-source-${index + 1}`,
            label,
            normalizedLabel,
            roomType: inferredRoomType,
            position,
            ...(polygon ? { polygon } : {}),
            confidence: clamp(toNumber(record.confidence, inferredRoomType === "other" ? 0.45 : 0.7), 0, 1),
            source: (record.source === "ocr" ? "ocr" : "provider") as "ocr" | "provider"
          };
        })
        .filter((item): item is RoomHint => Boolean(item));
    })
  );

  const dimensionAnnotations = dedupeDimensionAnnotations(
    dimensionSources.flatMap((source) => {
      const list = Array.isArray(source) ? source : [];
      return list
        .map<DimensionAnnotation | null>((item, index) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const record = item as Record<string, unknown>;
          const text =
            typeof record.text === "string"
              ? record.text
              : typeof record.label === "string"
                ? record.label
                : typeof record.ocrText === "string"
                  ? record.ocrText
                  : "";
          if (!text.trim()) return null;

          const p1 = asVec2(record.p1 ?? record.start ?? record.from ?? record.a);
          const p2 = asVec2(record.p2 ?? record.end ?? record.to ?? record.b);
          const orientation =
            record.orientation === "horizontal" || record.orientation === "vertical" || record.orientation === "diagonal"
              ? record.orientation
              : getDimensionOrientation(p1 ?? undefined, p2 ?? undefined);
          const pxDistance =
            Number.isFinite(Number(record.pxDistance))
              ? Number(record.pxDistance)
              : p1 && p2
                ? distance(p1, p2)
                : undefined;
          const mmValue = Number.isFinite(Number(record.mmValue))
            ? Number(record.mmValue)
            : parseDimensionMmValue(text, orientation);

          if (!mmValue && !pxDistance) return null;

          return {
            id: typeof record.id === "string" && record.id.length > 0 ? record.id : `dim-source-${index + 1}`,
            text,
            ...(Number.isFinite(mmValue) ? { mmValue: Number(mmValue) } : {}),
            ...(p1 ? { p1 } : {}),
            ...(p2 ? { p2 } : {}),
            ...(Number.isFinite(pxDistance) ? { pxDistance } : {}),
            confidence: clamp(toNumber(record.confidence, Number.isFinite(mmValue) && Number.isFinite(pxDistance) ? 0.85 : 0.55), 0, 1),
            orientation,
            source: (record.source === "ocr" ? "ocr" : "provider") as "ocr" | "provider"
          };
        })
        .filter((item): item is DimensionAnnotation => Boolean(item));
    })
  );

  return {
    roomHints,
    dimensionAnnotations
  };
}

function deriveScaleInfoFromDimensions(dimensionAnnotations: DimensionAnnotation[]) {
  const candidates = dimensionAnnotations
    .map((annotation) => {
      const mmValue = annotation.mmValue;
      const pxDistance =
        annotation.pxDistance ??
        (annotation.p1 && annotation.p2 ? distance(annotation.p1, annotation.p2) : undefined);
      if (!Number.isFinite(mmValue) || !Number.isFinite(pxDistance) || !pxDistance || pxDistance <= 0) return null;
      const metersPerPixel = mmValue / 1000 / pxDistance;
      if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0.0001 || metersPerPixel >= 0.5) return null;
      return {
        annotation,
        metersPerPixel,
        pxDistance
      };
    })
    .filter(
      (
        entry
      ): entry is {
        annotation: DimensionAnnotation;
        metersPerPixel: number;
        pxDistance: number;
      } => Boolean(entry)
    )
    .sort((left, right) => right.annotation.confidence - left.annotation.confidence || right.pxDistance - left.pxDistance);

  if (candidates.length === 0) return null;

  const strongest = candidates[0]!;
  const cluster = candidates.filter((candidate) => {
    const drift = Math.abs(candidate.metersPerPixel - strongest.metersPerPixel) / strongest.metersPerPixel;
    return drift <= 0.14;
  });

  const totalWeight = cluster.reduce((sum, candidate) => sum + Math.max(0.1, candidate.annotation.confidence), 0);
  const weightedScale =
    cluster.reduce((sum, candidate) => sum + candidate.metersPerPixel * Math.max(0.1, candidate.annotation.confidence), 0) /
    Math.max(totalWeight, 0.1);

  return {
    value: weightedScale,
    source: "ocr_dimension" as const,
    confidence: clamp(0.62 + Math.min(0.28, cluster.length * 0.07) + strongest.annotation.confidence * 0.1, 0, 0.98),
    evidence: {
      mmValue: strongest.annotation.mmValue,
      pxDistance: strongest.pxDistance,
      ...(strongest.annotation.p1 ? { p1: strongest.annotation.p1 } : {}),
      ...(strongest.annotation.p2 ? { p2: strongest.annotation.p2 } : {}),
      ocrText: strongest.annotation.text,
      notes: `Derived from ${cluster.length} dimension annotation(s).`
    }
  };
}

function deriveScaleValueFromEvidence(evidence: ScaleInfo["evidence"] | undefined) {
  if (!evidence) return null;
  const mmValue = Number(evidence.mmValue);
  const pxDistance = Number.isFinite(Number(evidence.pxDistance))
    ? Number(evidence.pxDistance)
    : evidence.p1 && evidence.p2
      ? distance(evidence.p1, evidence.p2)
      : NaN;
  if (!Number.isFinite(mmValue) || !Number.isFinite(pxDistance) || pxDistance <= 0) {
    return null;
  }
  const metersPerPixel = mmValue / 1000 / pxDistance;
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0.0001 || metersPerPixel >= 0.5) {
    return null;
  }
  return metersPerPixel;
}

export function normalizeScaleInfo(rawScaleInfo: unknown, scale: number, dimensionAnnotations: DimensionAnnotation[] = []): ScaleInfo {
  const unknown = {
    value: scale,
    source: "unknown" as const,
    confidence: 0,
    evidence: {
      notes: "Scale was not confidently detected."
    }
  };
  const record =
    rawScaleInfo && typeof rawScaleInfo === "object" && !Array.isArray(rawScaleInfo)
      ? (rawScaleInfo as Record<string, unknown>)
      : {};
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

  const evidenceCompleteness = countScaleEvidenceCompleteness({
    value: scale,
    source,
    confidence,
    ...(Object.keys(normalizedEvidence ?? {}).length > 0 ? { evidence: normalizedEvidence } : {})
  });
  const hasStrongEvidence = evidenceCompleteness >= 0.7;

  if (source === "unknown" && hasStrongEvidence) {
    source = "ocr_dimension";
    confidence = Math.max(confidence, 0.7);
  }

  const dimensionDerived = deriveScaleInfoFromDimensions(dimensionAnnotations);
  const evidenceDerivedValue = deriveScaleValueFromEvidence(normalizedEvidence);
  const currentValue = evidenceDerivedValue ?? toNumber(record.value, scale);
  if (
    dimensionDerived &&
    (source === "unknown" ||
      confidence < 0.62 ||
      evidenceCompleteness < 0.55 ||
      (currentValue > 0 && Math.abs(dimensionDerived.value - currentValue) / currentValue <= 0.16 && dimensionDerived.confidence > confidence))
  ) {
    return dimensionDerived;
  }

  if (Object.keys(record).length === 0) {
    return unknown;
  }

  return {
    value: currentValue,
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

export function normalizeTopology(raw: unknown): NormalizedTopology {
  const payload = unwrapTopologyPayload(raw);
  const semanticAnnotations = normalizeSemanticAnnotations(payload);

  const wallSourceRaw = payload.walls ?? payload.wallSegments ?? payload.lines ?? payload.segments ?? [];
  const wallSource = Array.isArray(wallSourceRaw) ? wallSourceRaw : [];

  const walls = sanitizeWalls(
    wallSource
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
    .filter((wall): wall is TopologyWall => wall !== null)
  );

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

        const attachment = resolveOpeningAttachment(position, walls, wallId || undefined);
        if (!attachment) return null;
        const parentWall = attachment.wall;
        wallId = parentWall.id;
        const inferredOffset = attachment.offset;
        const openingWidth = Math.max(20, toNumber(record.width, openingType === "window" ? 120 : 90));
        const normalizedOffset = Number.isFinite(Number(record.offset)) ? Number(record.offset) : inferredOffset;
        const offset = clamp(normalizedOffset, 0, Math.max(0, parentWall.length - Math.min(openingWidth, parentWall.length)));
        const attachConfidence = Number.isFinite(Number(record.attachConfidence))
          ? clamp(Number(record.attachConfidence), 0, 1)
          : clamp(1 - attachment.distance / Math.max(24, parentWall.thickness * 4), 0.25, 0.95);

        return {
          id: typeof record.id === "string" && record.id.length > 0 ? record.id : `o${index + 1}`,
          wallId: parentWall.id,
          type: openingType,
          position,
          width: Math.min(openingWidth, Math.max(20, parentWall.length * 0.8 || openingWidth)),
          offset,
          ...(Number.isFinite(Number(record.height))
            ? { height: Math.max(40, Number(record.height)) }
            : {}),
          ...(record.isEntrance ? { isEntrance: true } : {}),
          ...(Number.isFinite(Number(record.detectConfidence))
            ? { detectConfidence: Number(record.detectConfidence) }
            : {}),
          attachConfidence,
          ...(Number.isFinite(Number(record.typeConfidence))
            ? { typeConfidence: Number(record.typeConfidence) }
            : {})
        };
      })
      .filter((opening): opening is TopologyOpening => opening !== null)
      .filter((opening) => getOpeningConfidence(opening) >= 0.25 || opening.isEntrance === true);
  };

  const openings = filterOverlappingOpenings([
    ...openingsFromArray(payload.openings),
    ...openingsFromArray(payload.doors, "door"),
    ...openingsFromArray(payload.windows, "window")
  ]);

  const rawScale = Math.max(0.0001, toNumber(payload.scale ?? (payload.metadata as Record<string, unknown> | undefined)?.scale, 1));
  const scaleInfo = normalizeScaleInfo(
    payload.scaleInfo ?? (payload.metadata as Record<string, unknown> | undefined)?.scaleInfo,
    rawScale,
    semanticAnnotations.dimensionAnnotations
  );
  const scale = Math.max(0.0001, scaleInfo.value);

  const parsed = NormalizedTopologySchema.parse({
    walls,
    openings,
    scale,
    scaleInfo,
    semanticAnnotations
  });

  return {
    walls: parsed.walls as TopologyWall[],
    openings: parsed.openings as TopologyOpening[],
    scale: parsed.scale,
    scaleInfo: parsed.scaleInfo as ScaleInfo,
    semanticAnnotations: parsed.semanticAnnotations as SemanticAnnotations
  };
}

function countNodeDegrees(walls: TopologyWall[]) {
  const nodes: Vec2[] = [];
  const degrees = new Map<number, number>();

  const findNodeIndex = (point: Vec2) => {
    const existingIndex = nodes.findIndex((node) => arePointsNear(node, point));
    if (existingIndex >= 0) return existingIndex;
    nodes.push(point);
    return nodes.length - 1;
  };

  for (const wall of walls) {
    const startIndex = findNodeIndex(wall.start);
    const endIndex = findNodeIndex(wall.end);
    degrees.set(startIndex, (degrees.get(startIndex) ?? 0) + 1);
    degrees.set(endIndex, (degrees.get(endIndex) ?? 0) + 1);
  }

  return {
    getDegree(point: Vec2) {
      const nodeIndex = nodes.findIndex((node) => arePointsNear(node, point));
      return nodeIndex >= 0 ? degrees.get(nodeIndex) ?? 0 : 0;
    }
  };
}

function orientation(a: Vec2, b: Vec2, c: Vec2) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-6) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a: Vec2, b: Vec2, c: Vec2) {
  return (
    b[0] <= Math.max(a[0], c[0]) + 1e-6 &&
    b[0] >= Math.min(a[0], c[0]) - 1e-6 &&
    b[1] <= Math.max(a[1], c[1]) + 1e-6 &&
    b[1] >= Math.min(a[1], c[1]) - 1e-6
  );
}

function segmentsIntersect(a: TopologyWall, b: TopologyWall) {
  if (
    arePointsNear(a.start, b.start) ||
    arePointsNear(a.start, b.end) ||
    arePointsNear(a.end, b.start) ||
    arePointsNear(a.end, b.end)
  ) {
    return false;
  }

  const o1 = orientation(a.start, a.end, b.start);
  const o2 = orientation(a.start, a.end, b.end);
  const o3 = orientation(b.start, b.end, a.start);
  const o4 = orientation(b.start, b.end, a.end);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a.start, b.start, a.end)) return true;
  if (o2 === 0 && onSegment(a.start, b.end, a.end)) return true;
  if (o3 === 0 && onSegment(b.start, a.start, b.end)) return true;
  if (o4 === 0 && onSegment(b.start, a.end, b.end)) return true;
  return false;
}

export function scoreCandidate(candidate: {
  walls: TopologyWall[];
  openings: TopologyOpening[];
  scaleInfo: ScaleInfo;
  semanticAnnotations?: SemanticAnnotations;
}): {
  total: number;
  breakdown: CandidateDebug["scoreBreakdown"];
  metrics: CandidateDebug["metrics"];
} {
  const wallCount = candidate.walls.length;
  const openingCount = candidate.openings.length;
  const exteriorWalls = candidate.walls.filter((wall) => wall.type === "exterior");
  const exteriorDetected = exteriorWalls.length > 0;
  const attachedOpenings = candidate.openings.filter((opening) => candidate.walls.some((wall) => wall.id === opening.wallId));
  const openingsAttachedRatio = openingCount === 0 ? 1 : attachedOpenings.length / openingCount;
  const axisAlignedRatio = wallCount === 0 ? 0 : candidate.walls.filter((wall) => isAxisAlignedWall(wall)).length / wallCount;
  const nodeDegrees = countNodeDegrees(candidate.walls);
  const orphanWallCount = candidate.walls.filter(
    (wall) => nodeDegrees.getDegree(wall.start) <= 1 && nodeDegrees.getDegree(wall.end) <= 1
  ).length;
  let selfIntersectionCount = 0;
  for (let i = 0; i < candidate.walls.length; i += 1) {
    for (let j = i + 1; j < candidate.walls.length; j += 1) {
      if (segmentsIntersect(candidate.walls[i]!, candidate.walls[j]!)) {
        selfIntersectionCount += 1;
      }
    }
  }

  const thicknessMedian = median(candidate.walls.map((wall) => wall.thickness));
  const wallThicknessOutlierRate =
    wallCount === 0 || thicknessMedian === 0
      ? 0
      : candidate.walls.filter((wall) => wall.thickness > thicknessMedian * 3 || wall.thickness < thicknessMedian * 0.33).length / wallCount;

  let openingOverlapCount = 0;
  for (let i = 0; i < candidate.openings.length; i += 1) {
    for (let j = i + 1; j < candidate.openings.length; j += 1) {
      const a = candidate.openings[i]!;
      const b = candidate.openings[j]!;
      if (a.wallId !== b.wallId) continue;
      const start = Math.max(a.offset, b.offset);
      const end = Math.min(a.offset + a.width, b.offset + b.width);
      if (end - start > Math.min(a.width, b.width) * 0.5) openingOverlapCount += 1;
    }
  }

  const openingOutOfWallRangeCount = candidate.openings.filter((opening) => {
    const wall = candidate.walls.find((entry) => entry.id === opening.wallId);
    if (!wall) return true;
    return opening.offset < 0 || opening.offset + opening.width > wall.length + 4;
  }).length;

  const exteriorDegrees = countNodeDegrees(exteriorWalls);
  const loopCountPenalty = exteriorWalls.filter(
    (wall) => exteriorDegrees.getDegree(wall.start) < 2 || exteriorDegrees.getDegree(wall.end) < 2
  ).length;
  const exteriorLoopClosed = exteriorDetected && loopCountPenalty === 0;

  const exteriorAreaSanity =
    exteriorWalls.length >= 4 &&
    (() => {
      const xs = exteriorWalls.flatMap((wall) => [wall.start[0], wall.end[0]]);
      const ys = exteriorWalls.flatMap((wall) => [wall.start[1], wall.end[1]]);
      const width = Math.max(...xs) - Math.min(...xs);
      const height = Math.max(...ys) - Math.min(...ys);
      return width > 40 && height > 40 && width / Math.max(height, 1) < 8 && height / Math.max(width, 1) < 8;
    })();

  const openingTypeConfidenceMean =
    openingCount === 0 ? 0.5 : candidate.openings.reduce((sum, opening) => sum + getOpeningConfidence(opening), 0) / openingCount;
  const scaleEvidenceCompleteness = countScaleEvidenceCompleteness(candidate.scaleInfo);
  const entranceDetected = candidate.openings.some((opening) => opening.isEntrance === true);
  const roomHintCount = candidate.semanticAnnotations?.roomHints.length ?? 0;
  const labeledRoomHintCount =
    candidate.semanticAnnotations?.roomHints.filter((roomHint) => roomHint.roomType !== "other").length ?? 0;
  const dimensionAnnotationCount = candidate.semanticAnnotations?.dimensionAnnotations.length ?? 0;

  const topologyScore = Math.min(
    65,
    wallCount * 1.8 +
      axisAlignedRatio * 12 +
      (exteriorDetected ? 6 : 0) +
      (exteriorLoopClosed ? 10 : 0) +
      (exteriorAreaSanity ? 5 : 0) +
      Math.max(0, 10 - orphanWallCount * 2) +
      Math.max(0, 8 - selfIntersectionCount * 3)
  );
  const openingScore = Math.min(
    20,
    openingCount * 1.5 + openingsAttachedRatio * 6 + openingTypeConfidenceMean * 4 + (entranceDetected ? 2 : 0)
  );
  const scaleScore = Math.min(15, candidate.scaleInfo.confidence * 9 + scaleEvidenceCompleteness * 6);

  let penalty = 0;
  if (wallCount < 4) penalty += 20;
  if (openingsAttachedRatio < 0.6) penalty += 8;
  if (axisAlignedRatio < 0.55) penalty += 8;
  if (candidate.scaleInfo.source === "unknown") penalty += 4;
  penalty += orphanWallCount * 1.5;
  penalty += selfIntersectionCount * 4;
  penalty += openingOverlapCount * 3;
  penalty += openingOutOfWallRangeCount * 4;
  penalty += wallThicknessOutlierRate * 10;
  penalty += loopCountPenalty * 2;

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
      axisAlignedRatio,
      orphanWallCount,
      selfIntersectionCount,
      exteriorDetected,
      openingsAttachedRatio,
      wallThicknessOutlierRate,
      openingOverlapCount,
      openingOutOfWallRangeCount,
      exteriorAreaSanity,
      openingTypeConfidenceMean,
      loopCountPenalty,
      scaleConfidence: candidate.scaleInfo.confidence,
      scaleEvidenceCompleteness,
      scaleSource: candidate.scaleInfo.source,
      exteriorLoopClosed,
      entranceDetected,
      roomHintCount,
      labeledRoomHintCount,
      dimensionAnnotationCount
    }
  };
}

function makePrompt() {
  return [
    "Analyze this architectural floorplan image and return strict JSON only.",
    "Focus on structural geometry (walls and openings), room labels, and dimension callouts.",
    "Ignore furniture labels, branding, and decorative text.",
    "If Korean room names or dimension numbers are visible, include them in roomHints or dimensionAnnotations.",
    "Output schema:",
    "{",
    "  \"scale\": number,",
    "  \"scaleInfo\": { \"value\": number, \"source\": \"ocr_dimension|door_heuristic|user_measure|unknown\", \"confidence\": number, \"evidence\": { \"mmValue\"?: number, \"pxDistance\"?: number, \"ocrText\"?: string } },",
    "  \"walls\": [{ \"id\": string, \"start\": [number, number], \"end\": [number, number], \"thickness\": number, \"type\": \"exterior|interior\", \"confidence\"?: number }],",
    "  \"openings\": [{ \"id\": string, \"wallId\": string, \"type\": \"door|window|sliding_door|double_door|passage\", \"position\": [number, number], \"width\": number, \"height\"?: number, \"offset\"?: number, \"isEntrance\"?: boolean, \"detectConfidence\"?: number, \"attachConfidence\"?: number, \"typeConfidence\"?: number }],",
    "  \"roomHints\"?: [{ \"id\"?: string, \"label\": string, \"roomType\"?: \"living_room|bedroom|kitchen|dining|bathroom|foyer|corridor|balcony|utility|pantry|dress_room|alpha_room|service_area|evacuation_space|other\", \"position\": [number, number], \"polygon\"?: [[number, number], ...], \"confidence\"?: number }],",
    "  \"dimensionAnnotations\"?: [{ \"id\"?: string, \"text\": string, \"mmValue\"?: number, \"p1\"?: [number, number], \"p2\"?: [number, number], \"pxDistance\"?: number, \"confidence\"?: number, \"orientation\"?: \"horizontal|vertical|diagonal\" }]",
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
    : profile === "filled_plan"
      ? normalized
          .median(Math.max(1, Number(process.env.FLOORPLAN_PREPROCESS_FILLED_MEDIAN ?? 5)))
          .blur(Number(process.env.FLOORPLAN_PREPROCESS_FILLED_BLUR ?? 0.9))
          .linear(
            Number(process.env.FLOORPLAN_PREPROCESS_FILLED_CONTRAST ?? 1.6),
            Number(process.env.FLOORPLAN_PREPROCESS_FILLED_BRIGHTNESS ?? -24)
          )
          .sharpen(Number(process.env.FLOORPLAN_PREPROCESS_FILLED_SHARPEN ?? 1.2))
          .threshold(Number(process.env.FLOORPLAN_PREPROCESS_FILLED_THRESHOLD ?? 188))
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
      scaleInfo: normalized.scaleInfo,
      semanticAnnotations: normalized.semanticAnnotations
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
        semanticAnnotations: normalized.semanticAnnotations,
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

    const preprocessProfiles = PREPROCESS_PROFILES.length > 0 ? PREPROCESS_PROFILES : (["balanced", "lineart", "filled_plan"] as PreprocessProfile[]);
    const preprocessPasses: Array<{ passId: string; profile: PreprocessProfile; base64: string; mimeType: string }> = [];
    for (const [index, profile] of preprocessProfiles.entries()) {
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
            semanticAnnotations: {
              roomHints: [],
              dimensionAnnotations: []
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
              axisAlignedRatio: 0,
              orphanWallCount: 0,
              selfIntersectionCount: 0,
              exteriorDetected: false,
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
              exteriorLoopClosed: false,
              entranceDetected: false,
              roomHintCount: 0,
              labeledRoomHintCount: 0,
              dimensionAnnotationCount: 0
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
      semanticAnnotations: selected.semanticAnnotations,
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
