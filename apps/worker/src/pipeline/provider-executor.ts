import sharp from "sharp";
import {
  analyzeFloorplanUpload,
  getDimensionOrientation,
  inferRoomTypeFromLabel,
  normalizeSemanticLabel,
  normalizeTopology,
  parseDimensionMmValue,
  scoreCandidate,
  type AnalyzeUploadResult,
  type CandidateDebug,
  type DimensionAnnotation,
  type ProviderStatus,
  type RoomHint,
  type SemanticAnnotations,
  type TopologyPayload,
  type Vec2
} from "@plan2space/floorplan-core";

type ExecuteProvidersPayload = {
  base64: string;
  mimeType: string;
  debug?: boolean;
};

type ExternalCandidate = {
  provider: string;
  payload: TopologyPayload;
  debug: CandidateDebug;
};

const PROVIDER_TIMEOUT_MS = Number(process.env.FLOORPLAN_PROVIDER_TIMEOUT_MS ?? 45000);
const FLOORPLAN_MIN_ACCEPT_SCORE = Number(process.env.FLOORPLAN_MIN_ACCEPT_SCORE ?? 25);

function stripDataUrl(dataUrl: string) {
  const matched = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matched) {
    return {
      mimeType: "image/png",
      base64: dataUrl
    };
  }
  return {
    mimeType: matched[1] ?? "image/png",
    base64: matched[2] ?? ""
  };
}

function makePrompt() {
  return [
    "Analyze this architectural floorplan image and return strict JSON only.",
    "Focus on walls, openings, room labels, and dimension callouts.",
    "If room names or dimension numbers are visible, preserve them in semantic annotations."
  ].join("\n");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
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

function pointFromBox(box: number[] | Vec2[]) {
  if (!Array.isArray(box) || box.length === 0) return null;
  if (Array.isArray(box[0])) {
    const points = box as Vec2[];
    const avgX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
    const avgY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
    return [avgX, avgY] as Vec2;
  }
  const values = box as number[];
  if (values.length >= 4) {
    const [x1, y1, x2, y2] = values;
    return [(Number(x1) + Number(x2)) / 2, (Number(y1) + Number(y2)) / 2] as Vec2;
  }
  return null;
}

function polygonFromBox(box: number[] | Vec2[]) {
  if (!Array.isArray(box) || box.length === 0) return null;
  if (Array.isArray(box[0])) {
    const points = (box as Vec2[]).filter(
      (point): point is Vec2 => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
    );
    return points.length >= 3 ? points : null;
  }
  const values = box as number[];
  if (values.length < 4) return null;
  const [x1, y1, x2, y2] = values.map((value) => Number(value));
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2]
  ] as Vec2[];
}

function normalizePredictionPolygon(prediction: Record<string, unknown>) {
  const polygon =
    prediction.points ??
    prediction.polygon ??
    prediction.vertices ??
    prediction.segmentation ??
    prediction.contour ??
    prediction.box;

  if (Array.isArray(polygon)) {
    if (polygon.length > 0 && Array.isArray(polygon[0])) {
      const points = polygon as Vec2[];
      return points.filter(
        (point): point is Vec2 => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
      );
    }

    if (polygon.length > 0 && typeof polygon[0] === "object") {
      const points = (polygon as Array<Record<string, unknown>>)
        .map((point) => {
          const x = Number(point.x ?? point.X ?? point.left);
          const y = Number(point.y ?? point.Y ?? point.top);
          return Number.isFinite(x) && Number.isFinite(y) ? ([x, y] as Vec2) : null;
        })
        .filter((point): point is Vec2 => Boolean(point));
      return points.length >= 2 ? points : [];
    }
  }

  const x = Number(prediction.x ?? prediction.center_x);
  const y = Number(prediction.y ?? prediction.center_y);
  const width = Number(prediction.width ?? prediction.w ?? prediction.bbox_width);
  const height = Number(prediction.height ?? prediction.h ?? prediction.bbox_height);
  if ([x, y, width, height].every(Number.isFinite)) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    return [
      [x - halfWidth, y - halfHeight],
      [x + halfWidth, y - halfHeight],
      [x + halfWidth, y + halfHeight],
      [x - halfWidth, y + halfHeight]
    ] as Vec2[];
  }

  return [];
}

function wallFromPolygon(
  polygon: Vec2[],
  prediction: Record<string, unknown>,
  index: number,
  type: "exterior" | "interior" | "balcony" | "column"
) {
  if (polygon.length < 2) return null;
  const xs = polygon.map((point) => point[0]);
  const ys = polygon.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const horizontal = width >= height;
  const start: Vec2 = horizontal ? [minX, (minY + maxY) / 2] : [(minX + maxX) / 2, minY];
  const end: Vec2 = horizontal ? [maxX, (minY + maxY) / 2] : [(minX + maxX) / 2, maxY];
  const thickness = Math.max(2, horizontal ? height : width, Number(prediction.strokeWidth ?? prediction.thickness ?? 8));
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  if (!Number.isFinite(length) || length <= 0) return null;

  return {
    id: typeof prediction.id === "string" ? prediction.id : `rf-wall-${index + 1}`,
    start,
    end,
    thickness,
    type,
    length,
    isPartOfBalcony: type === "balcony",
    confidence: clamp(toNumber(prediction.confidence, 0.65), 0, 1)
  };
}

function classifyOpeningType(label: string) {
  if (label.includes("window")) return "window" as const;
  if (label.includes("sliding")) return "sliding_door" as const;
  if (label.includes("double")) return "double_door" as const;
  if (label.includes("passage")) return "passage" as const;
  return "door" as const;
}

function classifyWallType(label: string) {
  if (label.includes("balcony")) return "balcony" as const;
  if (label.includes("column")) return "column" as const;
  if (label.includes("exterior") || label.includes("outer")) return "exterior" as const;
  return "interior" as const;
}

function predictionCenter(prediction: Record<string, unknown>, polygon: Vec2[]) {
  const point = pointFromBox(polygon.length >= 3 ? polygon : (prediction.box as number[] | Vec2[]));
  if (point) return point;
  const x = Number(prediction.x ?? prediction.center_x);
  const y = Number(prediction.y ?? prediction.center_y);
  return Number.isFinite(x) && Number.isFinite(y) ? ([x, y] as Vec2) : null;
}

function parseRoboflowPayload(payload: unknown, provider: string) {
  const record = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  const topologyCandidate =
    record.topology ??
    record.result ??
    (record.predictions && record.walls ? record : null) ??
    null;
  if (topologyCandidate && typeof topologyCandidate === "object") {
    return topologyCandidate;
  }

  const predictionsSource =
    (Array.isArray(record.predictions) && record.predictions) ||
    (Array.isArray((record.results as Record<string, unknown> | undefined)?.predictions)
      ? ((record.results as Record<string, unknown>).predictions as unknown[])
      : null) ||
    [];

  const walls: Record<string, unknown>[] = [];
  const openings: Record<string, unknown>[] = [];
  const roomHints: Record<string, unknown>[] = [];

  predictionsSource.forEach((prediction, index) => {
    if (!prediction || typeof prediction !== "object" || Array.isArray(prediction)) return;
    const recordPrediction = prediction as Record<string, unknown>;
    const rawClass =
      typeof recordPrediction.class === "string"
        ? recordPrediction.class
        : typeof recordPrediction.label === "string"
          ? recordPrediction.label
          : typeof recordPrediction.name === "string"
            ? recordPrediction.name
            : "";
    const label = rawClass.trim();
    if (!label) return;
    const normalized = normalizeSemanticLabel(label);
    const polygon = normalizePredictionPolygon(recordPrediction);
    const center = predictionCenter(recordPrediction, polygon);

    if (
      normalized.includes("wall") ||
      normalized.includes("exterior") ||
      normalized.includes("interior") ||
      normalized.includes("column") ||
      normalized.includes("balcony")
    ) {
      const wall = wallFromPolygon(polygon, recordPrediction, index, classifyWallType(normalized));
      if (wall) walls.push(wall);
      return;
    }

    if (
      normalized.includes("door") ||
      normalized.includes("window") ||
      normalized.includes("sliding") ||
      normalized.includes("passage") ||
      normalized.includes("entrance")
    ) {
      if (!center) return;
      const xs = polygon.map((point) => point[0]);
      const ys = polygon.map((point) => point[1]);
      const spanX = xs.length > 0 ? Math.max(...xs) - Math.min(...xs) : Number(recordPrediction.width ?? 90);
      const spanY = ys.length > 0 ? Math.max(...ys) - Math.min(...ys) : Number(recordPrediction.height ?? 30);
      openings.push({
        id: typeof recordPrediction.id === "string" ? recordPrediction.id : `rf-opening-${index + 1}`,
        type: classifyOpeningType(normalized),
        position: center,
        width: Math.max(20, spanX, spanY),
        isEntrance: normalized.includes("entrance"),
        detectConfidence: clamp(toNumber(recordPrediction.confidence, 0.65), 0, 1),
        typeConfidence: clamp(toNumber(recordPrediction.confidence, 0.65), 0, 1)
      });
      return;
    }

    const roomType = inferRoomTypeFromLabel(label);
    if (roomType !== "other" || normalized.includes("room") || normalized.includes("zone")) {
      if (!center) return;
      roomHints.push({
        id: typeof recordPrediction.id === "string" ? recordPrediction.id : `rf-room-${index + 1}`,
        label,
        roomType,
        position: center,
        ...(polygon.length >= 3 ? { polygon } : {}),
        confidence: clamp(toNumber(recordPrediction.confidence, roomType === "other" ? 0.45 : 0.72), 0, 1),
        source: provider
      });
    }
  });

  return {
    scale: 1,
    scaleInfo: {
      value: 1,
      source: "unknown",
      confidence: 0.1,
      evidence: {
        notes: `${provider} did not return calibrated scale.`
      }
    },
    walls,
    openings,
    semanticAnnotations: {
      roomHints,
      dimensionAnnotations: []
    }
  };
}

function parseHfEndpointPayload(payload: unknown) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if (record.topology || record.walls || record.openings) {
      return record.topology ?? record;
    }

    const generatedText =
      typeof record.generated_text === "string"
        ? record.generated_text
        : typeof record.output_text === "string"
          ? record.output_text
          : typeof record.text === "string"
            ? record.text
            : null;
    if (generatedText) {
      return extractJsonCandidate(generatedText) ?? record;
    }

    if (Array.isArray(record.choices)) {
      const text = (record.choices as Array<Record<string, unknown>>)
        .map((choice) => {
          const message = choice.message as Record<string, unknown> | undefined;
          const content = message?.content;
          return typeof content === "string" ? content : "";
        })
        .join("\n");
      return extractJsonCandidate(text) ?? record;
    }
  }

  if (typeof payload === "string") {
    return extractJsonCandidate(payload) ?? payload;
  }

  return payload;
}

function isLikelyRoomLabel(text: string) {
  const normalized = normalizeSemanticLabel(text);
  if (!normalized) return false;
  return inferRoomTypeFromLabel(text) !== "other";
}

function extractOcrItems(payload: unknown) {
  const items: Array<{ text: string; confidence: number; polygon?: Vec2[] }> = [];
  const pushItem = (text: string, confidence: number, polygon?: Vec2[] | null) => {
    if (!text.trim()) return;
    items.push({
      text: text.trim(),
      confidence: clamp(confidence, 0, 1),
      ...(polygon && polygon.length >= 3 ? { polygon } : {})
    });
  };

  if (Array.isArray(payload)) {
    payload.forEach((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
      const record = entry as Record<string, unknown>;
      const text =
        typeof record.text === "string"
          ? record.text
          : typeof record.rec_text === "string"
            ? record.rec_text
            : "";
      const polygon = normalizePredictionPolygon(record);
      pushItem(text, toNumber(record.confidence ?? record.score, 0.75), polygon);
    });
    return items;
  }

  if (!payload || typeof payload !== "object") return items;
  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.rec_texts)) {
    const texts = record.rec_texts as unknown[];
    const scores = Array.isArray(record.rec_scores) ? (record.rec_scores as unknown[]) : [];
    const polys = Array.isArray(record.dt_polys)
      ? (record.dt_polys as unknown[])
      : Array.isArray(record.rec_polys)
        ? (record.rec_polys as unknown[])
        : [];

    texts.forEach((entry, index) => {
      const text = typeof entry === "string" ? entry : "";
      const score = toNumber(scores[index], 0.75);
      const polygon = polygonFromBox((polys[index] as number[] | Vec2[]) ?? []);
      pushItem(text, score, polygon);
    });
    return items;
  }

  const candidates = [
    record.data,
    record.result,
    record.results,
    record.ocr_results,
    record.items,
    record.predictions
  ].find(Array.isArray);

  if (Array.isArray(candidates)) {
    return items.concat(extractOcrItems(candidates));
  }

  return items;
}

function normalizePaddleSemanticAnnotations(payload: unknown): SemanticAnnotations {
  const roomHints: RoomHint[] = [];
  const dimensionAnnotations: DimensionAnnotation[] = [];
  const items = extractOcrItems(payload);

  items.forEach((item, index) => {
    const polygon = item.polygon;
    const position =
      polygon && polygon.length > 0
        ? ([
            polygon.reduce((sum, point) => sum + point[0], 0) / polygon.length,
            polygon.reduce((sum, point) => sum + point[1], 0) / polygon.length
          ] as Vec2)
        : null;
    if (!position) return;

    const orientation =
      polygon && polygon.length >= 2 ? getDimensionOrientation(polygon[0], polygon[Math.floor(polygon.length / 2)]) : undefined;
    const mmValue = parseDimensionMmValue(item.text, orientation);

    if (Number.isFinite(mmValue) && mmValue) {
      const p1 = polygon?.[0];
      const p2 = polygon?.[1];
      dimensionAnnotations.push({
        id: `ocr-dim-${index + 1}`,
        text: item.text,
        mmValue,
        ...(p1 ? { p1 } : {}),
        ...(p2 ? { p2 } : {}),
        ...(p1 && p2 ? { pxDistance: Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) } : {}),
        confidence: item.confidence,
        orientation,
        source: "ocr"
      });
      return;
    }

    if (isLikelyRoomLabel(item.text)) {
      roomHints.push({
        id: `ocr-room-${index + 1}`,
        label: item.text,
        normalizedLabel: normalizeSemanticLabel(item.text),
        roomType: inferRoomTypeFromLabel(item.text),
        position,
        ...(polygon ? { polygon } : {}),
        confidence: item.confidence,
        source: "ocr"
      });
    }
  });

  return {
    roomHints,
    dimensionAnnotations
  };
}

function createProviderStatus(provider: string, configured: boolean, reason: string | null): ProviderStatus {
  return {
    provider,
    configured,
    status: configured ? "enabled" : "skipped",
    reason
  };
}

function mergeProviderStatus(base: ProviderStatus[], extras: ProviderStatus[]) {
  const byProvider = new Map<string, ProviderStatus>();
  [...base, ...extras].forEach((entry) => {
    byProvider.set(entry.provider, entry);
  });
  return [...byProvider.values()];
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

async function runPaddleOcr(
  dataUrl: string,
  mimeType: string
): Promise<{ semanticAnnotations: SemanticAnnotations; status: ProviderStatus; error?: string }> {
  const url = process.env.PADDLEOCR_API_URL;
  const configured = Boolean(url);
  if (!configured || !url) {
    return {
      semanticAnnotations: { roomHints: [], dimensionAnnotations: [] },
      status: createProviderStatus("paddleocr", false, "PADDLEOCR_API_URL is missing.")
    };
  }

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.PADDLEOCR_API_TOKEN ? { Authorization: `Bearer ${process.env.PADDLEOCR_API_TOKEN}` } : {})
        },
        body: JSON.stringify({
          image: dataUrl,
          mimeType,
          detectorModel: process.env.PADDLEOCR_DET_MODEL ?? "PP-OCRv5_det",
          recognitionModel: process.env.PADDLEOCR_REC_MODEL ?? "korean_PP-OCRv5_mobile_rec"
        })
      },
      PROVIDER_TIMEOUT_MS
    );

    if (!response.ok) {
      const body = await response.text();
      return {
        semanticAnnotations: { roomHints: [], dimensionAnnotations: [] },
        status: createProviderStatus("paddleocr", true, null),
        error: `paddleocr: request failed (${response.status}): ${body}`
      };
    }

    const payload = await response.json();
    return {
      semanticAnnotations: normalizePaddleSemanticAnnotations(payload),
      status: createProviderStatus("paddleocr", true, null)
    };
  } catch (error) {
    return {
      semanticAnnotations: { roomHints: [], dimensionAnnotations: [] },
      status: createProviderStatus("paddleocr", true, null),
      error: `paddleocr: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function runRoboflowCandidate(params: {
  provider: "roboflow_cubicasa2" | "roboflow_cubicasa3";
  endpointUrl?: string;
  dataUrl: string;
  mimeType: string;
  imageWidth: number;
  imageHeight: number;
  debug?: boolean;
  externalSemanticAnnotations?: Partial<SemanticAnnotations>;
}): Promise<{ candidate?: ExternalCandidate; status: ProviderStatus; error?: string }> {
  const configured = Boolean(params.endpointUrl);
  if (!configured || !params.endpointUrl) {
    return {
      status: createProviderStatus(params.provider, false, `${params.provider.toUpperCase()} endpoint is missing.`)
    };
  }

  try {
    const response = await fetchWithTimeout(
      params.endpointUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.ROBOFLOW_API_KEY ? { Authorization: `Bearer ${process.env.ROBOFLOW_API_KEY}` } : {})
        },
        body: JSON.stringify({
          image: params.dataUrl,
          mimeType: params.mimeType,
          model: params.provider,
          format: "json"
        })
      },
      PROVIDER_TIMEOUT_MS
    );

    if (!response.ok) {
      const body = await response.text();
      return {
        status: createProviderStatus(params.provider, true, null),
        error: `${params.provider}: request failed (${response.status}): ${body}`
      };
    }

    const payload = parseRoboflowPayload(await response.json(), params.provider);
    const normalized = normalizeTopology(payload, params.externalSemanticAnnotations);
    const scored = scoreCandidate({
      walls: normalized.walls,
      openings: normalized.openings,
      scaleInfo: normalized.scaleInfo,
      semanticAnnotations: normalized.semanticAnnotations
    });

    const topologyPayload: TopologyPayload = {
      metadata: {
        imageWidth: params.imageWidth,
        imageHeight: params.imageHeight,
        scale: normalized.scale,
        scaleInfo: normalized.scaleInfo,
        unit: "pixels",
        confidence: Math.max(0.1, Math.min(1, scored.total / 100)),
        analysisCompleteness: {
          totalWallSegments: normalized.walls.length,
          exteriorWalls: normalized.walls.filter((wall) => wall.type === "exterior").length,
          interiorWalls: normalized.walls.filter((wall) => wall.type === "interior").length,
          totalOpenings: normalized.openings.length,
          doors: normalized.openings.filter((opening) => opening.type !== "window").length,
          windows: normalized.openings.filter((opening) => opening.type === "window").length,
          balconies: normalized.walls.filter((wall) => wall.type === "balcony").length,
          columns: normalized.walls.filter((wall) => wall.type === "column").length
        }
      },
      walls: normalized.walls,
      openings: normalized.openings,
      semanticAnnotations: normalized.semanticAnnotations,
      source: params.provider,
      cacheHit: false,
      selection: {
        sourceModule: "provider",
        selectedScore: scored.total,
        selectedPassId: params.provider,
        preprocessProfile: "balanced" as TopologyPayload["selection"]["preprocessProfile"]
      },
      providerStatus: [createProviderStatus(params.provider, true, null)],
      providerErrors: [],
      selectedScore: scored.total,
      ...(params.debug
        ? {
            selectedProvider: params.provider,
            selectedPassId: params.provider,
            selectedPreprocessProfile: "balanced" as TopologyPayload["selection"]["preprocessProfile"],
            candidates: [
              {
                provider: params.provider,
                passId: params.provider,
                preprocessProfile: "balanced" as CandidateDebug["preprocessProfile"],
                score: scored.total,
                scoreBreakdown: scored.breakdown,
                metrics: scored.metrics,
                errors: [],
                timingMs: 0
              }
            ]
          }
        : {})
    };

    return {
      candidate: {
        provider: params.provider,
        payload: topologyPayload,
        debug: {
          provider: params.provider,
          passId: params.provider,
          preprocessProfile: "balanced" as CandidateDebug["preprocessProfile"],
          score: scored.total,
          scoreBreakdown: scored.breakdown,
          metrics: scored.metrics,
          errors: [],
          timingMs: 0
        }
      },
      status: createProviderStatus(params.provider, true, null)
    };
  } catch (error) {
    return {
      status: createProviderStatus(params.provider, true, null),
      error: `${params.provider}: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function runHfDedicatedCandidate(params: {
  endpointUrl?: string;
  token?: string;
  dataUrl: string;
  mimeType: string;
  imageWidth: number;
  imageHeight: number;
  debug?: boolean;
  externalSemanticAnnotations?: Partial<SemanticAnnotations>;
}): Promise<{ candidate?: ExternalCandidate; status: ProviderStatus; error?: string }> {
  const configured = Boolean(params.endpointUrl);
  if (!configured || !params.endpointUrl) {
    return {
      status: createProviderStatus("hf_dedicated", false, "HF_FLOORPLAN_ENDPOINT_URL is missing.")
    };
  }

  try {
    const response = await fetchWithTimeout(
      params.endpointUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(params.token ? { Authorization: `Bearer ${params.token}` } : {})
        },
        body: JSON.stringify({
          image: params.dataUrl,
          mimeType: params.mimeType,
          prompt: makePrompt()
        })
      },
      PROVIDER_TIMEOUT_MS
    );

    if (!response.ok) {
      const body = await response.text();
      return {
        status: createProviderStatus("hf_dedicated", true, null),
        error: `hf_dedicated: request failed (${response.status}): ${body}`
      };
    }

    const text = await response.text();
    const parsedBody = safeJsonParse(text);
    const payload = parseHfEndpointPayload(parsedBody ?? text);
    const normalized = normalizeTopology(payload, params.externalSemanticAnnotations);
    const scored = scoreCandidate({
      walls: normalized.walls,
      openings: normalized.openings,
      scaleInfo: normalized.scaleInfo,
      semanticAnnotations: normalized.semanticAnnotations
    });

    const topologyPayload: TopologyPayload = {
      metadata: {
        imageWidth: params.imageWidth,
        imageHeight: params.imageHeight,
        scale: normalized.scale,
        scaleInfo: normalized.scaleInfo,
        unit: "pixels",
        confidence: Math.max(0.1, Math.min(1, scored.total / 100)),
        analysisCompleteness: {
          totalWallSegments: normalized.walls.length,
          exteriorWalls: normalized.walls.filter((wall) => wall.type === "exterior").length,
          interiorWalls: normalized.walls.filter((wall) => wall.type === "interior").length,
          totalOpenings: normalized.openings.length,
          doors: normalized.openings.filter((opening) => opening.type !== "window").length,
          windows: normalized.openings.filter((opening) => opening.type === "window").length,
          balconies: normalized.walls.filter((wall) => wall.type === "balcony").length,
          columns: normalized.walls.filter((wall) => wall.type === "column").length
        }
      },
      walls: normalized.walls,
      openings: normalized.openings,
      semanticAnnotations: normalized.semanticAnnotations,
      source: "hf_dedicated",
      cacheHit: false,
      selection: {
        sourceModule: "provider",
        selectedScore: scored.total,
        selectedPassId: "hf_dedicated",
        preprocessProfile: "balanced" as TopologyPayload["selection"]["preprocessProfile"]
      },
      providerStatus: [createProviderStatus("hf_dedicated", true, null)],
      providerErrors: [],
      selectedScore: scored.total,
      ...(params.debug
        ? {
            selectedProvider: "hf_dedicated",
            selectedPassId: "hf_dedicated",
            selectedPreprocessProfile: "balanced" as TopologyPayload["selection"]["preprocessProfile"],
            candidates: [
              {
                provider: "hf_dedicated",
                passId: "hf_dedicated",
                preprocessProfile: "balanced" as CandidateDebug["preprocessProfile"],
                score: scored.total,
                scoreBreakdown: scored.breakdown,
                metrics: scored.metrics,
                errors: [],
                timingMs: 0
              }
            ]
          }
        : {})
    };

    return {
      candidate: {
        provider: "hf_dedicated",
        payload: topologyPayload,
        debug: {
          provider: "hf_dedicated",
          passId: "hf_dedicated",
          preprocessProfile: "balanced" as CandidateDebug["preprocessProfile"],
          score: scored.total,
          scoreBreakdown: scored.breakdown,
          metrics: scored.metrics,
          errors: [],
          timingMs: 0
        }
      },
      status: createProviderStatus("hf_dedicated", true, null)
    };
  } catch (error) {
    return {
      status: createProviderStatus("hf_dedicated", true, null),
      error: `hf_dedicated: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

function buildCandidateFromSelectedPayload(payload: TopologyPayload): ExternalCandidate {
  const fallbackScore = scoreCandidate({
    walls: payload.walls,
    openings: payload.openings,
    scaleInfo: payload.metadata.scaleInfo,
    semanticAnnotations: payload.semanticAnnotations
  });
  const selectedCandidate =
    payload.candidates?.find(
      (candidate) =>
        candidate.provider === (payload.selectedProvider ?? payload.source) &&
        candidate.passId === (payload.selectedPassId ?? payload.selection.selectedPassId)
    ) ?? null;

  return {
    provider: payload.selectedProvider ?? payload.source,
    payload,
    debug: selectedCandidate ?? {
      provider: payload.selectedProvider ?? payload.source,
      passId: payload.selectedPassId ?? payload.selection.selectedPassId,
      preprocessProfile: payload.selectedPreprocessProfile ?? payload.selection.preprocessProfile,
      score: payload.selectedScore ?? fallbackScore.total,
      scoreBreakdown: fallbackScore.breakdown,
      metrics: fallbackScore.metrics,
      errors: [],
      timingMs: 0
    }
  };
}

function detectInputChannel(params: { mimeType: string; imageWidth: number; imageHeight: number }) {
  if (params.mimeType.includes("pdf")) return "pdf_export";
  const ratio = params.imageHeight > 0 ? params.imageWidth / params.imageHeight : 1;
  if (ratio >= 1.2 && ratio <= 1.8) return "gallery_capture";
  if (ratio < 0.75) return "phone_capture";
  return "uploaded_image";
}

export async function executeProviders(payload: ExecuteProvidersPayload): Promise<AnalyzeUploadResult> {
  const stripped = stripDataUrl(payload.base64);
  const mimeType = payload.mimeType || stripped.mimeType;
  if (mimeType.includes("pdf")) {
    return {
      ok: false,
      status: 422,
      error: {
        recoverable: true,
        errorCode: "UNSUPPORTED_FLOORPLAN_FORMAT",
        details: "Raw PDF uploads are not supported in the current analysis runtime. Rasterize the PDF to PNG/JPEG and keep channel=pdf_export.",
        providerStatus: [],
        providerErrors: []
      }
    };
  }

  const metadata = await sharp(Buffer.from(stripped.base64, "base64")).metadata();
  const imageWidth = metadata.width ?? 0;
  const imageHeight = metadata.height ?? 0;
  const channel = detectInputChannel({ mimeType, imageWidth, imageHeight });

  const paddle = await runPaddleOcr(payload.base64, mimeType);
  const externalSemanticAnnotations = paddle.semanticAnnotations;

  const builtIn = await analyzeFloorplanUpload({
    base64: payload.base64,
    mimeType,
    debug: true,
    externalSemanticAnnotations
  });

  const [roboflow2, roboflow3, hfDedicated] = await Promise.all([
    runRoboflowCandidate({
      provider: "roboflow_cubicasa2",
      endpointUrl: process.env.ROBOFLOW_CUBICASA2_URL,
      dataUrl: payload.base64,
      mimeType,
      imageWidth,
      imageHeight,
      debug: payload.debug,
      externalSemanticAnnotations
    }),
    runRoboflowCandidate({
      provider: "roboflow_cubicasa3",
      endpointUrl: process.env.ROBOFLOW_CUBICASA3_URL,
      dataUrl: payload.base64,
      mimeType,
      imageWidth,
      imageHeight,
      debug: payload.debug,
      externalSemanticAnnotations
    }),
    runHfDedicatedCandidate({
      endpointUrl: process.env.HF_FLOORPLAN_ENDPOINT_URL,
      token: process.env.HF_FLOORPLAN_ENDPOINT_TOKEN,
      dataUrl: payload.base64,
      mimeType,
      imageWidth,
      imageHeight,
      debug: payload.debug,
      externalSemanticAnnotations
    })
  ]);

  const extraStatuses = [paddle.status, roboflow2.status, roboflow3.status, hfDedicated.status];
  const extraErrors = dedupeStrings([paddle.error ?? "", roboflow2.error ?? "", roboflow3.error ?? "", hfDedicated.error ?? ""]);

  const candidates: ExternalCandidate[] = [
    ...(builtIn.ok ? [buildCandidateFromSelectedPayload(builtIn.data)] : []),
    ...(roboflow2.candidate ? [roboflow2.candidate] : []),
    ...(roboflow3.candidate ? [roboflow3.candidate] : []),
    ...(hfDedicated.candidate ? [hfDedicated.candidate] : [])
  ].sort((left, right) => right.debug.score - left.debug.score);
  let builtInProviderStatus: ProviderStatus[] = [];
  let builtInProviderErrors: string[] = [];
  let builtInCandidates: CandidateDebug[] = [];
  let builtInFailureCode = "TOPOLOGY_EXTRACTION_FAILED";
  let builtInFailureDetails = "Unable to extract a reliable topology. Continue with manual 2D correction.";

  if (builtIn.ok) {
    builtInProviderStatus = builtIn.data.providerStatus;
    builtInProviderErrors = builtIn.data.providerErrors;
    builtInCandidates = builtIn.data.candidates ?? [];
  } else {
    const failure = builtIn as Extract<AnalyzeUploadResult, { ok: false }>;
    builtInProviderStatus = failure.error.providerStatus;
    builtInProviderErrors = failure.error.providerErrors;
    builtInCandidates = failure.error.candidates ?? [];
    builtInFailureCode = failure.error.errorCode;
    builtInFailureDetails = failure.error.details;
  }

  const combinedProviderStatus = mergeProviderStatus(builtInProviderStatus, extraStatuses);
  const combinedProviderErrors = dedupeStrings([
    ...builtInProviderErrors,
    ...extraErrors
  ]);

  if (candidates.length === 0 || candidates[0]!.debug.score < FLOORPLAN_MIN_ACCEPT_SCORE) {
    return {
      ok: false,
      status: 422,
      error: {
        recoverable: true,
        errorCode: builtInFailureCode,
        details: builtInFailureDetails,
        providerStatus: combinedProviderStatus,
        providerErrors: combinedProviderErrors,
        ...(payload.debug
          ? {
              candidates: [
                ...builtInCandidates,
                ...[roboflow2.candidate, roboflow3.candidate, hfDedicated.candidate]
                  .filter((candidate): candidate is ExternalCandidate => Boolean(candidate))
                  .map((candidate) => candidate.debug)
              ]
            }
          : {})
      }
    };
  }

  const selected = candidates[0]!;
  const selectedPayload = {
    ...selected.payload,
    providerStatus: combinedProviderStatus,
    providerErrors: combinedProviderErrors,
    metadata: {
      ...selected.payload.metadata,
      analysisContext: {
        channel,
        ocrProvider: paddle.status.configured ? "paddleocr" : null,
        externalProviders: [roboflow2.candidate?.provider, roboflow3.candidate?.provider, hfDedicated.candidate?.provider].filter(
          (provider): provider is string => Boolean(provider)
        )
      }
    } as TopologyPayload["metadata"],
    ...(payload.debug
      ? {
          candidates: [
            ...builtInCandidates,
            ...[roboflow2.candidate, roboflow3.candidate, hfDedicated.candidate]
              .filter((candidate): candidate is ExternalCandidate => Boolean(candidate))
              .map((candidate) => candidate.debug)
          ],
          selectedProvider: selected.provider,
          selectedPassId: selected.debug.passId,
          selectedPreprocessProfile: selected.debug.preprocessProfile
        }
      : {})
  };

  return {
    ok: true,
    status: 200,
    data: selectedPayload
  };
}
