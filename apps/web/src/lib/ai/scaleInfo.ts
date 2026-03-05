import type { ScaleInfo, ScaleSource, Vector2 } from "../stores/useSceneStore";

export const MIN_VALID_SCALE = 0.0005;
export const MAX_VALID_SCALE = 0.2;
export const MIN_SCALE_CONFIDENCE = 0.6;

function isScaleSource(value: unknown): value is ScaleSource {
  return value === "ocr_dimension" || value === "door_heuristic" || value === "user_measure" || value === "unknown";
}

function clampConfidence(value: unknown, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function coerceVector2(value: unknown): Vector2 | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const x = Number(value[0]);
  const y = Number(value[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return [x, y];
}

export function createUnknownScaleInfo(value = 1, notes = "Scale has not been calibrated."): ScaleInfo {
  return {
    value,
    source: "unknown",
    confidence: 0,
    evidence: {
      notes
    }
  };
}

export function parseScaleInfo(input: unknown, fallbackValue: number): ScaleInfo {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return createUnknownScaleInfo(fallbackValue);
  }
  const raw = input as Record<string, unknown>;
  let source = isScaleSource(raw.source) ? raw.source : "unknown";
  const valueCandidate = Number(raw.value);
  const value = Number.isFinite(valueCandidate) && valueCandidate > 0 ? valueCandidate : fallbackValue;
  let confidence = clampConfidence(raw.confidence, source === "unknown" ? 0 : 0.6);
  const evidenceRaw =
    raw.evidence && typeof raw.evidence === "object" && !Array.isArray(raw.evidence)
      ? (raw.evidence as Record<string, unknown>)
      : null;
  const mmValue = evidenceRaw ? Number(evidenceRaw.mmValue) : NaN;
  const pxDistance = evidenceRaw ? Number(evidenceRaw.pxDistance) : NaN;
  const notes = evidenceRaw && typeof evidenceRaw.notes === "string" ? evidenceRaw.notes : undefined;
  const p1 = coerceVector2(evidenceRaw?.p1);
  const p2 = coerceVector2(evidenceRaw?.p2);
  const evidence =
    evidenceRaw || notes
      ? {
          ...(Number.isFinite(mmValue) ? { mmValue } : {}),
          ...(Number.isFinite(pxDistance) ? { pxDistance } : {}),
          ...(p1 ? { p1 } : {}),
          ...(p2 ? { p2 } : {}),
          ...(typeof evidenceRaw?.ocrText === "string" ? { ocrText: evidenceRaw.ocrText } : {}),
          ...(evidenceRaw?.ocrBox &&
          typeof evidenceRaw.ocrBox === "object" &&
          Number.isFinite(Number((evidenceRaw.ocrBox as Record<string, unknown>).x)) &&
          Number.isFinite(Number((evidenceRaw.ocrBox as Record<string, unknown>).y)) &&
          Number.isFinite(Number((evidenceRaw.ocrBox as Record<string, unknown>).w)) &&
          Number.isFinite(Number((evidenceRaw.ocrBox as Record<string, unknown>).h))
            ? {
                ocrBox: {
                  x: Number((evidenceRaw.ocrBox as Record<string, unknown>).x),
                  y: Number((evidenceRaw.ocrBox as Record<string, unknown>).y),
                  w: Number((evidenceRaw.ocrBox as Record<string, unknown>).w),
                  h: Number((evidenceRaw.ocrBox as Record<string, unknown>).h)
                }
              }
            : {}),
          ...(notes ? { notes } : {})
        }
      : undefined;

  const hasStrongDimensionEvidence = Boolean(
    evidence &&
    Number.isFinite(evidence.mmValue) &&
    Number.isFinite(evidence.pxDistance) &&
    (Boolean(evidence.ocrText) || (Array.isArray(evidence.p1) && Array.isArray(evidence.p2)))
  );
  if (source === "unknown" && hasStrongDimensionEvidence) {
    source = "ocr_dimension";
    confidence = Math.max(confidence, 0.65);
  }

  return {
    value,
    source,
    confidence,
    ...(evidence ? { evidence } : {})
  };
}

export function createUserMeasureScaleInfo(params: {
  value: number;
  mmValue: number;
  pxDistance: number;
  p1: Vector2;
  p2: Vector2;
}): ScaleInfo {
  return {
    value: params.value,
    source: "user_measure",
    confidence: 1,
    evidence: {
      mmValue: params.mmValue,
      pxDistance: params.pxDistance,
      p1: params.p1,
      p2: params.p2
    }
  };
}

export function createDoorHeuristicScaleInfo(params: {
  value: number;
  doorWidthAssumedMm: number;
  pxWidth: number;
  openingId?: string;
}): ScaleInfo {
  return {
    value: params.value,
    source: "door_heuristic",
    confidence: 0.55,
    evidence: {
      mmValue: params.doorWidthAssumedMm,
      pxDistance: params.pxWidth,
      notes: params.openingId
        ? `Derived from door opening ${params.openingId}. Verify with manual measurement.`
        : "Derived from average detected door width. Verify with manual measurement."
    }
  };
}

export function getScaleGateMessage(scale: number, scaleInfo: ScaleInfo): string | null {
  if (!Number.isFinite(scale) || scale < MIN_VALID_SCALE || scale > MAX_VALID_SCALE) {
    return "Scale value is out of range. Measure a known distance before entering 3D.";
  }
  if (!scaleInfo || scaleInfo.source === "unknown") {
    return "Scale source is unknown. Measure a known distance or confirm scale before entering 3D.";
  }
  if (scaleInfo.confidence < MIN_SCALE_CONFIDENCE) {
    return `Scale confidence is too low (${Math.round(scaleInfo.confidence * 100)}%). Measure a known distance before entering 3D.`;
  }
  return null;
}
