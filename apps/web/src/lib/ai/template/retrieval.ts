import fs from "node:fs/promises";
import path from "node:path";

export type TemplateLicenseStatus = "user_opt_in" | "partner_licensed" | "blocked";
export type TemplateMatchType = "catalog_text" | "image_exact" | "image_hash_exact";

export type CatalogTemplateQuery = {
  apartmentName: string;
  typeName: string;
  region?: string;
};

export type TemplateManifestEntry = {
  id: string;
  apartmentName: string;
  typeName: string;
  region?: string;
  licenseStatus: TemplateLicenseStatus;
  version: string;
  topologyPath: string;
  previewImagePath?: string;
  imageSha256?: string;
  imageHash?: string;
  width?: number;
  height?: number;
  verifiedAt?: string;
  verifiedBy?: string;
};

export type TemplateCandidate = {
  entry: TemplateManifestEntry;
  score: number;
  matchType: TemplateMatchType;
  reasons: string[];
};

type FindOptions = {
  limit?: number;
};

type ImageTemplateQuery = {
  sha256?: string;
  hash?: string;
  width?: number;
  height?: number;
};

const TEMPLATE_MANIFEST_PATH = path.join(
  process.cwd(),
  "apps",
  "web",
  "public",
  "assets",
  "floorplan-templates",
  "manifest.json"
);

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeToken(value)
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function tokenOverlapScore(a: string, b: string) {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) overlap += 1;
  });
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function fuzzyContainsScore(query: string, target: string) {
  const normalizedQuery = normalizeToken(query);
  const normalizedTarget = normalizeToken(target);
  if (!normalizedQuery || !normalizedTarget) return 0;
  if (normalizedTarget === normalizedQuery) return 1;
  if (normalizedTarget.includes(normalizedQuery)) return 0.92;
  if (normalizedQuery.includes(normalizedTarget)) return 0.82;
  return tokenOverlapScore(normalizedQuery, normalizedTarget);
}

function sanitizeEntry(raw: unknown): TemplateManifestEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const apartmentName = typeof record.apartmentName === "string" ? record.apartmentName : "";
  const typeName = typeof record.typeName === "string" ? record.typeName : "";
  const topologyPath = typeof record.topologyPath === "string" ? record.topologyPath : "";
  const licenseStatus =
    record.licenseStatus === "partner_licensed" || record.licenseStatus === "blocked"
      ? record.licenseStatus
      : "user_opt_in";
  const version = typeof record.version === "string" ? record.version : "1.0.0";
  if (!id || !apartmentName || !typeName || !topologyPath) return null;
  return {
    id,
    apartmentName,
    typeName,
    region: typeof record.region === "string" ? record.region : undefined,
    licenseStatus,
    version,
    topologyPath,
    previewImagePath: typeof record.previewImagePath === "string" ? record.previewImagePath : undefined,
    imageSha256: typeof record.imageSha256 === "string" ? record.imageSha256 : undefined,
    imageHash: typeof record.imageHash === "string" ? record.imageHash : undefined,
    width: Number.isFinite(Number(record.width)) ? Number(record.width) : undefined,
    height: Number.isFinite(Number(record.height)) ? Number(record.height) : undefined,
    verifiedAt: typeof record.verifiedAt === "string" ? record.verifiedAt : undefined,
    verifiedBy: typeof record.verifiedBy === "string" ? record.verifiedBy : undefined
  };
}

async function loadManifest(): Promise<TemplateManifestEntry[]> {
  try {
    const raw = await fs.readFile(TEMPLATE_MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => sanitizeEntry(entry))
      .filter((entry): entry is TemplateManifestEntry => Boolean(entry))
      .filter((entry) => entry.licenseStatus !== "blocked");
  } catch {
    return [];
  }
}

function toAbsolutePublicPath(publicPath: string) {
  const normalized = publicPath.startsWith("/") ? publicPath.slice(1) : publicPath;
  return path.join(process.cwd(), "apps", "web", "public", normalized);
}

export async function loadTemplateTopology(entry: TemplateManifestEntry): Promise<unknown | null> {
  const filePath = toAbsolutePublicPath(entry.topologyPath);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function findCatalogTemplateCandidates(query: CatalogTemplateQuery, options: FindOptions = {}) {
  const limit = Math.max(1, options.limit ?? 5);
  const entries = await loadManifest();
  const candidates = entries
    .map((entry) => {
      const apartmentScore = fuzzyContainsScore(query.apartmentName, entry.apartmentName);
      const typeScore = fuzzyContainsScore(query.typeName, entry.typeName);
      const regionScore =
        query.region && entry.region ? fuzzyContainsScore(query.region, entry.region) : query.region ? 0 : 0.5;
      const score = apartmentScore * 0.62 + typeScore * 0.33 + regionScore * 0.05;
      const reasons = [
        `apartment=${apartmentScore.toFixed(3)}`,
        `type=${typeScore.toFixed(3)}`,
        `region=${regionScore.toFixed(3)}`
      ];
      return {
        entry,
        score,
        matchType: "catalog_text" as const,
        reasons
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return candidates;
}

function sizeSimilarityScore(
  entry: TemplateManifestEntry,
  query: { width?: number; height?: number },
  toleranceRatio: number
) {
  if (!entry.width || !entry.height || !query.width || !query.height) return 0.6;
  const widthRatio = Math.abs(entry.width - query.width) / Math.max(query.width, 1);
  const heightRatio = Math.abs(entry.height - query.height) / Math.max(query.height, 1);
  if (widthRatio > toleranceRatio || heightRatio > toleranceRatio) return 0;
  return 1 - Math.max(widthRatio, heightRatio);
}

export async function findImageTemplateCandidates(query: ImageTemplateQuery, options: FindOptions = {}) {
  const limit = Math.max(1, options.limit ?? 5);
  const toleranceRatio = Number(process.env.FLOORPLAN_TEMPLATE_SIZE_TOLERANCE_RATIO ?? 0.02);
  const entries = await loadManifest();
  const candidates: TemplateCandidate[] = [];
  for (const entry of entries) {
    const reasons: string[] = [];
    let matchType: TemplateMatchType | null = null;
    let score = 0;
    if (query.sha256 && entry.imageSha256 && query.sha256 === entry.imageSha256) {
      matchType = "image_exact";
      score = 1;
      reasons.push("sha256=exact");
    } else if (query.hash && entry.imageHash && query.hash === entry.imageHash) {
      matchType = "image_hash_exact";
      score = 0.94;
      reasons.push("dhash=exact");
    } else {
      continue;
    }
    const sizeScore = sizeSimilarityScore(entry, query, toleranceRatio);
    if (sizeScore <= 0) continue;
    score = score * 0.85 + sizeScore * 0.15;
    reasons.push(`size=${sizeScore.toFixed(3)}`);
    candidates.push({
      entry,
      score,
      matchType,
      reasons
    });
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}
