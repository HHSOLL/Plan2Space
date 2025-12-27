import type { DesignDoc } from "@webinterior/shared/types";
import { cloneDesignDoc, STARTER_ROOM_TEMPLATE } from "./design-templates";

type ImageSource = File | string;

export type NormalizedLayout = {
  units: "mm" | "cm" | "m";
  rooms: Array<{ id: string; label: string; polygon: Array<[number, number]>; height?: number }>;
  walls: Array<{ id: string; from: [number, number]; to: [number, number]; thickness?: number; height?: number }>;
  doors: Array<{ id: string; wall: string; offset: number; width: number; height?: number; swing?: "cw" | "ccw" }>;
  windows: Array<{ id: string; wall: string; offset: number; width: number; sillHeight?: number; height?: number }>;
  openings?: Array<{ id: string; wall: string; offset: number; width: number; height?: number }>;
  metadata?: Record<string, unknown>;
};

type PlanDetection = {
  widthPx: number;
  heightPx: number;
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
  verticalLines: number[]; // normalized 0..1 within bbox
  horizontalLines: number[];
  // For overlay referencing
  debugImage?: ImageData;
};

export type GeneratedPlan = {
  designDoc: DesignDoc;
  summary: {
    widthMeters: number;
    heightMeters: number;
    rooms: number;
    partitions: { vertical: number; horizontal: number };
  };
  analysis?: {
    source?: string;
    warning?: string;
  };
};

/** 
 * Standard deviation threshold for adaptive processing. 
 * Lower = more sensitive to noise, Higher = misses faint lines.
 */
const CONTRAST_THRESHOLD = 15;

async function loadImageData(src: ImageSource): Promise<{ data: ImageData; url?: string }> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  let url: string | undefined;

  if (typeof src === "string") {
    url = src;
    img.src = src;
  } else {
    url = URL.createObjectURL(src);
    img.src = url;
  }

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  // Limit processing size to improved speed/consistency (max dimension 2048)
  const MAX_DIM = 2048;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > MAX_DIM || h > MAX_DIM) {
    const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  if (typeof src !== "string") URL.revokeObjectURL(url);
  return { data, url: typeof src === "string" ? src : undefined };
}

/**
 * Converts image to grayscale Float32Array
 */
function toGrayscale(img: ImageData): Float32Array {
  const { data, width, height } = img;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    // Standard Rec. 601 luma
    gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  }
  return gray;
}

/**
 * Adaptive Threshold Binarization
 * Uses a local window to determine if a pixel is "darker than its neighbors".
 * Good for uneven lighting or dirty scans.
 */
function adaptiveThreshold(gray: Float32Array, width: number, height: number, windowSize = 15, c = 5): Uint8Array {
  // Uses Integral Image for O(1) box filter
  const integral = new Float32Array(width * height);
  let sum = 0;

  // 1st pass: build integral image
  for (let y = 0; y < height; y++) {
    sum = 0;
    for (let x = 0; x < width; x++) {
      sum += gray[y * width + x];
      if (y === 0) {
        integral[y * width + x] = sum;
      } else {
        integral[y * width + x] = integral[(y - 1) * width + x] + sum;
      }
    }
  }

  const out = new Uint8Array(width * height); // 1 = ink, 0 = background
  const half = Math.floor(windowSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(x - half, 0);
      const x2 = Math.min(x + half, width - 1);
      const y1 = Math.max(y - half, 0);
      const y2 = Math.min(y + half, height - 1);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      const A = integral[y2 * width + x2];
      const B = y1 > 0 ? integral[(y1 - 1) * width + x2] : 0;
      const C = x1 > 0 ? integral[y2 * width + (x1 - 1)] : 0;
      const D = y1 > 0 && x1 > 0 ? integral[(y1 - 1) * width + (x1 - 1)] : 0;

      const localSum = A - B - C + D;
      const mean = localSum / count;

      // In blueprints, ink is DARKER than paper.
      // If pixel < mean - c, it's ink.
      // We check for valid ink intensity (must be somewhat dark in absolute terms too, e.g. < 200)
      if (gray[y * width + x] < mean - c && gray[y * width + x] < 220) {
        out[y * width + x] = 1;
      } else {
        out[y * width + x] = 0;
      }
    }
  }
  return out;
}

/**
 * Morphological Dilate (expands white/ink regions) 
 * Used here: ink is 1. If we want to connect disjoint lines, we dilate the INK.
 */
function dilate(bin: Uint8Array, width: number, height: number, iterations = 1): Uint8Array {
  let curr = bin;
  const next = new Uint8Array(width * height);

  for (let it = 0; it < iterations; it++) {
    next.fill(0);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        // structural element 3x3 cross
        if (curr[y * width + x] === 1 ||
          curr[y * width + (x - 1)] === 1 ||
          curr[y * width + (x + 1)] === 1 ||
          curr[(y - 1) * width + x] === 1 ||
          curr[(y + 1) * width + x] === 1) {
          next[y * width + x] = 1;
        }
      }
    }
    // Swap buffers (lazy, just reassign for next iter)
    curr = new Uint8Array(next);
  }
  return curr;
}

function findBoundingBox(bin: Uint8Array, width: number, height: number): PlanDetection["boundingBox"] {
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;

  const margin = 5; // ignore extreme edges if possible
  for (let y = margin; y < height - margin; y++) {
    for (let x = margin; x < width - margin; x++) {
      if (bin[y * width + x] === 1) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };

  // Add some padding
  const pad = 10;
  return {
    minX: Math.max(0, minX - pad),
    minY: Math.max(0, minY - pad),
    maxX: Math.min(width - 1, maxX + pad),
    maxY: Math.min(height - 1, maxY + pad)
  };
}

function detectGridLines(bin: Uint8Array, width: number, height: number, bbox: PlanDetection["boundingBox"]) {
  const w = bbox.maxX - bbox.minX + 1;
  const h = bbox.maxY - bbox.minY + 1;

  // Horizontal Projection (detects Horizontal Lines)
  // We sum rows. A horizontal wall will have high sum.
  const hProj = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    const rowOffset = (bbox.minY + y) * width;
    for (let x = 0; x < w; x++) {
      sum += bin[rowOffset + (bbox.minX + x)];
    }
    hProj[y] = sum;
  }

  // Vertical Projection (detects Vertical Lines)
  const vProj = new Int32Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    const colX = bbox.minX + x;
    for (let y = 0; y < h; y++) {
      sum += bin[(bbox.minY + y) * width + colX];
    }
    vProj[x] = sum;
  }

  // Peak detection with smoothing
  const findPeaks = (proj: Int32Array, len: number, sizeRef: number) => {
    // 1. Smooth the histogram
    const smoothed = new Float32Array(len);
    const k = 3;
    for (let i = k; i < len - k; i++) {
      let s = 0;
      for (let j = -k; j <= k; j++) s += proj[i + j];
      smoothed[i] = s / (2 * k + 1);
    }

    // 2. Threshold relative to max (adaptive)
    let maxVal = 0;
    for (let i = 0; i < len; i++) if (smoothed[i] > maxVal) maxVal = smoothed[i];
    const threshold = maxVal * 0.25; // at least 25% of strongest line

    // 3. Find local maxima
    const peaks: number[] = [];
    let processingPeak = false;
    let peakStart = 0;

    for (let i = 1; i < len - 1; i++) {
      const v = smoothed[i];
      if (v > threshold) {
        if (!processingPeak) {
          processingPeak = true;
          peakStart = i;
        }
      } else {
        if (processingPeak) {
          // End of peak, find center of mass of this range for precision
          let mass = 0;
          let wSum = 0;
          for (let p = peakStart; p < i; p++) {
            wSum += smoothed[p] * p;
            mass += smoothed[p];
          }
          peaks.push(wSum / mass);
          processingPeak = false;
        }
      }
    }

    // Convert to normalized coordinates 0..1
    return peaks.map(p => p / sizeRef);
  };

  const vLines = findPeaks(vProj, w, w);
  const hLines = findPeaks(hProj, h, h);

  return { vLines, hLines };
}

function buildDesignDoc(det: PlanDetection & { bin: Uint8Array }): GeneratedPlan {
  const { boundingBox: bbox, verticalLines: vLinesRaw, horizontalLines: hLinesRaw, bin, widthPx, heightPx } = det;

  // Cleanup lines: sort and dedupe close neighbors
  const cleanup = (lines: number[]) => {
    const sorted = lines.sort((a, b) => a - b);
    const res: number[] = [];
    if (sorted.length === 0) return [0, 1];

    const minGap = 0.02;
    let last = sorted[0];
    res.push(last);

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - last > minGap) {
        res.push(sorted[i]);
        last = sorted[i];
      }
    }

    if (res[0] > 0.05) res.unshift(0);
    if (res[res.length - 1] < 0.95) res.push(1);

    return res;
  };

  const vLines = cleanup(vLinesRaw);
  const hLines = cleanup(hLinesRaw);

  const aspect = (bbox.maxX - bbox.minX) / (bbox.maxY - bbox.minY);
  const targetWidth = 14;
  const widthMeters = targetWidth;
  const heightMeters = targetWidth / aspect;

  const walls: DesignDoc["plan2d"]["walls"] = [];
  const rooms: DesignDoc["plan2d"]["rooms"] = [];
  let wallId = 1;

  // Helper: check if a pixel segment in the BIN mask has enough ink
  const checkInkDensity = (x0: number, y0: number, x1: number, y1: number): boolean => {
    const px0 = Math.floor(bbox.minX + x0 * (bbox.maxX - bbox.minX));
    const py0 = Math.floor(bbox.minY + y0 * (bbox.maxY - bbox.minY));
    const px1 = Math.floor(bbox.minX + x1 * (bbox.maxX - bbox.minX));
    const py1 = Math.floor(bbox.minY + y1 * (bbox.maxY - bbox.minY));

    let inkCount = 0;
    let total = 0;

    // Line traversal
    const dx = Math.abs(px1 - px0);
    const dy = Math.abs(py1 - py0);
    const steps = Math.max(dx, dy);

    // We check a small corridor (3px wide) around the line
    for (let s = 0; s <= steps; s++) {
      const tx = Math.floor(px0 + (steps === 0 ? 0 : (px1 - px0) * (s / steps)));
      const ty = Math.floor(py0 + (steps === 0 ? 0 : (py1 - py0) * (s / steps)));

      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const cx = tx + ox;
          const cy = ty + oy;
          if (cx >= 0 && cx < widthPx && cy >= 0 && cy < heightPx) {
            total++;
            if (bin[cy * widthPx + cx] === 1) inkCount++;
          }
        }
      }
    }

    if (total === 0) return false;
    // 25% threshold is usually enough for detected lines
    return (inkCount / total) > 0.25;
  };

  // Add Vertical Walls (segmented)
  for (const lx of vLines) {
    for (let i = 0; i < hLines.length - 1; i++) {
      const ly0 = hLines[i];
      const ly1 = hLines[i + 1];
      if (checkInkDensity(lx, ly0, lx, ly1)) {
        walls.push({
          id: `w_v_${wallId++}`,
          a: { x: lx * widthMeters, y: ly0 * heightMeters },
          b: { x: lx * widthMeters, y: ly1 * heightMeters },
          locked: true,
        });
      }
    }
  }

  // Add Horizontal Walls (segmented)
  for (const ly of hLines) {
    for (let j = 0; j < vLines.length - 1; j++) {
      const lx0 = vLines[j];
      const lx1 = vLines[j + 1];
      if (checkInkDensity(lx0, ly, lx1, ly)) {
        walls.push({
          id: `w_h_${wallId++}`,
          a: { x: lx0 * widthMeters, y: ly * heightMeters },
          b: { x: lx1 * widthMeters, y: ly * heightMeters },
          locked: true,
        });
      }
    }
  }

  // Infer Rooms from cells - only if the cell is "enclosed" reasonably
  // (Simplified for now: keep existing cell logic but check if at least some ink is in walls)
  let cellIndex = 0;
  for (let i = 0; i < hLines.length - 1; i++) {
    for (let j = 0; j < vLines.length - 1; j++) {
      const y0 = hLines[i] * heightMeters;
      const y1 = hLines[i + 1] * heightMeters;
      const x0 = vLines[j] * widthMeters;
      const x1 = vLines[j + 1] * widthMeters;
      const midX = (x0 + x1) / 2;
      const midY = (y0 + y1) / 2;

      const area = (x1 - x0) * (y1 - y0);
      if (area < 0.5) continue; // smaller cells allowed for precise plan

      // Spatial Semantic Mapping
      let roomName = "Living Room";
      let roomId = `r_${cellIndex++}`;

      // More robust room naming based on position
      const isLeft = midX < widthMeters / 2;
      const isRight = midX > widthMeters / 2;
      const isTop = midY < heightMeters / 2;
      const isBottom = midY > heightMeters / 2;

      if (isTop && isLeft) { roomName = "Bedroom 1"; roomId = `r_bed1_${cellIndex}`; }
      else if (isTop && isRight) { roomName = "Kitchen/Laundry"; roomId = `r_ktch_${cellIndex}`; }
      else if (isBottom && isLeft) { roomName = "Master Bedroom"; roomId = `r_master_${cellIndex}`; }
      else if (isBottom && isRight) { roomName = "Living Area"; roomId = `r_living_${cellIndex}`; }

      rooms.push({
        id: roomId,
        name: roomName,
        polygon: [
          { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }
        ]
      });
    }
  }

  const surfaceMaterials: Record<string, string> = {};
  for (const r of rooms) {
    const isWet = r.name.toLowerCase().includes("kitchen") || r.name.toLowerCase().includes("bathroom");
    surfaceMaterials[`floor:${r.id}`] = isWet ? "m_floor_02" : "m_floor_01";
    surfaceMaterials[`ceiling:${r.id}`] = "m_ceiling_01";
    surfaceMaterials[`wall:${r.id}:face:in`] = "m_wall_01";
  }

  const designDoc: DesignDoc = {
    id: `auto_${Date.now()}`,
    projectId: "auto_plan",
    revision: 1,
    plan2d: {
      unit: "m",
      params: { wallHeight: 2.5, wallThickness: 0.15, ceilingHeight: 2.5 },
      walls,
      rooms,
      openings: []
    },
    surfaceMaterials,
    objects: []
  };

  return {
    designDoc,
    summary: {
      widthMeters: Number(widthMeters.toFixed(2)),
      heightMeters: Number(heightMeters.toFixed(2)),
      rooms: rooms.length,
      partitions: { vertical: vLines.length, horizontal: hLines.length }
    }
  };
}


export async function generateDesignFromImage(src: ImageSource): Promise<GeneratedPlan> {
  const { data } = await loadImageData(src);
  const gray = toGrayscale(data);

  // 1. Adaptive Binarization
  const bin = adaptiveThreshold(gray, data.width, data.height, 20, 5);

  // 2. Morphological Closing
  const morph = dilate(bin, data.width, data.height, 2);

  const bbox = findBoundingBox(morph, data.width, data.height);
  const { vLines, hLines } = detectGridLines(morph, data.width, data.height, bbox);

  const plan: PlanDetection & { bin: Uint8Array } = {
    widthPx: data.width,
    heightPx: data.height,
    boundingBox: bbox,
    verticalLines: vLines,
    horizontalLines: hLines,
    bin: morph // Pass the morph mask for density checks
  };

  const generated = buildDesignDoc(plan);
  return generated;
}

export function createBlankFromTemplate(): DesignDoc {
  const base = cloneDesignDoc(STARTER_ROOM_TEMPLATE);
  base.id = `blank_${Date.now()}`;
  base.projectId = "auto_plan";
  return base;
}

function unitFactor(units: NormalizedLayout["units"]) {
  if (units === "mm") return 0.001;
  if (units === "cm") return 0.01;
  return 1;
}

function deriveWallsFromRooms(rooms: NormalizedLayout["rooms"]): NormalizedLayout["walls"] {
  const walls: NormalizedLayout["walls"] = [];
  const seen = new Set<string>();
  let wallIndex = 1;

  for (const room of rooms) {
    const polygon = room.polygon;
    if (!polygon || polygon.length < 2) continue;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]!;
      const b = polygon[(i + 1) % polygon.length]!;
      if (a[0] === b[0] && a[1] === b[1]) continue;
      const keyA = `${a[0]},${a[1]}|${b[0]},${b[1]}`;
      const keyB = `${b[0]},${b[1]}|${a[0]},${a[1]}`;
      const key = keyA < keyB ? keyA : keyB;
      if (seen.has(key)) continue;
      seen.add(key);
      walls.push({ id: `w_room_${wallIndex++}`, from: a, to: b });
    }
  }

  return walls;
}

export function designDocFromNormalized(layout: NormalizedLayout, opts?: { projectId?: string; wallDefaults?: { height?: number; thickness?: number } }): DesignDoc {
  const factor = unitFactor(layout.units);
  const useDerivedWalls = layout.walls.length === 0 && layout.rooms.length > 0;
  const layoutWalls = useDerivedWalls ? deriveWallsFromRooms(layout.rooms) : layout.walls;
  const layoutDoors = useDerivedWalls ? [] : layout.doors;
  const layoutWindows = useDerivedWalls ? [] : layout.windows;
  const layoutOpenings = useDerivedWalls ? [] : layout.openings ?? [];

  const wallThickness = layoutWalls.find((w) => w.thickness)?.thickness ? (layoutWalls.find((w) => w.thickness)!.thickness as number) * factor : opts?.wallDefaults?.thickness ?? 0.12;
  const wallHeight = layoutWalls.find((w) => w.height)?.height ? (layoutWalls.find((w) => w.height)!.height as number) * factor : opts?.wallDefaults?.height ?? 2.7;

  const walls = layoutWalls.map((w) => ({
    id: w.id,
    a: { x: w.from[0] * factor, y: w.from[1] * factor },
    b: { x: w.to[0] * factor, y: w.to[1] * factor },
    locked: false
  }));

  const openings: DesignDoc["plan2d"]["openings"] = [];
  const convertSwing = (swing?: "cw" | "ccw"): "left" | "right" | undefined => {
    if (swing === "cw") return "right";
    if (swing === "ccw") return "left";
    return undefined;
  };

  layoutDoors.forEach((d) => {
    openings.push({
      id: d.id,
      wallId: d.wall,
      type: "door",
      offset: d.offset * factor,
      width: d.width * factor,
      height: d.height ? d.height * factor : wallHeight * 0.8,
      swing: convertSwing(d.swing)
    });
  });

  layoutWindows.forEach((w) => {
    openings.push({
      id: w.id,
      wallId: w.wall,
      type: "window",
      offset: w.offset * factor,
      width: w.width * factor,
      height: w.height ? w.height * factor : 1.2,
      verticalOffset: w.sillHeight ? w.sillHeight * factor : 0.9
    });
  });

  layoutOpenings.forEach((o) => {
    openings.push({
      id: o.id,
      wallId: o.wall,
      type: "door",
      offset: o.offset * factor,
      width: o.width * factor,
      height: o.height ? o.height * factor : wallHeight * 0.8
    });
  });

  const rooms = layout.rooms.map((r) => ({
    id: r.id,
    name: r.label,
    polygon: r.polygon.map(([x, y]) => ({ x: x * factor, y: y * factor }))
  }));

  const designDoc: DesignDoc = {
    id: `design_${Date.now()}`,
    projectId: opts?.projectId ?? "auto_plan",
    revision: 1,
    plan2d: {
      unit: "m",
      params: { wallHeight, wallThickness, ceilingHeight: wallHeight },
      walls,
      rooms,
      openings
    },
    surfaceMaterials: {},
    objects: []
  };

  return designDoc;
}

export function planCenter(designDoc: DesignDoc) {
  const xs: number[] = [];
  const ys: number[] = [];
  designDoc.plan2d.walls.forEach((w) => {
    xs.push(w.a.x, w.b.x);
    ys.push(w.a.y, w.b.y);
  });
  if (xs.length === 0 || ys.length === 0) return { x: 0, y: 0 };
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}
