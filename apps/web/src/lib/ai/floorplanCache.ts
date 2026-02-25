"use server";

import fs from "fs/promises";
import path from "path";
import { createServerClient } from "@supabase/ssr";
import { hammingDistanceHex } from "./imageHash";

type CacheEntry = {
  hash: string;
  sha256: string;
  topologyPath: string;
  createdAt: string;
  source: string;
  width: number;
  height: number;
  score?: number;
  metricsSummary?: CacheMetricsSummary;
};

type CacheMetricsSummary = {
  wallCount: number;
  openingCount: number;
  axisAlignedRatio: number;
  orphanWallCount: number;
  selfIntersectionCount: number;
  openingsAttachedRatio: number;
  wallThicknessOutlierRate?: number;
  openingOverlapCount?: number;
  openingOutOfWallRangeCount?: number;
  exteriorAreaSanity?: boolean;
  openingTypeConfidenceMean?: number;
  loopCountPenalty?: number;
  scaleConfidence?: number;
  scaleEvidenceCompleteness?: number;
  scaleSource?: "ocr_dimension" | "door_heuristic" | "user_measure" | "unknown";
  exteriorDetected: boolean;
  exteriorLoopClosed: boolean;
  entranceDetected: boolean;
};

type CacheIndex = {
  version: 1;
  entries: CacheEntry[];
};

const DEFAULT_THRESHOLD = Number(process.env.FLOORPLAN_CACHE_DHASH_THRESHOLD ?? 0);
const SIZE_TOLERANCE_RATIO = Number(process.env.FLOORPLAN_CACHE_SIZE_TOLERANCE_RATIO ?? 0.02);
const CACHE_DIR = process.env.PLAN2SPACE_CACHE_DIR ?? path.join(process.cwd(), ".cache", "floorplans");
const INDEX_FILE = path.join(CACHE_DIR, "index.json");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.FLOORPLAN_CACHE_BUCKET;

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_BUCKET) return null;
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
    cookies: {
      getAll: () => [],
      setAll: () => {}
    }
  });
}

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function readIndex(): Promise<CacheIndex> {
  try {
    const raw = await fs.readFile(INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw) as CacheIndex;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return { version: 1, entries: [] };
    }
    return parsed;
  } catch {
    return { version: 1, entries: [] };
  }
}

async function writeIndex(index: CacheIndex) {
  await ensureCacheDir();
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

export type CacheHit = {
  entry: CacheEntry;
  topology: unknown;
  distance: number;
  exact: boolean;
};

export async function findCachedTopology(params: {
  hash: string;
  sha256: string;
  width: number;
  height: number;
  threshold?: number;
}): Promise<CacheHit | null> {
  const { hash, sha256, width, height, threshold = DEFAULT_THRESHOLD } = params;
  const index = await readIndex();

  const exact = index.entries.find((entry) => entry.sha256 === sha256);
  if (exact) {
    try {
      const raw = await fs.readFile(exact.topologyPath, "utf8");
      return { entry: exact, topology: JSON.parse(raw), distance: 0, exact: true };
    } catch {
      // fallthrough to nearest search if file missing
    }
  }

  const isComparableSize = (entry: CacheEntry) => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false;
    if (!Number.isFinite(entry.width) || !Number.isFinite(entry.height) || entry.width <= 0 || entry.height <= 0) {
      return false;
    }
    const widthDiffRatio = Math.abs(entry.width - width) / Math.max(width, 1);
    const heightDiffRatio = Math.abs(entry.height - height) / Math.max(height, 1);
    return widthDiffRatio <= SIZE_TOLERANCE_RATIO && heightDiffRatio <= SIZE_TOLERANCE_RATIO;
  };

  let best: CacheEntry | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const entry of index.entries) {
    if (!isComparableSize(entry)) continue;
    const distance = await hammingDistanceHex(hash, entry.hash);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
    }
  }

  if (best && bestDistance <= threshold) {
    try {
      const raw = await fs.readFile(best.topologyPath, "utf8");
      return { entry: best, topology: JSON.parse(raw), distance: bestDistance, exact: false };
    } catch {
      // fallthrough to remote lookup
    }
  }

  const supabase = getSupabaseClient();
  if (supabase && SUPABASE_BUCKET) {
    const remotePath = `floorplans/${sha256}.json`;
    const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(remotePath);
    if (!error && data) {
      const text = await data.text();
      return {
        entry: {
          hash,
          sha256,
          topologyPath: remotePath,
          createdAt: new Date().toISOString(),
          source: "supabase",
          width: 0,
          height: 0
        },
        topology: JSON.parse(text),
        distance: 0,
        exact: true
      };
    }
  }
  return null;
}

export async function storeCachedTopology(params: {
  hash: string;
  sha256: string;
  source: string;
  width: number;
  height: number;
  score?: number;
  metricsSummary?: CacheMetricsSummary;
  topology: unknown;
  skipRemote?: boolean;
}) {
  const { hash, sha256, source, width, height, score, metricsSummary, topology, skipRemote } = params;
  await ensureCacheDir();
  const index = await readIndex();

  const fileName = `${hash}-${Date.now()}.json`;
  const topologyPath = path.join(CACHE_DIR, fileName);
  await fs.writeFile(topologyPath, JSON.stringify(topology, null, 2));

  index.entries.unshift({
    hash,
    sha256,
    topologyPath,
    createdAt: new Date().toISOString(),
    source,
    width,
    height,
    ...(Number.isFinite(score) ? { score } : {}),
    ...(metricsSummary ? { metricsSummary } : {})
  });

  await writeIndex(index);

  if (!skipRemote) {
    const supabase = getSupabaseClient();
    if (supabase && SUPABASE_BUCKET) {
      const remotePath = `floorplans/${sha256}.json`;
      await supabase.storage.from(SUPABASE_BUCKET).upload(remotePath, JSON.stringify(topology), {
        upsert: true,
        contentType: "application/json"
      });
    }
  }
}
